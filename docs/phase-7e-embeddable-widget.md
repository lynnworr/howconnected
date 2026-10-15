# Phase 7E — Embeddable connection widget pilot

## Product strategy

The pilot establishes free, branded widgets as the distribution layer. They should remain useful without an account: a reviewed relationship, visible evidence, and a clear route back to HowConnected.

Potential paid capabilities, after publisher interviews and usage validation:

- Styling and customization: controlled themes, logo placement, and typography. This requires authenticated publisher settings, brand-safety review, and billing.
- Publisher analytics: aggregate impressions, interactions, and referral outcomes. This requires publisher accounts, tenant-scoped event storage, retention controls, privacy review, and billing.
- Higher-volume usage: contractual request limits, caching guarantees, uptime targets, and support. This requires metering, quotas, abuse controls, observability, authentication, and billing.
- Commercial licensing: rights and attribution terms for high-traffic or white-label distribution. This requires legal validation, customer agreements, and account administration.
- API products: approved-snapshot discovery and retrieval, never unrestricted graph access by default. This requires API keys or OAuth, rate limiting, versioned schemas, audit logs, documentation, and billing.

Do not introduce subscriptions until the pilot demonstrates repeat publisher demand, acceptable embed performance, and a clear privacy-preserving analytics model.

## Deployment notes

No production settings are changed by this phase. Deploy through the existing application pipeline after reviewing the diff and completing manual browser QA. The routes are static and require no new environment variables, database migrations, credentials, or third-party services.
