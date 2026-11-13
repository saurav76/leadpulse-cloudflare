# LeadPulse — Cloudflare-native SaaS (pilot)

LeadPulse is a website-form visibility monitor for authorized site owners and digital agencies. This repository contains a Cloudflare Workers + D1 implementation; the hosted **preview** is intentionally read-only. Pricing is illustrative. No payment gateway or live subscriptions are enabled.

## Architecture

- Cloudflare Worker: landing site, authentication, dashboard and API routes
- Cloudflare D1: persistent customer records, authorization tags, checks, usage and billing event records
- Cloudflare Browser Run: Chromium/Playwright for read-only **form presence** checks; never sends leads
- Cloudflare Cron Trigger: one due-site check per scheduled invocation (when enabled)
- Resend: optional account verification and alert delivery (requires verified sender and credentials)

## Safety and scope

- Default `PREVIEW_ONLY=true` closes all signup, login, dashboard and billing routes.
- Defaults `ENABLE_SIGNUPS=false`, `ENABLE_MONITORING=false`, `BILLING_ENABLED=false`.
- Production onboarding requires email delivery, anti-SSRF defense, abuse prevention, legal notices and actual external service tests.
- Domain ownership is demonstrated by the `leadpulse-verification` HTML meta tag. A valid tag is rechecked before browser visits.
- The monitor only checks whether the configured form appears. It does **not** submit a test lead or verify inbox delivery.
- Plan tiers are coded as trial (1 site), Solo (1), Studio (5), Agency (20). Paid access must not be turned on manually without verified payment integration.
- D1 free tier storage is durable, but Browser Run time is metered and not suited for unrestricted high-frequency checking.

## Local tests

```sh
node --test tests/*.test.js
```

## Provisioning and deployment

1. Create a free Cloudflare account and a D1 database named `leadpulse-db`.
2. Update `d1_databases[0].database_id` inside `wrangler.jsonc` with the **actual** D1 UUID. Never deploy with `REPLACE_WITH_D1_DATABASE_UUID`.
3. Install Node.js 20+ and dependencies: `npm install`.
4. Apply migrations: `npx wrangler d1 migrations apply leadpulse-db --remote`.
5. Deploy: `npx wrangler deploy`.
6. Visit `https://<worker-name>.<subdomain>.workers.dev/health` and expect `{ "service": "leadpulse", "database": "ok", "preview": true, "checkout_enabled": false }`.
7. Validate `/`, `/pricing`, `/help`, `/privacy`, `/terms` and confirm `/signup`, `/dashboard`, and `/billing` do not allow user creation or payments in preview.

**Important:** Do not create an empty Worker without attaching the D1 `DB` binding and the `ASSETS` binding; `/health` will return 503 and styling may fail. Cloudflare CLI deployment is the recommended route because the project contains multiple modules and static assets.

## Production readiness blockers

- Cloudflare account permission must allow D1 provisioning, Worker deployments, and Browser Run binding.
- Verify account email sender with a transactional email provider, add support contact, complete privacy/terms and retention controls.
- Implement DNS/IP-based SSRF restrictions, redirect protections, per-user usage quotas, notification deduplication, expiry cleanup, and scheduled-job fairness.
- Test account flows against real D1, Browser Run and Resend services.
- Select a legally supported merchant/payment provider; complete merchant onboarding, webhook verification, subscriptions and real payments in sandbox before production.

**Status:** source ready for pilot preview; not a deployed or verified paid service. No private API keys belong in the repository.

## Open source and contributions

The code in this repository is available under the [MIT License](LICENSE). Contributions are welcome under the [contributing guide](CONTRIBUTING.md); report suspected vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

**Early-stage warning:** This is a pilot implementation, not a production-ready monitoring or billing service. Keep API tokens in deployment secrets, verify ownership of monitored websites, and complete the security and service-readiness gates above before accepting customer registrations or payments.
