# Private hosted Exam pilot

Cloudflare Pages project: `abg-master-staging`, app repository `T46179/abg-master-app`, branch `features`.
The existing GitHub Pages workflow deploys `main` separately.

Build command: `npm run build:exam-pilot`
Framework preset: None
Output directory: `dist/exam-pilot/`
Root directory: repository root

The 17 November 2026 Exam Builder release uploaded this pilot output directly. On 18 November the hosted `/exam` returned HTTP 200 with `X-Robots-Tag: noindex, nofollow`. For a Git-triggered update, verify that Pages builds the intended `features` revision and serves the pilot output.

Configure these Cloudflare build environment variables (use staging public keys only):

| Name | Value |
| --- | --- |
| `NODE_VERSION` | `22` |
| `VITE_SUPABASE_URL` | `https://clpfecuohwzwrgmqzeos.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Staging public anon key |
| `VITE_EXAM_PILOT_SUPABASE_URL` | `https://clpfecuohwzwrgmqzeos.supabase.co` |
| `VITE_EXAM_PILOT_SUPABASE_ANON_KEY` | Same staging public anon key |

Never put service-role, management, database, or model API secrets in the frontend build.
The build validates that both app and Exam target staging with public keys.
Optional monitoring variables should use staging-specific settings.

This explicit Vite mode includes the connected pilot at `/exam`, redirects `/dev/exam-pilot`
to `/exam`, and leaves development demos excluded. In this mode only, `/exam` skips
Practice calibration so fresh browsers can reach existing-account email-code sign-in directly.
The unified email/password, registration, recovery and Google account flow runs in staging-connected local development.
The hosted build does not generate GitHub Pages' root
`404.html`: Cloudflare's default SPA fallback supports direct links and reloads.
It also generates `robots.txt` and a `noindex, nofollow` response header for staging.
These indexing directives do not provide access control: permanent-account verification,
pilot grants, and the staging backend continue to control Exam data and attempts.

For a new host or domain:

1. Verify sign-in and authorized Exam access using the assigned `pages.dev` URL.
2. In Pages, register the custom domain `staging.abgmaster.com`.
3. At Porkbun, add the CNAME supplied by Pages for `staging` (keep current nameservers).
4. Once HTTPS is active, set staging Supabase Auth's site URL to `https://staging.abgmaster.com`.
5. Check hosted sign-in, reload/recovery, submission/results, and problem reporting.
6. Disable automatic preview deployments for other branches if previews are unnecessary.

Cloudflare references:
- https://developers.cloudflare.com/pages/configuration/serving-pages/
- https://developers.cloudflare.com/pages/configuration/custom-domains/

For each release, scan `dist/exam-pilot/` with `npm run check:static-case-leaks -- dist/exam-pilot` and verify the served asset revision. Record the signed-in browser walkthrough separately from deployment and backend acceptance.
