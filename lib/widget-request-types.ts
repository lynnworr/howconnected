import type {
  ContactEmailConfiguration,
  ContactRateLimiter,
} from "./contact-types.ts";

export const WIDGET_REQUEST_SCOPES = ["one_widget", "ongoing_use"] as const;
export type WidgetRequestScope = (typeof WIDGET_REQUEST_SCOPES)[number];

export const WIDGET_COMMERCIAL_INTEREST = [
  "occasional_custom",
  "ongoing_publishing",
  "maybe_price",
  "not_currently",
] as const;
export type WidgetCommercialInterest =
  (typeof WIDGET_COMMERCIAL_INTEREST)[number];

export const WIDGET_REQUEST_SCOPE_LABELS: Record<WidgetRequestScope, string> = {
  one_widget: "One widget",
  ongoing_use: "Ongoing publishing use",
};

export const WIDGET_COMMERCIAL_INTEREST_LABELS: Record<
  WidgetCommercialInterest,
  string
> = {
  occasional_custom: "Yes, for occasional custom connections",
  ongoing_publishing: "Yes, for ongoing publishing use",
  maybe_price: "Maybe, depending on price",
  not_currently: "Not currently",
};

export type WidgetRequestSubmission = {
  publisherName: string;
  email: string;
  websiteUrl: string | null;
  requestedConnection: string;
  intendedUse: string;
  requestScope: WidgetRequestScope;
  commercialInterest: WidgetCommercialInterest | null;
};

export type WidgetRequestDependencies = {
  configuration: ContactEmailConfiguration | null;
  rateLimiter: ContactRateLimiter | null;
  deliver(
    configuration: ContactEmailConfiguration,
    submission: WidgetRequestSubmission,
  ): Promise<{ id: string }>;
};
