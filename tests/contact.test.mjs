import assert from "node:assert/strict";
import test from "node:test";
import { handleContactRequest, validateContactPayload } from "../lib/contact-core.ts";
import {
  contactEmailText,
  contactRateLimiterFromEnvironment,
  createUpstashContactRateLimiter,
  deliverContactWithResend,
  readContactEmailConfiguration,
} from "../lib/contact-server.ts";

const configuration = {
  apiKey: "secret-api-key",
  toEmail: "owner@example.com",
  fromEmail: "HowConnected <contact@example.com>",
};
const validPayload = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  category: "Bug Report",
  message: "The connection between these two entities appears incorrect.",
  website: "",
};

function request(payload = validPayload, headers = {}) {
  return new Request("https://www.howconnected.app/api/contact", {
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

test("contact validation constrains required fields, categories, lengths, and headers", () => {
  const invalid = validateContactPayload({
    name: "A\r\nBcc: victim@example.com",
    email: "not-an-email\nBcc:x@example.com",
    category: "Anything",
    message: "short",
  });
  assert.equal(invalid.ok, false);
  assert.deepEqual(Object.keys(invalid.fieldErrors).sort(), ["category", "email", "message", "name"]);

  const valid = validateContactPayload(validPayload);
  assert.equal(valid.ok, true);
  assert.equal(valid.submission.email, "ada@example.com");
});

test("contact endpoint rejects malformed, oversized, and honeypot submissions", async () => {
  const malformed = await handleContactRequest(
    new Request("https://www.howconnected.app/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    }),
    dependencies(),
  );
  const oversized = await handleContactRequest(
    request(validPayload, { "content-length": "20000" }),
    dependencies(),
  );
  const honeypot = await handleContactRequest(
    request({ ...validPayload, website: "https://spam.example" }),
    dependencies(),
  );

  assert.equal(malformed.status, 400);
  assert.equal(oversized.status, 413);
  assert.equal(honeypot.status, 400);
});

test("contact endpoint fails safely when email or shared rate limiting is unavailable", async () => {
  const noEmail = await handleContactRequest(request(), dependencies({ configuration: null }));
  const noLimiter = await handleContactRequest(request(), dependencies({ rateLimiter: null }));

  assert.equal(noEmail.status, 503);
  assert.equal(noLimiter.status, 503);
  assert.match((await noEmail.json()).error, /temporarily unavailable/i);
});

test("contact endpoint rate limits before delivery", async () => {
  let delivered = false;
  const response = await handleContactRequest(
    request(),
    dependencies({
      rateLimiter: { async consume() { return { allowed: false }; } },
      async deliver() { delivered = true; return { id: "unexpected" }; },
    }),
  );

  assert.equal(response.status, 429);
  assert.equal(delivered, false);
});

test("contact endpoint reports success only after provider acceptance", async () => {
  const success = await handleContactRequest(request(), dependencies());
  const rejected = await handleContactRequest(
    request(),
    dependencies({ async deliver() { throw new Error("provider details"); } }),
  );
  const missingId = await handleContactRequest(
    request(),
    dependencies({ async deliver() { return { id: "" }; } }),
  );

  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { ok: true, message: "Your message was sent successfully." });
  assert.equal(rejected.status, 502);
  assert.equal(missingId.status, 502);
  assert.doesNotMatch(JSON.stringify(await rejected.json()), /provider details/);
});

test("Resend delivery uses server configuration, plain text, and safe reply-to", async () => {
  let captured;
  const accepted = await deliverContactWithResend(
    configuration,
    validPayload,
    async (url, init) => {
      captured = { url, init };
      return Response.json({ id: "resend_123" }, { status: 200 });
    },
  );
  const body = JSON.parse(captured.init.body);

  assert.deepEqual(accepted, { id: "resend_123" });
  assert.equal(captured.url, "https://api.resend.com/emails");
  assert.equal(body.from, configuration.fromEmail);
  assert.deepEqual(body.to, [configuration.toEmail]);
  assert.equal(body.reply_to, validPayload.email);
  assert.equal(body.html, undefined);
  assert.match(body.text, /Ada Lovelace/);
  assert.equal(contactEmailText(validPayload).includes("<html"), false);
});

test("contact environment configuration never accepts missing or injectable addresses", () => {
  assert.equal(readContactEmailConfiguration({}), null);
  assert.equal(
    readContactEmailConfiguration({
      RESEND_API_KEY: "key",
      CONTACT_TO_EMAIL: "owner@example.com\nBcc:x@example.com",
      CONTACT_FROM_EMAIL: "contact@example.com",
    }),
    null,
  );
  assert.deepEqual(
    readContactEmailConfiguration({
      RESEND_API_KEY: "key",
      CONTACT_TO_EMAIL: "owner@example.com",
      CONTACT_FROM_EMAIL: "HowConnected <contact@example.com>",
    }),
    {
      apiKey: "key",
      toEmail: "owner@example.com",
      fromEmail: "HowConnected <contact@example.com>",
    },
  );
  assert.equal(contactRateLimiterFromEnvironment({ NODE_ENV: "production" }), null);
});

test("shared contact rate limiting uses one atomic counter without exposing the client IP", async () => {
  let captured;
  const limiter = createUpstashContactRateLimiter(
    "https://redis.example.com/",
    "redis-secret",
    async (url, init) => {
      captured = { url, init };
      return Response.json({ result: 5 });
    },
  );

  assert.deepEqual(await limiter.consume("203.0.113.42"), { allowed: true });
  assert.equal(captured.url, "https://redis.example.com");
  assert.equal(captured.init.headers.Authorization, "Bearer redis-secret");
  const command = JSON.parse(captured.init.body);
  assert.equal(command[0], "EVAL");
  assert.match(command[3], /^howconnected:contact:[a-f0-9]{64}$/);
  assert.doesNotMatch(captured.init.body, /203\.0\.113\.42/);

  const blocked = createUpstashContactRateLimiter(
    "https://redis.example.com",
    "redis-secret",
    async () => Response.json({ result: 6 }),
  );
  assert.deepEqual(await blocked.consume("203.0.113.42"), { allowed: false });
});
