import {
  CONTACT_CATEGORIES,
  type ContactCategory,
  type ContactEmailConfiguration,
  type ContactRateLimiter,
  type ContactSubmission,
} from "./contact-types.ts";

export type ContactRequestDependencies = {
  configuration: ContactEmailConfiguration | null;
  rateLimiter: ContactRateLimiter | null;
  deliver(
    configuration: ContactEmailConfiguration,
    submission: ContactSubmission,
  ): Promise<{ id: string }>;
};

const MAX_REQUEST_BYTES = 16_384;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const HEADER_CONTROL_CHARACTERS = /[\r\n\u0000-\u001F\u007F]/;

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  category?: unknown;
  message?: unknown;
  website?: unknown;
};

type ValidationResult =
  | { ok: true; submission: ContactSubmission; honeypot: string }
  | { ok: false; fieldErrors: Record<string, string> };

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
  };
}

function jsonResponse(body: object, status: number): Response {
  return Response.json(body, { status, headers: noStoreHeaders() });
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateContactPayload(payload: ContactPayload): ValidationResult {
  const name = stringValue(payload.name);
  const email = stringValue(payload.email).toLowerCase();
  const category = stringValue(payload.category);
  const message = stringValue(payload.message);
  const honeypot = stringValue(payload.website);
  const fieldErrors: Record<string, string> = {};

  if (name.length < 2 || name.length > 100 || HEADER_CONTROL_CHARACTERS.test(name)) {
    fieldErrors.name = "Enter a name between 2 and 100 characters.";
  }
  if (
    email.length < 3 ||
    email.length > 254 ||
    HEADER_CONTROL_CHARACTERS.test(email) ||
    !EMAIL_PATTERN.test(email)
  ) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (!CONTACT_CATEGORIES.includes(category as ContactCategory)) {
    fieldErrors.category = "Choose a valid subject.";
  }
  if (
    message.length < 10 ||
    message.length > 5_000 ||
    CONTROL_CHARACTERS.test(message)
  ) {
    fieldErrors.message = "Enter a message between 10 and 5,000 characters.";
  }
  if (honeypot.length > 200) {
    fieldErrors.website = "Invalid submission.";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    honeypot,
    submission: {
      name,
      email,
      category: category as ContactCategory,
      message,
    },
  };
}

export function contactClientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function handleContactRequest(
  request: Request,
  dependencies: ContactRequestDependencies,
): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ error: "The submission is too large." }, 413);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ error: "Invalid submission format." }, 415);
  }

  let payload: ContactPayload;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ error: "The submission is too large." }, 413);
    }
    payload = JSON.parse(rawBody) as ContactPayload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
  } catch {
    return jsonResponse({ error: "Invalid submission format." }, 400);
  }

  const validation = validateContactPayload(payload);
  if (!validation.ok) {
    return jsonResponse(
      { error: "Please check the highlighted fields.", fieldErrors: validation.fieldErrors },
      400,
    );
  }
  if (validation.honeypot) {
    return jsonResponse({ error: "Unable to submit this message." }, 400);
  }
  if (!dependencies.configuration || !dependencies.rateLimiter) {
    return jsonResponse(
      { error: "Contact delivery is temporarily unavailable. Please try again later." },
      503,
    );
  }

  try {
    const rateLimit = await dependencies.rateLimiter.consume(contactClientKey(request));
    if (!rateLimit.allowed) {
      return jsonResponse(
        { error: "Too many messages have been submitted. Please try again later." },
        429,
      );
    }
  } catch {
    return jsonResponse(
      { error: "Contact delivery is temporarily unavailable. Please try again later." },
      503,
    );
  }

  try {
    const accepted = await dependencies.deliver(
      dependencies.configuration,
      validation.submission,
    );
    if (!accepted.id) throw new Error();
    return jsonResponse({ ok: true, message: "Your message was sent successfully." }, 200);
  } catch {
    return jsonResponse(
      { error: "Your message could not be sent. Please try again later." },
      502,
    );
  }
}
