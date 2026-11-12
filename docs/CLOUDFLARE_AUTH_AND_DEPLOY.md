# Cloudflare preview deployment checklist

> The app is not live until the Cloudflare Worker is deployed and `/health` returns database "ok".
> Publish only with `PREVIEW_ONLY=true`, `ENABLE_SIGNUPS=false`, `ENABLE_MONITORING=false`, and `BILLING_ENABLED=false`.

## Preferred: scoped API token with GitHub Actions

1. Sign in to [Cloudflare](https://dash.cloudflare.com/), open your account dashboard and copy its Account ID. Do not paste credentials in tickets or chat.
2. Under **Workers & Pages → D1**, create a database named `leadpulse-db`; copy the database UUID.
3. Under **My Profile → API Tokens**, create a narrowly scoped Cloudflare API token with permission to edit Workers scripts, D1 databases and required deployment resources on **only your account**. Don't use the Global API Key for GitHub Actions.
4. In this repository open **Settings → Secrets and variables → Actions**:
   - Add repository **secret** `CLOUDFLARE_API_TOKEN` with your scoped token.
   - Add repository **variable** `CLOUDFLARE_ACCOUNT_ID` with the account ID.
   - Add repository **variable** `LEADPULSE_D1_DATABASE_ID` with your D1 UUID.
5. From **Actions → Deploy LeadPulse preview → Run workflow** initiate the first deployment. It runs tests, applies D1 schema migrations and publishes the Worker using the safe read-only flags.
6. Verify `https://<worker-name>.<workers-subdomain>.workers.dev/health` returns HTTP 200 and `{\"database\":\"ok\",\"preview\":true,\"checkout_enabled\":false}`. Confirm pricing, help, privacy and terms pages load; signup and billing must remain blocked.

## Connection troubleshooting

The existing Composio `cloudflare` connection reported ACTIVE but Cloudflare rejected the account lookup with errors `6003` / `6103` (invalid `X-Auth-Key` format). This is an API authentication mismatch, **not evidence that the Worker exists**. Cloudflare API Tokens are usually sent in `Authorization: Bearer` while Global API Keys use `X-Auth-Email` + `X-Auth-Key`. Do not reveal secrets in ChatGPT or check them into GitHub.

If you want deployments managed through Composio instead of GitHub Actions, correct the Cloudflare connection with the credential type required by that toolkit, then validate `CLOUDFLARE_LIST_ACCOUNTS` before attempting D1 or Worker changes.

## Production gating

The current preview is not a customer-ready paid SaaS. Before opening registration, finish transactional-email sender verification, legal notices, access logging, rate limits, DNS/IP safety for monitored websites, real browser testing on authorized sites, and independent payment-provider verification. The signup and billing flags must remain disabled until these checks pass.
