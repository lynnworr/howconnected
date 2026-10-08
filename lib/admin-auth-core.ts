import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const ADMIN_SESSION_COOKIE = "howconnected_admin_session";
export const ADMIN_SESSION_DURATION_SECONDS = 8 * 60 * 60;

const SESSION_VERSION = "v1";
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_ENTRY_LIMIT = 1_000;

type LoginAttempt = {
  failures: number;
  blockedUntil: number;
  windowStartedAt: number;
};

export type AdminLoginRateLimiter = {
  isBlocked(key: string, now?: number): boolean;
  recordFailure(key: string, now?: number): void;
  clear(key: string): void;
};

export type AdminLoginDependencies = {
  password: string | undefined;
  rateLimiter: AdminLoginRateLimiter;
  now?: number;
  secureCookie?: boolean;
};

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function deriveSessionKey(password: string): Buffer {
  return sha256(`howconnected-admin-session:${password}`);
}

function signSessionPayload(payload: string, password: string): string {
  return createHmac("sha256", deriveSessionKey(password))
    .update(payload)
    .digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  return timingSafeEqual(sha256(left), sha256(right));
}

export function createAdminSessionToken(
  password: string,
  now = Date.now(),
): string {
  const expiresAt = Math.floor(now / 1000) + ADMIN_SESSION_DURATION_SECONDS;
  const payload = `${SESSION_VERSION}.${expiresAt}.${randomBytes(18).toString("base64url")}`;
  return `${payload}.${signSessionPayload(payload, password)}`;
}

export function isAdminSessionTokenValid(
  token: string | undefined,
  password: string | undefined,
  now = Date.now(),
): boolean {
  if (!token || !password) return false;

  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== SESSION_VERSION) return false;

  const [version, rawExpiresAt, nonce, providedSignature] = parts;
  const expiresAt = Number(rawExpiresAt);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(now / 1000) ||
    expiresAt > Math.floor(now / 1000) + ADMIN_SESSION_DURATION_SECONDS
  ) {
    return false;
  }
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(nonce)) return false;

  const payload = `${version}.${rawExpiresAt}.${nonce}`;
  const expectedSignature = signSessionPayload(payload, password);
  return safeEqual(providedSignature, expectedSignature);
}

export function passwordsMatch(
  submittedPassword: string,
  expectedPassword: string,
): boolean {
  return safeEqual(submittedPassword, expectedPassword);
}

export function readCookieValue(
  cookieHeader: string | null,
  cookieName = ADMIN_SESSION_COOKIE,
): string | undefined {
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (name !== cookieName) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function isAdminCookieHeaderValid(
  cookieHeader: string | null,
  password: string | undefined,
  now = Date.now(),
): boolean {
  return isAdminSessionTokenValid(
    readCookieValue(cookieHeader),
    password,
    now,
  );
}

export function serializeAdminSessionCookie(
  token: string,
  secure: boolean,
): string {
  return [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${ADMIN_SESSION_DURATION_SECONDS}`,
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function serializeAdminLogoutCookie(secure: boolean): string {
  return [
    `${ADMIN_SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function createAdminLoginRateLimiter(): AdminLoginRateLimiter {
  const attempts = new Map<string, LoginAttempt>();

  function getActiveAttempt(key: string, now: number): LoginAttempt | undefined {
    const attempt = attempts.get(key);
    if (!attempt) return undefined;
    if (now - attempt.windowStartedAt >= LOGIN_WINDOW_MS) {
      attempts.delete(key);
      return undefined;
    }
    return attempt;
  }

  function prune(now: number) {
    for (const [key, attempt] of attempts) {
      if (now - attempt.windowStartedAt >= LOGIN_WINDOW_MS) attempts.delete(key);
    }
    while (attempts.size >= LOGIN_ENTRY_LIMIT) {
      const oldestKey = attempts.keys().next().value as string | undefined;
      if (!oldestKey) break;
      attempts.delete(oldestKey);
    }
  }

  return {
    isBlocked(key, now = Date.now()) {
      const attempt = getActiveAttempt(key, now);
      return Boolean(attempt && attempt.blockedUntil > now);
    },
    recordFailure(key, now = Date.now()) {
      prune(now);
      const current = getActiveAttempt(key, now) ?? {
        failures: 0,
        blockedUntil: 0,
        windowStartedAt: now,
      };
      current.failures += 1;
      if (current.failures >= LOGIN_MAX_FAILURES) {
        current.blockedUntil = current.windowStartedAt + LOGIN_WINDOW_MS;
      }
      attempts.delete(key);
      attempts.set(key, current);
    },
    clear(key) {
      attempts.delete(key);
    },
  };
}

function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function adminRedirect(request: Request, error?: string): URL {
  const url = new URL("/admin", request.url);
  if (error) url.searchParams.set("error", error);
  return url;
}

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, private",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

export async function handleAdminLoginRequest(
  request: Request,
  dependencies: AdminLoginDependencies,
): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 4_096) {
    return new Response("Login request is too large.", {
      status: 413,
      headers: noStoreHeaders(),
    });
  }

  const key = clientKey(request);
  const now = dependencies.now ?? Date.now();
  if (dependencies.rateLimiter.isBlocked(key, now)) {
    return Response.redirect(adminRedirect(request, "rate_limited"), 303);
  }

  if (!dependencies.password) {
    return new Response("Admin access is unavailable.", {
      status: 503,
      headers: noStoreHeaders(),
    });
  }

  let submittedPassword = "";
  try {
    const formData = await request.formData();
    const value = formData.get("password");
    submittedPassword = typeof value === "string" ? value : "";
  } catch {
    dependencies.rateLimiter.recordFailure(key, now);
    return Response.redirect(adminRedirect(request, "invalid"), 303);
  }

  if (!passwordsMatch(submittedPassword, dependencies.password)) {
    dependencies.rateLimiter.recordFailure(key, now);
    return Response.redirect(adminRedirect(request, "invalid"), 303);
  }

  dependencies.rateLimiter.clear(key);
  return new Response(null, {
    status: 303,
    headers: {
      Location: adminRedirect(request).toString(),
      "Set-Cookie": serializeAdminSessionCookie(
        createAdminSessionToken(dependencies.password, now),
        dependencies.secureCookie ?? true,
      ),
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function handleProtectedAdminDataRequest<T>(
  request: Request,
  password: string | undefined,
  load: () => Promise<T>,
  now = Date.now(),
): Promise<Response> {
  if (!isAdminCookieHeaderValid(request.headers.get("cookie"), password, now)) {
    return Response.json(
      { error: "Unauthorized." },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  return Response.json(await load(), {
    headers: noStoreHeaders(),
  });
}
