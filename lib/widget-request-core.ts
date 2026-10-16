import {
  WIDGET_COMMERCIAL_INTEREST,
  WIDGET_REQUEST_SCOPES,
  type WidgetCommercialInterest,
  type WidgetRequestDependencies,
  type WidgetRequestScope,
  type WidgetRequestSubmission,
} from "./widget-request-types.ts";

const MAX_REQUEST_BYTES = 24_576;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const HEADER_CONTROL_CHARACTERS = /[\r\n\u0000-\u001F\u007F]/;

type WidgetRequestPayload = {
  publisherName?: unknown;
  email?: unknown;
  websiteUrl?: unknown;
  requestedConnection?: unknown;
  intendedUse?: unknown;
  requestScope?: unknown;
  commercialInterest?: unknown;
  company?: unknown;
};

type ValidationResult =
  | { ok: true; submission: WidgetRequestSubmission; honeypot: string }
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

function normalizeWebsiteUrl(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      !url.hostname ||
      url.href.length > 500
    ) {
      return null;
    }
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

export function validateWidgetRequestPayload(
  payload: WidgetRequestPayload,
): ValidationResult {
  const publisherName = stringValue(payload.publisherName);
  const email = stringValue(payload.email).toLowerCase();
  const websiteInput = stringValue(payload.websiteUrl);
  const websiteUrl = normalizeWebsiteUrl(websiteInput);
  const requestedConnection = stringValue(payload.requestedConnection);
  const intendedUse = stringValue(payload.intendedUse);
  const requestScope = stringValue(payload.requestScope);
  const commercialInterest = stringValue(payload.commercialInterest);
  const honeypot = stringValue(payload.company);
  const fieldErrors: Record<string, string> = {};

  if (
    publisherName.length < 2 ||
    publisherName.length > 120 ||
    HEADER_CONTROL_CHARACTERS.test(publisherName)
  ) {
    fieldErrors.publisherName = "Enter a publisher or organization name between 2 and 120 characters.";
  }
  if (
    email.length < 3 ||
    email.length > 254 ||
    HEADER_CONTROL_CHARACTERS.test(email) ||
    !EMAIL_PATTERN.test(email)
  ) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (websiteInput && !websiteUrl) {
    fieldErrors.websiteUrl = "Enter a valid HTTP or HTTPS website URL.";
  }
  if (
    requestedConnection.length < 5 ||
    requestedConnection.length > 300 ||
    CONTROL_CHARACTERS.test(requestedConnection)
  ) {
    fieldErrors.requestedConnection = "Describe the requested connection in 5 to 300 characters.";
  }
  if (
    intendedUse.length < 10 ||
    intendedUse.length > 3_000 ||
    CONTROL_CHARACTERS.test(intendedUse)
  ) {
    fieldErrors.intendedUse = "Describe the intended use in 10 to 3,000 characters.";
  }
  if (!WIDGET_REQUEST_SCOPES.includes(requestScope as WidgetRequestScope)) {
    fieldErrors.requestScope = "Choose one widget or ongoing publishing use.";
  }
  if (
    commercialInterest &&
    !WIDGET_COMMERCIAL_INTEREST.includes(commercialInterest as WidgetCommercialInterest)
  ) {
    fieldErrors.commercialInterest = "Choose one interest option.";
  }
  if (honeypot.length > 200) fieldErrors.company = "Invalid submission.";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    honeypot,
    submission: {
      publisherName,
      email,
      websiteUrl,
      requestedConnection,
      intendedUse,
      requestScope: requestScope as WidgetRequestScope,
      commercialInterest: commercialInterest
        ? commercialInterest as WidgetCommercialInterest
        : null,
    },
  };
}

function widgetRequestClientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function handleWidgetRequest(
  request: Request,
  dependencies: WidgetRequestDependencies,
): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ error: "The submission is too large." }, 413);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ error: "Invalid submission format." }, 415);
  }

  let payload: WidgetRequestPayload;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ error: "The submission is too large." }, 413);
    }
    payload = JSON.parse(rawBody) as WidgetRequestPayload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
  } catch {
    return jsonResponse({ error: "Invalid submission format." }, 400);
  }

  const validation = validateWidgetRequestPayload(payload);
  if (!validation.ok) {
    return jsonResponse(
      { error: "Please check the highlighted fields.", fieldErrors: validation.fieldErrors },
      400,
    );
  }
  if (validation.honeypot) {
    return jsonResponse({ error: "Unable to submit this request." }, 400);
  }
  if (!dependencies.configuration || !dependencies.rateLimiter) {
    return jsonResponse(
      { error: "Publisher requests are temporarily unavailable. Please try again later." },
      503,
    );
  }

  try {
    const rateLimit = await dependencies.rateLimiter.consume(
      widgetRequestClientKey(request),
    );
    if (!rateLimit.allowed) {
      return jsonResponse(
        { error: "Too many requests have been submitted. Please try again later." },
        429,
      );
    }
  } catch {
    return jsonResponse(
      { error: "Publisher requests are temporarily unavailable. Please try again later." },
      503,
    );
  }

  try {
    const accepted = await dependencies.deliver(
      dependencies.configuration,
      validation.submission,
    );
    if (!accepted.id) throw new Error();
    return jsonResponse(
      {
        ok: true,
        message: "Your request was received for editorial review. This is not a guaranteed order or publication commitment.",
      },
      200,
    );
  } catch {
    return jsonResponse(
      { error: "Your request could not be sent. Please try again later." },
      502,
    );
  }
}
