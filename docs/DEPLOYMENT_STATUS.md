# LeadPulse Cloudflare deployment status

Last verified: 2026-11-12 (Asia/Kolkata)

## LIVE: safe public preview

**Public URL:** https://leadpulse-saas.sauravbasu76.workers.dev

**State:** Deployed and publicly tested as read-only preview, NOT a production-ready paid SaaS.

**Authoritative GitHub Actions evidence:**
- Initial attempt failed due to unsupported Wrangler D1 migration `--yes` argument: https://github.com/saurav76/leadpulse-cloudflare/actions/runs/43270527476
- Corrected migration + Worker deployment: PASS https://github.com/saurav76/leadpulse-cloudflare/actions/runs/43270870963
- Final deployment and independent HTTP smoke tests: PASS https://github.com/saurav76/leadpulse-cloudflare/actions/runs/43271392591
- Last verified commit: `9a8930a4ff7c18a538de4c6f09a9a9aad9dd6c0b`

## Cloudflare infrastructure confirmed

- Cloudflare account: `93e6e96d091641939885376270fa3a7f`
- D1 database: `leadpulse-db` with UUID `a3432eba-14c6-414c-b00c-0707cd7e2408`
- D1 migration `0001_init.sql`: success; Wrangler reported execution of 13 commands.
- Worker: `leadpulse-saas` on `*.workers.dev`, deployed with `env.DB`, `env.BROWSER`, and `env.ASSETS` bindings.
- Static assets: `/styles.css` and `/favicon.svg` uploaded and tested.
- Cron trigger installed (`0 * * * *`), but actual monitoring disabled by flag.

## Independent public HTTP verification (GitHub-hosted runner)

`tests/live-preview.mjs` ran after publish and PASSED:
- `GET /health` HTTP 200, JSON `service="leadpulse"`, `database="ok"`, `preview=true`, `checkout_enabled=false`
- `GET /`, `/pricing`, `/help`, `/privacy`, `/terms`: HTTP 200 and rendered LeadPulse
- `GET /styles.css`, `/favicon.svg`: HTTP 200
- `GET /signup`, `/login`, `/dashboard`, `/billing`, `/sites/add`: HTTP 404
- `POST /signup`: HTTP 404

## Explicit safety limits

- `PREVIEW_ONLY=true`
- `ENABLE_SIGNUPS=false`
- `ENABLE_MONITORING=false`
- `BILLING_ENABLED=false`
- No real user registration, form checks or payment operations are enabled.
- Free-tier quota and commercial rollout remain unverified; do not advertise active monitoring or paid subscriptions yet.
- Legal privacy and terms pages are drafts. Do not open paid customer signup without real policies, sender verification, app security/SSRF review and merchant integration.

## Authentication note

The **GitHub Actions → Cloudflare API Token** path has been verified to authenticate successfully with Cloudflare using Bearer. This is distinct from the **Composio Cloudflare connector**, which previously returned 6003/6103; it has not been independently retested to completion or declared repaired.

The token had previously been pasted into chat. Rotate before enabling production and update the GitHub secret; do not put credentials into source, documentation, or public logs.

## Next release milestones

1. Verify desired brand/custom domain and publish proper legal/support contact policies.
2. Implement and verify production email onboarding and alerts, DNS/IP/redirect SSRF protections, recurring job fairness and quotas.
3. Independently test authorized Browser Run monitoring against controlled test forms and alert delivery.
4. Select an eligible payment merchant, validate test charges/webhooks, implement billing and subscription state transitions.
5. Only then progressively enable signups, monitoring and billing.
