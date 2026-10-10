import { createHash } from "node:crypto";
import type {
  ContactEmailConfiguration,
  ContactRateLimiter,
  ContactSubmission,
} from "./contact-types.ts";

const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const RATE_LIMIT_MAX_MESSAGES = 5;
const LOCAL_RATE_LIMIT_ENTRY_CAP = 1_000;

type FetchLike = typeof fetch;

function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isSafeSender(value: string): boolean {
  if (!value || value.length > 320 || /[\r\n\u0000-\u001F\u007F]/.test(value)) return false;
  const displayAddress = value.match(/^.{1,100}\s<([^<>]+)>$/)?.[1];
  return isEmail(displayAddress ?? value);
}

export function readContactEmailConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): ContactEmailConfiguration | null {
  const apiKey = environment.RESEND_API_KEY?.trim() ?? "";
  const toEmail = environment.CONTACT_TO_EMAIL?.trim() ?? "";
  const fromEmail = environment.CONTACT_FROM_EMAIL?.trim() ?? "";
  if (!apiKey || !isEmail(toEmail) || !isSafeSender(fromEmail)) return null;
  return { apiKey, toEmail, fromEmail };
}

export function contactEmailText(submission: ContactSubmission): string {
  return [
    `HowConnected contact: ${submission.category}`,
    "",
    `Name: ${submission.name}`,
    `Email: ${submission.email}`,
    "",
    submission.message,
  ].join("\n");
}

export async function deliverContactWithResend(
  configuration: ContactEmailConfiguration,
  submission: ContactSubmission,
  fetchImplementation: FetchLike = fetch,
): Promise<{ id: string }> {
  const response = await fetchImplementation("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: configuration.fromEmail,
      to: [configuration.toEmail],
      reply_to: submission.email,
      subject: `[HowConnected] ${submission.category}: ${submission.name}`,
      text: contactEmailText(submission),
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) throw new Error("Contact provider rejected the message.");
  const body = (await response.json()) as { id?: unknown };
  if (typeof body.id !== "string" || !body.id) {
    throw new Error("Contact provider did not accept the message.");
  }
  return { id: body.id };
}

export function createUpstashContactRateLimiter(
  url: string,
  token: string,
  fetchImplementation: FetchLike = fetch,
): ContactRateLimiter {
  const endpoint = url.replace(/\/+$/, "");
  return {
    async consume(key) {
      const hashedKey = createHash("sha256").update(key).digest("hex");
      const script =
        "local current=redis.call('INCR',KEYS[1]); " +
        "if current==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; " +
        "return current";
      const response = await fetchImplementation(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          "EVAL",
          script,
          "1",
          `howconnected:contact:${hashedKey}`,
          String(RATE_LIMIT_WINDOW_SECONDS),
        ]),
        signal: AbortSignal.timeout(3_000),
      });
      if (!response.ok) throw new Error("Shared contact rate limiter unavailable.");
      const body = (await response.json()) as { result?: unknown };
      const count = Number(body.result);
      if (!Number.isFinite(count)) throw new Error("Invalid rate limiter response.");
      return { allowed: count <= RATE_LIMIT_MAX_MESSAGES };
    },
  };
}

export function createLocalContactRateLimiter(): ContactRateLimiter {
  const entries = new Map<string, { count: number; expiresAt: number }>();
  return {
    async consume(key) {
      const now = Date.now();
      const current = entries.get(key);
      const entry = !current || current.expiresAt <= now
        ? { count: 0, expiresAt: now + RATE_LIMIT_WINDOW_SECONDS * 1_000 }
        : current;
      entry.count += 1;
      entries.delete(key);
      entries.set(key, entry);
      while (entries.size > LOCAL_RATE_LIMIT_ENTRY_CAP) {
        const oldest = entries.keys().next().value as string | undefined;
        if (!oldest) break;
        entries.delete(oldest);
      }
      return { allowed: entry.count <= RATE_LIMIT_MAX_MESSAGES };
    },
  };
}

const localRateLimiter = createLocalContactRateLimiter();

export function contactRateLimiterFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): ContactRateLimiter | null {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) return createUpstashContactRateLimiter(url, token);
  if (url || token) return null;
  return environment.NODE_ENV === "production" || environment.VERCEL === "1"
    ? null
    : localRateLimiter;
}
