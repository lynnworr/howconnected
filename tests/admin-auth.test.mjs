import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_SESSION_COOKIE,
  createAdminLoginRateLimiter,
  createAdminSessionToken,
  handleAdminLoginRequest,
  handleProtectedAdminDataRequest,
  isAdminCookieHeaderValid,
  isAdminSessionTokenValid,
} from "../lib/admin-auth-core.ts";

const PASSWORD = "a-long-private-alpha-password";
const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);

function loginRequest(password) {
  const body = new URLSearchParams({ password });
  return new Request("https://howconnected.example/api/admin/login", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": "203.0.113.10",
    },
  });
}

test("successful admin login creates an opaque secure session cookie", async () => {
  const response = await handleAdminLoginRequest(loginRequest(PASSWORD), {
    password: PASSWORD,
    rateLimiter: createAdminLoginRateLimiter(),
    now: NOW,
    secureCookie: true,
  });
  const cookie = response.headers.get("set-cookie") ?? "";

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://howconnected.example/admin");
  assert.match(cookie, new RegExp(`^${ADMIN_SESSION_COOKIE}=`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.doesNotMatch(cookie, new RegExp(PASSWORD));
  assert.equal(isAdminCookieHeaderValid(cookie, PASSWORD, NOW + 1_000), true);
});

test("failed admin login returns one generic error and no cookie", async () => {
  const response = await handleAdminLoginRequest(loginRequest("wrong-password"), {
    password: PASSWORD,
    rateLimiter: createAdminLoginRateLimiter(),
    now: NOW,
    secureCookie: true,
  });

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "https://howconnected.example/admin?error=invalid",
  );
  assert.equal(response.headers.get("set-cookie"), null);
});

test("admin page authorization rejects missing, expired, and tampered sessions", () => {
  const token = createAdminSessionToken(PASSWORD, NOW);

  assert.equal(isAdminSessionTokenValid(undefined, PASSWORD, NOW), false);
  assert.equal(isAdminSessionTokenValid(token, PASSWORD, NOW + 1_000), true);
  assert.equal(isAdminSessionTokenValid(`${token}x`, PASSWORD, NOW + 1_000), false);
  assert.equal(isAdminSessionTokenValid(token, PASSWORD, NOW + 9 * 60 * 60 * 1_000), false);
});

test("protected admin data handler rejects unauthenticated requests", async () => {
  let loaded = false;
  const response = await handleProtectedAdminDataRequest(
    new Request("https://howconnected.example/api/admin/feedback"),
    PASSWORD,
    async () => {
      loaded = true;
      return { private: true };
    },
    NOW,
  );

  assert.equal(response.status, 401);
  assert.equal(loaded, false);
  assert.deepEqual(await response.json(), { error: "Unauthorized." });
  assert.equal(response.headers.get("cache-control"), "no-store, private");
});

test("protected admin data handler accepts a valid signed cookie", async () => {
  const token = createAdminSessionToken(PASSWORD, NOW);
  const response = await handleProtectedAdminDataRequest(
    new Request("https://howconnected.example/api/admin/feedback", {
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}` },
    }),
    PASSWORD,
    async () => ({ total: 7 }),
    NOW + 1_000,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { total: 7 });
});

test("admin login limiter blocks repeated failed attempts", async () => {
  const rateLimiter = createAdminLoginRateLimiter();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await handleAdminLoginRequest(loginRequest("wrong-password"), {
      password: PASSWORD,
      rateLimiter,
      now: NOW,
      secureCookie: true,
    });
  }

  const response = await handleAdminLoginRequest(loginRequest(PASSWORD), {
    password: PASSWORD,
    rateLimiter,
    now: NOW,
    secureCookie: true,
  });
  assert.equal(
    response.headers.get("location"),
    "https://howconnected.example/admin?error=rate_limited",
  );
  assert.equal(response.headers.get("set-cookie"), null);
});
