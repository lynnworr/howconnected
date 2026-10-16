import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  handleWidgetRequest,
  validateWidgetRequestPayload,
} from "../lib/widget-request-core.ts";
import {
  deliverWidgetRequestWithResend,
  widgetRequestEmailText,
} from "../lib/widget-request-server.ts";

const configuration = {
  apiKey: "secret-api-key",
  toEmail: "owner@example.com",
  fromEmail: "HowConnected <contact@example.com>",
};
const validPayload = {
  publisherName: "The Science Review",
  email: "editor@example.com",
  websiteUrl: "https://publisher.example/articles#draft",
  requestedConnection: "NASA and Katherine Johnson",
  intendedUse: "A classroom article explaining the people behind early spaceflight.",
  requestScope: "one_widget",
  commercialInterest: "maybe_price",
  company: "",
};

function request(payload = validPayload, headers = {}) {
  return new Request("https://www.howconnected.app/api/widget-requests", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.42",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

function dependencies(overrides = {}) {
  return {
    configuration,
    rateLimiter: { async consume() { return { allowed: true }; } },
    async deliver() { return { id: "email_accepted" }; },
    ...overrides,
  };
}

test("widget request validation bounds fields, enums, headers, and website URLs", () => {
  const valid = validateWidgetRequestPayload(validPayload);
  assert.equal(valid.ok, true);
  assert.equal(valid.submission.email, "editor@example.com");
  assert.equal(valid.submission.websiteUrl, "https://publisher.example/articles");
  const withoutInterest = validateWidgetRequestPayload({
    ...validPayload,
    commercialInterest: "",
  });
  assert.equal(withoutInterest.ok, true);
  assert.equal(withoutInterest.submission.commercialInterest, null);

  const invalid = validateWidgetRequestPayload({
    publisherName: "A\r\nBcc: victim@example.com",
    email: "not-an-email",
    websiteUrl: "javascript:alert(1)",
    requestedConnection: "x",
    intendedUse: "short",
    requestScope: "enterprise",
    commercialInterest: "send_prices",
  });
  assert.equal(invalid.ok, false);
  assert.deepEqual(Object.keys(invalid.fieldErrors).sort(), [
    "commercialInterest",
    "email",
    "intendedUse",
    "publisherName",
    "requestScope",
    "requestedConnection",
    "websiteUrl",
  ]);

  const credentials = validateWidgetRequestPayload({
    ...validPayload,
    websiteUrl: "https://user:secret@publisher.example/",
  });
  assert.equal(credentials.ok, false);
});

test("widget request endpoint rejects malformed, oversized, and honeypot submissions", async () => {
  const malformed = await handleWidgetRequest(
    new Request("https://www.howconnected.app/api/widget-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    }),
    dependencies(),
  );
  const oversized = await handleWidgetRequest(
    request(validPayload, { "content-length": "25000" }),
    dependencies(),
  );
  const honeypot = await handleWidgetRequest(
    request({ ...validPayload, company: "spam publisher" }),
    dependencies(),
  );

  assert.equal(malformed.status, 400);
  assert.equal(oversized.status, 413);
  assert.equal(honeypot.status, 400);
});

test("widget request endpoint fails closed when mail or shared rate limiting is unavailable", async () => {
  const noEmail = await handleWidgetRequest(
    request(),
    dependencies({ configuration: null }),
  );
  const noLimiter = await handleWidgetRequest(
    request(),
    dependencies({ rateLimiter: null }),
  );
  assert.equal(noEmail.status, 503);
  assert.equal(noLimiter.status, 503);
  assert.match((await noEmail.json()).error, /temporarily unavailable/i);
});

test("widget request endpoint rate limits before mocked delivery", async () => {
  let delivered = false;
  const response = await handleWidgetRequest(
    request(),
    dependencies({
      rateLimiter: { async consume() { return { allowed: false }; } },
      async deliver() { delivered = true; return { id: "unexpected" }; },
    }),
  );
  assert.equal(response.status, 429);
  assert.equal(delivered, false);
});

test("widget request reports success only after mocked provider acceptance", async () => {
  const success = await handleWidgetRequest(request(), dependencies());
  const rejected = await handleWidgetRequest(
    request(),
    dependencies({ async deliver() { throw new Error("provider details"); } }),
  );
  const missingId = await handleWidgetRequest(
    request(),
    dependencies({ async deliver() { return { id: "" }; } }),
  );

  assert.equal(success.status, 200);
  assert.match((await success.json()).message, /editorial review/i);
  assert.equal(rejected.status, 502);
  assert.equal(missingId.status, 502);
  assert.doesNotMatch(JSON.stringify(await rejected.json()), /provider details/);
});

test("widget request Resend delivery is owner-only plain text with safe reply-to", async () => {
  const validated = validateWidgetRequestPayload(validPayload);
  assert.equal(validated.ok, true);
  let captured;
  const accepted = await deliverWidgetRequestWithResend(
    configuration,
    validated.submission,
    async (url, init) => {
      captured = { url, init };
      return Response.json({ id: "resend_widget_123" }, { status: 200 });
    },
  );
  const body = JSON.parse(captured.init.body);

  assert.deepEqual(accepted, { id: "resend_widget_123" });
  assert.equal(captured.url, "https://api.resend.com/emails");
  assert.deepEqual(body.to, [configuration.toEmail]);
  assert.equal(body.reply_to, "editor@example.com");
  assert.equal(body.html, undefined);
  assert.match(body.text, /Editorial review is required/);
  assert.equal(widgetRequestEmailText(validated.submission).includes("<html"), false);
});

test("publisher request form is accessible and never exposes submission details to analytics", async () => {
  const [page, form] = await Promise.all([
    readFile(new URL("../app/widgets/request/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/PublisherRequestForm.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /PublisherRequestForm/);
  assert.match(page, /does not guarantee approval/i);
  assert.match(form, /<fieldset(?:\s|>)/);
  assert.match(form, /aria-live="polite"/);
  assert.match(form, /name="company"/);
  assert.match(form, /fetch\("\/api\/widget-requests"/);
  assert.match(form, /publisher_request_submitted/);
  const trackingCall = form.match(
    /trackProductEvent\("publisher_request_submitted", \{[\s\S]*?\}\);/,
  )?.[0];
  assert.ok(trackingCall);
  assert.doesNotMatch(trackingCall, /publisherName|email|websiteUrl|requestedConnection|intendedUse/);
});
