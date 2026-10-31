# Password recovery - local staging integration

Implemented on `features`, 1 November 2026 (Sydney). Use the existing local testing path: http://127.0.0.1:5184/dev/exam-pilot. The same account views use query parameters on this path.

## Connected flow

- Sign in -> Forgot password -> email request -> Supabase reset email -> new password -> explicit password sign-in.
- Requests use `resetPasswordForEmail` through an isolated client. Unknown addresses receive the same neutral confirmation; requests never create accounts.
- A reset callback carries a one-time token hash, distinct from registration's session callbacks. The hash and provider error details are removed before the router, monitoring and analytics load. Existing access-token sessions are rejected for password reset even when their URL is relabelled as recovery.
- Reset session credentials remain only in the isolated client's memory, with session persistence, URL auto-detection and automatic refresh disabled. The cleaned URL retains `account=reset`, so refreshing offers a new reset email rather than treating an ordinary signed-in session as reset authorisation.
- Auth must first successfully consume the emailed token through `verifyOtp({ token_hash, type: "recovery" })`. Only this server-verified exchange creates a private, in-memory recovery grant. Its returned user ID and session ID bind the isolated client. Subsequent checks require that same verified non-anonymous user, session ID, staging issuer, authenticated role and future expiry. An existing OTP or password session cannot create this grant. The AMR label is not used as proof of recovery purpose.
- New password and confirmation use the existing fields, masked inputs, privacy attributes, validation and focus handling. No password is recorded in registration snapshots, drafts or application storage.
- Account identity and recovery proof are checked again before submission. Stale operations cannot display success, sign out a new owner or install a previous identity's session.
- Supabase updates the same Auth user; application progress, journals and histories are not rewritten or merged. The server's password-update flow removes the account's other sessions and outstanding one-time tokens. The isolated recovery session is then signed out. Already-issued access tokens follow Supabase's standard JWT expiry behaviour.
- If the recovered account is also the current local account, its local sign-in is cleared. A different active account stays in place. Reset success offers explicit sign-in, with confirmation before switching from another account.
- Sign-in completion is published through the shared controller so it survives the workspace remount that accompanies account changes. Registration completion still refuses to overwrite an existing password.
- Expired, reused, invalid, weak-password, same-password and request-failure paths offer clear retry actions without simulated success.

## Staging configuration

Only the following staging Auth fields changed:

1. `uri_allow_list`: six exact local `account_action=reset` return URLs added for the existing destination allowlist.
2. `mailer_subjects_recovery`: Reset your ABG Master password.
3. `mailer_templates_recovery_content`: ABG Master wording. Six exact local recovery destinations now receive a direct application link with `#token_hash={{ .TokenHash }}&type=recovery`; the app verifies this through Supabase's standard recovery API. The default template retains its existing ConfirmationURL behavior for other destinations.

A targeted Management API patch used the existing saved Supabase CLI login in process memory. No credential was printed or saved. Non-secret configuration snapshots are in ignored `.temp/password-recovery-auth-{before,patch,after}.json`; the helper permits only the three fields above. Readback matched the patch and all other inspected settings.

The hosted Site URL, SMTP/Zoho sender, pilot OTP and signup templates, password requirements and registration-completion flow were retained. No new database migration, Edge Function, dependency, account deletion or pilot grant was required. No frontend push/deployment or production change was made. Local controls remain excluded from both deployable builds.

## Reset-link correction after owner testing

The owner received the initial email but its valid link was rejected with "Open a valid password-reset email to change your password." The initial implementation incorrectly required `amr.method=recovery`. Staging health confirmed Auth v2.197.0, and its matching `verify.go` source issues implicit recovery sessions with the generic `otp` method. Read-only staging session metadata confirmed `otp` for the test account.

Automatic approval review rejected broadening the old access-token check to generic OTP sessions, because a regular email-link session could be relabelled using a URL parameter. That change was not applied. The implemented alternative uses the documented server-verified, one-time recovery exchange and a private grant bound to the returned user/session. Tests cover rejection of relabelled existing sessions, failed/expired exchanges and replacement of the bound session. No authentication setting was weakened and no service-role client was introduced.

A follow-up recovery-template-only staging patch was read back successfully. All other inspected settings were unchanged, including SMTP, password rules and pilot/signup/completion templates. Non-secret snapshots are in ignored `.temp/password-recovery-token-auth-{before,patch,after}.json`. A fresh email is required because earlier links use the old format and may already be consumed. The failed validation did not change a password.

References: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp), [matching Auth source](https://github.com/supabase/auth/blob/v2.197.0/internal/api/verify.go).

## Validation

- Final full app regression after the server-verified recovery correction: 1,075 tests across 105 files passed.
- After the reset-link correction, 60 focused account/workspace/callback tests passed. TypeScript passed.
- Ordinary and Exam-pilot builds passed. Static case-content scans and local-control exclusion checks passed. Existing bundle-size warnings remain.
- Browser: request layout, required-email focus and reset callback error/URL cleanup checked locally. A real staging reset request for a confirmed unregistered `example.invalid` address showed the neutral confirmation; database readback confirmed no account was created. No receiving inbox was used for this check. After the correction, a deliberately invalid one-time hash was submitted through the real staging recovery-verification endpoint and the browser displayed the expired/used-link retry message; the hash was removed from the URL before application startup.
- On 1 November 2026 the owner reported that the corrected email link successfully opened password setup, the password was changed, and password sign-in succeeded. A live staging readback matched the before-reset account ID and all captured progress fields: 120 XP, level 4, one completed case and one saved Practice attempt. The owner subsequently confirmed that the old password was rejected and the new password still worked. The main email/reset/password-sign-in flow, old-password rejection and account/progress continuity are passed. Genuine used-link replay, private-window reset and the different-active-account scenario remain manually unconfirmed; relevant automated checks remain passing. No real password was entered or changed by the agent.

Before-reset staging readback for the proposed owner test: `t.truong9211+abgtest2@gmail.com` has 120 XP, one completed case and one saved Practice attempt. The non-secret ID/progress baseline is saved in ignored `.temp/password-recovery-progress-before.json` and the matching after-reset readback is saved in ignored `.temp/password-recovery-progress-after.json`.

## Owner walkthrough

1. At the local test page, sign out and choose Sign in -> Forgot password.
2. Request a fresh reset for `t.truong9211+abgtest2@gmail.com` after this correction; use the newest email.
3. Open the latest email from `hello@abgmaster.com`, titled Reset your ABG Master password.
4. Set a different password, then sign in with it. Confirm the old password fails and the account's Practice progress is retained.
5. Reopening the used email link should offer a new reset request. A reset initiated in one browser must also work when its emailed link is opened in a private window.
6. When another account is active, opening the reset link must identify the reset email and preserve the current account until an explicit password sign-in switch.

The earlier AI sitting walkthrough remains deferred. Payments, entitlements, profile backend storage, new analytics and theme work remain outside this change.
