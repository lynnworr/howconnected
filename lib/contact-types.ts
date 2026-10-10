export const CONTACT_CATEGORIES = [
  "General Feedback",
  "Bug Report",
  "Feature Suggestion",
  "Business Inquiry",
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

export type ContactSubmission = {
  name: string;
  email: string;
  category: ContactCategory;
  message: string;
};

export type ContactEmailConfiguration = {
  apiKey: string;
  toEmail: string;
  fromEmail: string;
};

export type ContactRateLimiter = {
  consume(key: string): Promise<{ allowed: boolean }>;
};
