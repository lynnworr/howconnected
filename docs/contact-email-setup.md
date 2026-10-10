# Contact email setup

The `/contact` form sends plain-text email through Resend. It does not store contact messages in Neo4j.

## Resend

1. Create or use a Resend account at `resend.com`.
2. Add a domain owned by the site owner and complete Resend's DNS verification steps.
3. Create an API key restricted to sending email where possible.
4. Choose a sender on the verified domain, for example `HowConnected <contact@howconnected.app>`. Do not use an unverified arbitrary address in production.

## Shared rate limiter

Production contact submissions require a shared Upstash Redis REST database. This prevents each Vercel function instance from maintaining an ineffective independent in-memory limit.

1. Create an Upstash Redis database in a suitable region.
2. Copy its REST URL and REST token.
3. Treat the token as a secret. Do not expose it through a `NEXT_PUBLIC_` variable.

## Vercel environment variables

In the Vercel project, open **Settings > Environment Variables** and add these server-only values for Production and any Preview environment that should send mail:

- `RESEND_API_KEY`: the Resend API key.
- `CONTACT_TO_EMAIL`: the private recipient address for the site owner.
- `CONTACT_FROM_EMAIL`: a verified sender, such as `HowConnected <contact@howconnected.app>`.
- `UPSTASH_REDIS_REST_URL`: the Redis REST endpoint.
- `UPSTASH_REDIS_REST_TOKEN`: the Redis REST token.

After saving the variables, redeploy from Vercel so the deployment receives them. Submit one real test message and confirm that it arrives and that Reply-To uses the visitor's address.

If any email value or either Redis value is missing or invalid, production returns a user-friendly unavailable response and does not claim that a message was delivered. Local development may use a bounded in-memory limiter, but production never relies on it.
