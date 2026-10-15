export const AD_PLACEMENTS = [
  "after-editorial-connection",
  "explore-between-sections",
  "long-form-after-content",
] as const;

export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export type AdEnvironment = "development" | "preview" | "production";
export type AdConsentState = "unknown" | "denied" | "granted";

export type AdvertisingActivation = {
  enabled: boolean;
  environment: AdEnvironment;
  consent: AdConsentState;
  publisherId?: string;
};

const ADSENSE_PUBLISHER_ID = /^ca-pub-[0-9]{16}$/;

export function isValidAdSensePublisherId(value: string | undefined): boolean {
  return Boolean(value && ADSENSE_PUBLISHER_ID.test(value));
}

export function getAdvertisingActivationIssues(
  activation: AdvertisingActivation | undefined,
): string[] {
  if (!activation) return ["Advertising activation was not explicitly configured."];

  const issues: string[] = [];
  if (!activation.enabled) issues.push("Advertising is disabled.");
  if (activation.environment !== "production") {
    issues.push("Advertising is limited to the production environment.");
  }
  if (activation.consent !== "granted") {
    issues.push("Advertising consent has not been granted.");
  }
  if (!isValidAdSensePublisherId(activation.publisherId)) {
    issues.push("A valid AdSense publisher ID is required.");
  }
  return issues;
}

export function canRenderAdvertising(
  activation: AdvertisingActivation | undefined,
): boolean {
  return getAdvertisingActivationIssues(activation).length === 0;
}
