# Single-tab account verification

## Scope and status
Account creation and unfinished account setup now accept emailed verification codes in the original ABG Master tab. Password sign-in, password-reset links, existing emailed registration links, pilot grants, content, and the hosted pilot are preserved. This is part of the existing local account preview, not a production authentication release.

The frontend changes are local. The staging template changes have NOT been applied. The user chose to apply them. The available Management API token was rejected with HTTP 401; no Auth settings were changed.

## Apply the staging email templates
Use Node 24, from the frontend repository. Set a valid SUPABASE_ACCESS_TOKEN privately in your terminal; do not paste it into chat, source files, or a VITE_ variable.

1. Run:
   ~~~powershell
   node scripts/registration-code-templates.mjs
   ~~~
   This reads staging project clpfecuohwzwrgmqzeos and prepares a review/rollback JSON file under ignored .temp/registration-code-templates/. Review the proposed content before applying.
2. Run:
   ~~~powershell
   node scripts/registration-code-templates.mjs --apply
   ~~~
   The updater changes ONLY mailer_templates_email_change_content and mailer_templates_magic_link_content, then reads them back to verify.
3. Retain the printed backup path. To roll back, provided nobody has edited the templates since:
   ~~~powershell
   node scripts/registration-code-templates.mjs --rollback <printed-backup-path>
   ~~~

The template condition matches only the existing local account callback URLs for verify/complete and their supported return destinations. Other callers receive their exact previous email content. No subjects, SMTP settings, recovery templates, redirect allowlists, expiry settings, rate limits, or access grants are changed. Already-sent links continue to use the existing credential-scrubbing callback handler.

The updater checks that mailer_otp_exp is 3600 seconds, matching the one-hour UI/email copy. It supports configured code lengths from 6 to 10 digits. If the expiry differs, review the shared Auth expiry and update the copy/configuration deliberately instead of bypassing the check. The 60-second UI resend cooldown complements Auth's server-side limits; it is not an attempt limit or security boundary.

## Test with a real staging inbox
Run the existing staging-configured development preview:
~~~powershell
npm run dev -- --host 127.0.0.1 --port 5184 --strictPort
~~~
1. In a separate browser profile, open /create-account?return_to=trial.
2. Use a fresh email you control and leave Keep my current progress checked.
3. Receive the code, type/paste it into /check-email, and click Verify email. No second ABG Master tab should open.
4. Create the password. Confirm the intended guest account ID/progress is retained.
5. Check a separate fresh-account run with Keep my current progress unticked; the active guest must not be replaced before password completion and explicit account-switch confirmation.
6. Check incorrect/expired/reused codes, resend cooldown, changing the email, refresh before/after verification, and an account change from another tab.
7. Test /finish-account for an existing verified account without a password. Existing password accounts must be directed to sign-in without allowing a password overwrite.
8. Open a previously sent verification link and check existing password-reset links.
9. Pilot access still needs its separate enabled exam_pilot_access row and an open, correctly configured pilot. Code verification does not grant Exam access.

## Implementation notes
- Codes remain in component memory, are masked from analytics/replay/error capture, and are not stored in URLs or local storage.
- Pending metadata stores the owner, email, purpose, destination, and resend deadline, with no code or password.
- Initial email-change verification uses an isolated client bound to the expected guest session. Completion verification uses the isolated persistent pending-setup client so refresh can resume setup.
- Verified identity AND email are checked before staging password setup. The canonical account session is adopted only through the existing password-completion path.
- Old account links/callbacks and recovery-session checks remain supported.
- Concurrent requests are blocked, and superseded requests/account changes fail closed.
- The template bodies and current originals are saved in an ignored local backup, never the whole Auth configuration or SMTP credentials.

## Validation
Typecheck, production build into an ignored temporary directory, and the full app suite passed: 106 test files and 1093 tests. Relevant core and UI tests cover same-tab completion, preserved/fresh progress, target mismatch, invalid/expired codes, refresh, cooldowns, changed email, duplicate requests, and existing-password protection. The template builder has separate tests for scope, fallback preservation, idempotence, and configuration mismatch. A live email test remains necessary after the user applies the templates.