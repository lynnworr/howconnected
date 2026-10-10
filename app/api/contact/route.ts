import { handleContactRequest } from "@/lib/contact-core";
import {
  contactRateLimiterFromEnvironment,
  deliverContactWithResend,
  readContactEmailConfiguration,
} from "@/lib/contact-server";

export async function POST(request: Request) {
  return handleContactRequest(request, {
    configuration: readContactEmailConfiguration(),
    rateLimiter: contactRateLimiterFromEnvironment(),
    deliver: deliverContactWithResend,
  });
}
