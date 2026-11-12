# LeadPulse free-trial launch gates

Updated 2026-11-12. This is an engineering release checklist, **not evidence that the service is commercially launched**.

## Verified live
- Cloudflare Worker + D1 deployed; static public preview works; browser and assets bound.
- GitHub Actions token, account and D1 identifiers configured; D1 migrations 0001 and 0002 deployed.
- Privacy-preserving customer analytics, attribution and daily GitHub Actions metrics report deployed.
- Real D1 baseline on 2026-11-12: 0 registered, 0 onboarded, 0 activated, 0 monitored customers.
- Public signup, monitoring and all paid checkout remain disabled.

## Mandatory before public accounts
- [ ] A sender-controlled domain and properly authenticated transactional email domain; configure Resend `RESEND_API_KEY`, `EMAIL_FROM`, `PUBLIC_URL` via Worker secrets/config. Do not publish credentials.
- [ ] Verified actual email delivery, sender authentication and bounce handling; account recovery tests.
- [ ] Turnstile or comparable signup/login abuse controls and rate limiting.
- [ ] Resolve and recheck DNS/IP/private-network/redirect SSRF protections for every ownership and browser check, including rebinding scenarios.
- [ ] Test authorized browser checks against a website that the owner controls; test failure/recovery alerts and quota enforcement.
- [ ] Resolve monitoring scheduling fairness and a meaningful capacity/quotas policy.
- [ ] Review privacy notice, terms, data retention, support contact and regional legal compliance.
- [ ] Security QA: CSRF, XSS, session invalidation, password reset, tenant isolation, trial expiry, replay, throttling and abuse.
- [ ] Only then authorize and flip `PREVIEW_ONLY` / `ENABLE_SIGNUPS` / `ENABLE_MONITORING` in an audited change.

## Capacity warning
Official Cloudflare Browser Run Workers Free pricing in 2026 lists **10 browser minutes/day** (and 3 concurrent browser sessions). An unlimited daily-check offer for many customers is not viable on this tier. The code currently reserves a max 300000 ms (five minutes/day) which does not raise the platform quota. Estimate observed browser seconds per check, optimize cadence and define fair queuing before opening at scale.

Cloudflare D1 Free has enforced daily row read/write limits since Sept 2026; avoid unbounded event logging and use indexes/retention.

## Email
Resend's advertised Free tier (2026-11) is 3,000 emails/month and 100/day, requiring sender/domain setup. This is better for **transactional customer messages**, not bulk prospecting. Keep marketing sending separate and honor eligibility, suppression and opt-outs.

## Paid tiers (not enabled)
Trial 1 site; Solo 1 site, Studio 5, Agency 20 — proposed entitlements. Payment interfaces are inert; no real PayPal keys, checkout or webhooks yet. Price experiments and payment merchant evaluation are deferred.

## Private admin
`GET /admin` is completely closed until a strong `ADMIN_DASHBOARD_PASSWORD` Worker secret is provisioned. When configured, HTTPS Basic Authentication username `admin` is used. Before real customer data is collected, place it behind Cloudflare Access with MFA and rate-limit/WAF rules. Do not put credentials in URLs, GitHub files or logs.

In the interim, view real aggregate customer data via GitHub → Actions → **LeadPulse customer metrics (private)**; it runs daily and supports manual dispatch. It contains no email addresses.

## Outbound marketing
See `docs/ACQUISITION_PLAYBOOK.md`. No LinkedIn activity and no unsupervised cold-email sending; prospect compliance and reviewed sending approval are outstanding.
