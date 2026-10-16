import type { ContactEmailConfiguration } from "./contact-types.ts";
import {
  WIDGET_COMMERCIAL_INTEREST_LABELS,
  WIDGET_REQUEST_SCOPE_LABELS,
  type WidgetRequestSubmission,
} from "./widget-request-types.ts";

type FetchLike = typeof fetch;

export function widgetRequestEmailText(
  submission: WidgetRequestSubmission,
): string {
  return [
    "HowConnected publisher widget request",
    "",
    `Publisher or organization: ${submission.publisherName}`,
    `Contact email: ${submission.email}`,
    `Website: ${submission.websiteUrl ?? "Not provided"}`,
    `Requested connection: ${submission.requestedConnection}`,
    `Request scope: ${WIDGET_REQUEST_SCOPE_LABELS[submission.requestScope]}`,
    `Commercial interest: ${submission.commercialInterest ? WIDGET_COMMERCIAL_INTEREST_LABELS[submission.commercialInterest] : "Not answered"} (nonbinding)`,
    "",
    "Intended use or article context:",
    submission.intendedUse,
    "",
    "Editorial review is required before any widget is approved or published.",
  ].join("\n");
}

export async function deliverWidgetRequestWithResend(
  configuration: ContactEmailConfiguration,
  submission: WidgetRequestSubmission,
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
      subject: `[HowConnected publisher request] ${submission.publisherName}`,
      text: widgetRequestEmailText(submission),
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) throw new Error("Contact provider rejected the request.");
  const body = (await response.json()) as { id?: unknown };
  if (typeof body.id !== "string" || !body.id) {
    throw new Error("Contact provider did not accept the request.");
  }
  return { id: body.id };
}
