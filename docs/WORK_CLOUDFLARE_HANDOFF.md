# Cloudflare authentication and deployment — browser handoff

Status as of 2026-11-12 (Asia/Kolkata).

## Verified state
- LeadPulse repository: `saurav76/leadpulse-cloudflare`, private, branch `main`.
- Cloudflare toolkit connection in Composio reports ACTIVE, but the actual `CLOUDFLARE_LIST_ACCOUNTS` call fails: HTTP 400, Cloudflare errors `6003` / `6103`, "Invalid format for X-Auth-Key header".
- The connection being ACTIVE means credentials were stored; it does **not** mean the upstream API accepts them.
- Cloudflare Worker and D1 database are **not verified as deployed**. Do not report a live URL without independently checking it.
- Repository has `.github/workflows/deploy-preview.yml` (manual dispatch) and `wrangler.jsonc`.
- Default config is preview-only: `PREVIEW_ONLY=true`, `ENABLE_SIGNUPS=false`, `ENABLE_MONITORING=false`, `BILLING_ENABLED=false`.

## Interactive Work / Cloud Browser instructions
1. Sign in to the user's own Cloudflare dashboard using normal secure login; user handles any OTP, credential, or account verification. Do not display or copy secrets into chat or repository.
2. Diagnose the currently connected Composio Cloudflare auth configuration. `X-Auth-Key` + `X-Auth-Email` uses a **Global API Key**; a scoped **API Token** must be sent as `Authorization: Bearer`. Do not enter a scoped API Token into a Global API Key field.
3. Prefer a scoped Cloudflare API Token. If Composio's `cloudflare` toolkit cannot authenticate with a scoped Bearer Token or its auth config cannot safely be changed, **do not request/use a Global API Key merely to make Composio work**. Document the connector limitation and proceed with scoped GitHub Actions deployment.
4. In Cloudflare, identify the correct Account ID and create a D1 database named `leadpulse-db` if it does not exist. Do not create duplicates. Note its UUID for repository configuration, but never expose tokens.
5. Create a least-privilege Cloudflare token suitable for Workers + D1 deployment on the intended account (review Cloudflare's latest permissions documentation). In private GitHub repo → Settings → Secrets and variables → Actions:
   - repository secret `CLOUDFLARE_API_TOKEN` = restricted token
   - repository variable `CLOUDFLARE_ACCOUNT_ID` = account ID
   - repository variable `LEADPULSE_D1_DATABASE_ID` = D1 database UUID
6. Under GitHub Actions run `Deploy LeadPulse preview`. It installs dependencies, runs tests, substitutes the D1 UUID in config at build time, applies remote migrations and deploys to Workers. Inspect its logs; do not infer success from dispatch.
7. Verify the publicly accessible `/health` endpoint returns HTTP 200 and `database: "ok"`, `preview: true`, `checkout_enabled: false`. Test `/`, `/pricing`, `/help`, `/privacy`, `/terms`, and that `/signup` and `/billing` remain blocked.
8. Leave account signup, real monitoring and billing disabled until provider email, SSRF/network protections, and payment compliance are independently validated.

## Return-to-Chat handoff
Record nonsecret status here or in a new `docs/DEPLOYMENT_STATUS.md`:
- Cloudflare Composio API lookup (PASS/FAIL, error if any)
- GitHub workflow run URL and conclusion
- D1 database existence and migration success
- Public Worker URL and actual `/health` response
- Remaining blockers and next required approvals
- Never include raw Cloudflare token, Global API Key, passwords, OTPs, or GitHub secrets.

Reference documents:
- https://developers.cloudflare.com/fundamentals/api/troubleshooting/
- https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- https://docs.composio.dev/kb/guide/platform-connected-accounts
