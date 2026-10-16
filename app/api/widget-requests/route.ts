import { handleWidgetRequest } from "@/lib/widget-request-core";
import {
  contactRateLimiterFromEnvironment,
  readContactEmailConfiguration,
} from "@/lib/contact-server";
import { deliverWidgetRequestWithResend } from "@/lib/widget-request-server";

export async function POST(request: Request) {
  return handleWidgetRequest(request, {
    configuration: readContactEmailConfiguration(),
    rateLimiter: contactRateLimiterFromEnvironment(),
    deliver: deliverWidgetRequestWithResend,
  });
}
