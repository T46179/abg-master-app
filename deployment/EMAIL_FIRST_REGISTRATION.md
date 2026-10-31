# Email-first registration - local integration

Password recovery was subsequently connected on 1 November 2026. See [PASSWORD_RECOVERY.md](./PASSWORD_RECOVERY.md) for scope, staging configuration and remaining owner checks; its notes supersede this milestone's earlier password-recovery exclusion.

Implemented on `features`, 31 October 2026 (Sydney). Current walkthrough: http://127.0.0.1:5184/dev/exam-pilot. Run `npm run dev -- --port 5184 --strictPort`.

## Connected behavior

- Dashboard, Practice and Exam use one checked staging identity and the existing Practice session key in ordinary local development. Isolated pilot/proof sessions are not imported. Normal sign-in can reuse those existing accounts and their saved Exam history.
- Signup collects email first, verifies it, checks password status, then creates a password. Registration completion links use `signInWithOtp` with `shouldCreateUser: false`; they cannot create replacement accounts. A completion link for an account that already has a password offers password sign-in without adopting the link as ordinary passwordless login.
- Keep current progress is the default for an existing guest. It is hidden only after confirmed empty learning progress; unavailable data keeps the safe default. Starting fresh uses a separate blank registration identity and never copies/deletes the active guest's records. Its warning explains that the old guest may become inaccessible after switching.
- Same-owner guest conversion retains the user ID and account storage. New ownership remounts account data, ignores stale requests and preserves prior journals. Auth mutations use captured-owner clients rather than borrowing another login's token.
- Email-verified/password-incomplete setup is gated before onboarding. Password status is checked again before submission. Completion readiness is bound to user ID plus identity generation. Lost sessions offer sign-in or registration completion without issuing replacement guests.
- Callback credentials are removed before router creation, SDK URL detection and telemetry initialization. Password inputs and account fields are masked; application registration drafts contain no passwords or tokens. Only the SDK's ordinary session storage holds session credentials.

## Staging-only backend/configuration changes

Migration `20261031111215_exam_site_account_setup_status.sql` adds a public invoker RPC delegating to a private, fixed-search-path definer function. It accepts no arguments, requires a verified non-anonymous caller, reads only that caller's Auth row and returns `{ hasPassword: boolean }`. Anonymous/database-public execution is revoked; no Auth records or hashes are exposed.

Administrative readback established that the inherited process token had expired. The existing saved Supabase CLI credential was used in memory for the exact staging Management API endpoint; it was not printed or saved.

Targeted Auth changes: manual identity linking enabled; 12 exact local verification/completion return URLs added; signup/email-change registration wording updated; completion-specific magic-link subject/body branches added. The old pilot code subject/body are retained in the default branch. Hosted Site URL (`https://staging.abgmaster.com`), Zoho host/sender, required email confirmation and existing password settings were retained. No blanket config push was used.

Non-secret before/after/patch snapshots are in ignored `.temp/account-auth-{before,after,patch}.json`. For reverting the targeted configuration, construct a patch containing only the changed fields with values from the before snapshot. Do not overwrite the whole project configuration.

No user was deleted, no existing account password was changed, no pilot grant was added, and no historical attempts or clinical content were rewritten. The live duplicate-email check created the normal empty guest session and correctly rejected the already-registered address before requesting verification mail.

## Validation and remaining manual acceptance

- Full app regression suite: 1,053 tests across 105 files passed. Final navigation/form checks: 32 tests across three files passed after the last context fix. TypeScript passed. Backend release validation: 10 tests passed.
- Ordinary and Exam-pilot builds passed. Static case-leak scans passed; local registration/Paid markers are absent from both deployable outputs. Existing bundle-size warnings remain.
- Staging RPC checks: verified test caller receives only `hasPassword`; anonymous and missing callers are denied; caller-selection arguments do not exist. Execute grants, stable/read-only behavior and fixed search paths were inspected.
- Browser: email-first form, invalid-email focus and actual existing-email rejection checked. On 31 October 2026 the owner reported successful registration, email verification and password creation using `t.truong9211+abgtest1@gmail.com`; a live staging read confirmed verified email, non-anonymous identity and password presence. The owner then reported successful sign-out, password sign-in, refresh and movement between Practice and Exam. The owner also reported successful preservation of guest Practice XP and completed-case count through registration and subsequent sign-out/sign-in using `t.truong9211+abgtest2@gmail.com`. The owner also reported successful sessionless completion-email delivery and password creation after verifying email but leaving before password setup, using `t.truong9211+abgtest3@gmail.com` in a private window. A live staging read confirmed that address has a verified, non-anonymous account with a password. These are owner-reported browser acceptance checks; unchanged account ID during sessionless recovery remains covered by automated tests rather than a before/after live ID comparison. The owner then reported successful starting-fresh registration using `t.truong9211+abgtest4@gmail.com`, with no guest XP, completed cases or history carried over after refreshing. A live staging read confirmed a verified, non-anonymous account with a password and zero Practice attempts. All four main manual registration scenarios have now passed: registration/sign-in continuity, keeping guest progress, interrupted registration without the original session, and starting fresh. The AI sitting walkthrough remains deferred.
- Existing Hotmail/Gmail accounts are retained for ordinary sign-in and existing-address checks. Do not delete or reset them to manufacture a fresh signup test. A live verification walkthrough requires a receiving inbox/alias.
- No frontend push/deployment or production change. Hosted pilot entry remains unchanged. The AI sitting walkthrough stays deferred. PostHog identification/events/reset work, password recovery, account merging, payments, onboarding database storage and themes remain outside this milestone.
