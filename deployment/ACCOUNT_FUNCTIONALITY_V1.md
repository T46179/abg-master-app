# ABG Master account functionality v1

Date: 28 October 2026 (Sydney).
Status: implementation plan and acceptance checklist; public account flows are not yet connected.


Current implementation update (31 October 2026): email-first signup, password completion and one shared local account supersede the earlier combined-password proposals below. See `EMAIL_FIRST_REGISTRATION.md`. Historical test evidence is retained; live fresh-signup mail acceptance is pending at the owner's request.

## Purpose and agreed direction

Build the account behaviour before the owner designs the screens. Temporary development forms may exercise the functionality later; they are not final product design.

- Email and password are the intended public sign-in method. Pilot email codes were a convenience for invited friends, not the public product decision.
- Practice remains available without registration, with optional Calibration and all current difficulty access preserved.
- One account should own Practice progress and Exam records within an environment.
- Creating a first account should retain the current anonymous Supabase user ID and its server-saved progress.
- Registration does not grant pilot access, a free Exam allowance or paid access. Those remain separate server decisions.
- The owner has an inbox and intends to use Zoho as the mail sender. SMTP credentials, sender verification and actual Supabase email delivery have not been inspected or changed.
- App development stays on `features`; private backend work belongs in the content repo, coordinated on `exam`. Neither branch implies permission to publish to production.

Working v1 recommendation from the discussion: signing into an already existing account loads that account without automatically merging guest progress. Communicate this before the switch. Preserve ownership of any archived local guest data; do not display it as the signed-in account's progress or promise that an old guest identity can be recovered after its session is replaced. Automatic server-side merging is separate work.

## What exists now

- `src/core/supabase.ts` creates/reuses the Practice client, bootstraps anonymous identity and verifies the user with Supabase.
- `src/app/AppProvider.tsx` loads local state before remote progress, then reconciles server state. It is not yet an app-wide account-switching provider.
- `src/core/storage.ts` stores progress and preferences under several browser-wide keys. Some Practice/Featured drafts already contain ownership checks, but this is not complete account isolation.
- `src/core/examAuth.ts` and `ExamPilotAuthScreen.tsx` implement invitation-only email-code sign-in in a deliberately separate session. Public registration and guest migration are not connected.
- Exam server access checks require a permanent verified account and independently enforce pilot access. Existing attempts/results retain their original ownership.

## Behaviour to build

| Learner action | Expected outcome |
| --- | --- |
| Continue as guest | Keep current Practice behaviour; do not require an account. |
| Create first account | Attach an email to the current guest, verify it, set a password, and keep the same user ID. |
| Verify email | Use an approved callback destination; show success, expiry or retry without creating a replacement identity. |
| Finish interrupted registration | Resume password setup with verified ownership. If the session is lost, offer a verified recovery route. |
| Sign in | Verify email/password through Supabase, load that account's saved data and return to the intended internal activity. |
| Email already registered | Offer sign-in/recovery; never overwrite the existing account or automatically migrate records. |
| Forgot password | Request a recovery email with a neutral response, including for unknown email addresses. |
| Follow recovery link | Establish the recovery context, choose a new password and recover the same account. Handle used/expired links. |
| Change password | Use a verified signed-in account and Supabase's configured reauthentication requirements. |
| Sign out | Save eligible pending drafts first; remove the account's visible state. Continue as a fresh guest when requested. Server history stays with the account. |
| Temporary network failure | Show retry/unavailable state; do not discard identity or issue another user's pending work. |
| Sign in on another device | Retrieve server-saved records. Do not promise that all device-only preferences or unsaved drafts follow the account. |

Email changes and account deletion need defined support paths before launch; self-service screens are outside the initial implementation slice. Password rules and recent-sign-in requirements must match the actual Supabase configuration. Do not invent a separate client-only password policy.

## Registration and callbacks

Supabase documents attaching an email to an anonymous user with `updateUser({ email })`, then verifying the email before setting the password with `updateUser({ password })`. Manual identity linking must be enabled. This is the candidate implementation; it has not been proven against this project's staging settings.

The proposed learner sequence is email -> verification link -> choose password -> return to the intended activity. Never store a password while waiting for verification. Do not replace guest conversion with `signUp()` and assume history will follow.

Before connecting this flow, prove these details in staging:

1. The user ID before conversion equals the ID after verification and password setup.
2. The email-change template and verification callback work for anonymous conversion, not only ordinary new-user signup.
3. Refresh, interrupted setup and opening verification in another browser have explicit recovery behaviour.
4. Existing-email conflicts do not create a duplicate account or change ownership.
5. Password reset recovers the same permanent account.

Use a dedicated callback boundary before normal Practice bootstrap. Verification/recovery processing must finish before any anonymous session creation. Restrict callback purposes and return destinations; never accept an arbitrary external return URL. Do not log passwords, recovery/verification tokens or session credentials, including through analytics, replay or error reporting. Remove sensitive callback values from the visible URL after processing. The exact callback mechanism must be selected and tested against the installed SDK and staging templates.

Do not infer whether a password was set from editable user metadata. Track the immediate operation result for the current flow; use a verified setup/recovery path after interruptions. A password-completion hint is not an entitlement.

## Shared identity and storage boundaries

- Use one authoritative account provider/client per environment. Preserve staging/production isolation; do not combine users or sessions across projects.
- Keep the existing pilot's isolated session until the shared-account transition and its compatibility path are tested. Do not simply rename its storage key and strand existing testers.
- The shared state must distinguish checking, guest, verification/setup pending, verified account, signed out and temporarily unavailable. Verification and Exam permissions remain separate facts.
- An identity change must invalidate outstanding requests and pending writes before loading the next user's state. Late responses from the old identity must be ignored.
- Scope account-owned local state by environment and user ID. Migrate legacy browser-wide data only when ownership can be established; do not import it into whichever account happens to sign in first.
- Device preferences such as display settings may remain device-wide by explicit choice. Progress, answer drafts, completed-result caches and pending submissions require ownership.
- Keep completed submissions attached to their original identity. Signing out/switching accounts must never resubmit them under a different user.
- Sign-out should normally affect the current browser session, including its tabs. Other-device revocation and recovery-session behaviour must be tested and stated separately.
- Account creation/verification does not modify historical Exam snapshots, attempts, grades or feedback.

## Implementation order and evidence

### 1. Protect saved identity (first local code slice)

Implemented locally in `supabase.ts`: unsuccessful session reads, temporary/unknown user-verification failures and invalid permanent/unknown identities return unavailable without signing out or creating another guest. Only an explicitly anonymous existing session with a definitive 401/403 verification failure may attempt one local guest recovery. Failed local sign-out prevents replacement. A new guest is verified before being returned.

Local validation: 43 focused authentication tests passed, followed by all 947 app tests across 94 files; TypeScript and Git whitespace checks passed. These are mocked/local checks, not live registration acceptance. This first fix does not add an account menu, shared provider, callback route, public registration or email delivery.

### 2. Staging proof of conversion and recovery

Inspect relevant Auth settings and email templates without printing credentials. Use disposable staging identities and the owner's test inbox for the actual email walkthrough. Record only safe outcomes and identity/preservation checks. Do not send to existing testers, change their credentials or alter pilot access. Coordinate SMTP/settings changes explicitly once the exact configuration is known.

### 3. Account service and shared state

Build password sign-in, guest email attachment, password setup/change, recovery and sign-out operations behind a shared account interface. Add account ownership and stale-response handling before mounting the new interface in the ordinary app. Use focused tests for identity transitions and isolation.

### 4. Development walkthrough

Expose temporary development-only forms for the complete journey, including callbacks and interrupted operations. Use the proven field/state requirements to give the owner a simple screen checklist. Do not promote test forms to final design.

### 5. Final UI and release preparation

Connect owner-designed screens; run staging acceptance; verify SMTP delivery and sender, callback destinations, password/session settings and recovery. Deploy production only as a separate release decision. Payments, sample reservations, allowances and entitlements remain later work.

## Acceptance checklist (pending unless evidence above says otherwise)

- [ ] Guest -> verify -> password retains the same user ID, calibration, Practice history and progress.
- [ ] Guest can continue using Practice while registration is pending.
- [ ] Invalid/expired/used verification link and resend have clear recovery behaviour.
- [ ] Refresh/interruption before and after verification does not strand password setup.
- [ ] Another browser can complete the supported verification/recovery route safely.
- [ ] Password sign-in on another device loads the correct server-saved progress.
- [ ] Existing-email conflicts never overwrite an account; v1 does not merge guest history.
- [ ] Password reset works; unknown-email responses do not disclose account existence.
- [ ] Expired reset links can be retried; recovery does not create another identity.
- [ ] Password changes and configured session revocation have the tested intended effect.
- [ ] Sign-out/account switching clears old visible state before loading new state, including across tabs.
- [ ] Old requests/drafts/pending submissions cannot modify the next account.
- [ ] Unowned legacy local state is not silently assigned to an unrelated account.
- [ ] Network failure never silently replaces an existing account.
- [ ] Pilot tester IDs, grants, history and owner preview remain unchanged.
- [ ] Uninvited verified accounts still cannot start pilot Exams.
- [ ] Staging and production sessions/data never cross environments.
- [ ] Callback tokens/passwords are absent from logs, analytics and replay.
- [ ] Final owner UI review and actual mail delivery/recovery walkthrough complete.

## Documentation checked

- [Anonymous identity conversion](https://supabase.com/docs/guides/auth/auth-anonymous#convert-an-anonymous-user-to-a-permanent-user)
- [Password authentication and recovery](https://supabase.com/docs/guides/auth/passwords)
- [Server user verification](https://supabase.com/docs/reference/javascript/auth-getuser)

These describe supported behaviour, not this project's live configuration. No hosted settings or production resources were changed in the first local slice.

## Staging preflight: 28 October 2026

Read-only checks confirmed the target is the healthy ABG Master staging project. Its public Auth settings permit signup, enable anonymous and email authentication, and require email confirmation (`mailer_autoconfirm=false`). These settings do not establish that anonymous conversion, password setup or actual mail delivery works.

The owner-supplied test address already belongs to one verified staging account. No email was sent and no existing account, credentials or access grants were changed. A fresh inbox/working alias has been requested for the first guest-to-permanent conversion test. Existing-account sign-in/recovery is a separate test and must preserve this account's history.

The connected Supabase tools do not expose Auth configuration reading. The installed CLI has config push but no config read command. A read-only management request using the inherited process credential returned 401; its raw value was never printed. Manual identity-linking configuration, email templates, callback destinations and Zoho SMTP remain unverified. Do not infer them from the public settings or overwrite settings to make the test pass.

### Owner-requested staging account reset

The alternative inbox also matched an existing staging user. No email was sent to it and no alias account was created. The owner then explicitly requested deleting the original staging account and reusing its address. This supersedes the earlier request for a fresh inbox.

Readback established that the requested account was not the owner-preview account, had no Practice attempts, and had one active Exam attempt plus a pilot grant. Its Exam foreign key prevents a hard delete without removing historical test data. The supported Supabase Admin soft-delete operation removed its sign-in/email identity and sessions while retaining the historical row. Its pilot grant was disabled. No integrity constraints or immutability protections were changed.

Verified after the operation: zero accounts still use the requested email, old account is marked deleted, zero old sessions remain, pilot access is disabled, and its one Exam attempt is retained. Hashes match for all Exam attempts, pilot settings, other pilot grants and all other users' IDs/emails/deletion markers. The address is free for a new staging registration; registration/verification/password tests have not yet run. Production was untouched.

The inherited process management token was expired. Omitting it only for the CLI invocation allowed the existing saved CLI login to retrieve staging API credentials in memory. No credentials were logged or saved. Browser inspection was denied because Brave was not approved for computer use; the reset used the supported Admin API instead.

### Temporary combined-registration proof page

The owner prefers entering email and password together before verification. This is now the preferred journey to prove, superseding the earlier verification-first proposal. Current upstream Auth source permits a combined email/password update for an anonymous user when an email is included; the deployed staging behaviour is still pending the owner's password entry and verification.

`account-staging-test.html` and `src/dev/accountStagingProbe.ts` / `accountStagingTest.ts` provide a standalone localhost-only development test with exact staging/public-key guards and an isolated session. It does not import app bootstrap, analytics or replay. The page upgrades the current guest with one `updateUser({ email, password })` operation, verifies the staging email-change link/code directly without following its redirect, and compares identity plus saved progress after verification/sign-in. Password/link inputs are cleared and never saved by the page. It is a temporary test, not final UI or a shared account provider.

Local checks: 50 focused tests and TypeScript passed; an isolated production build and static case-leak check passed, and the temporary page/client marker is absent from the output. The local page and transformed modules returned HTTP 200. An actual staging guest with a labelled zero-XP Beginner calibration fixture was created through the normal anonymous client/RPC, and the page confirmed saved progress is ready. The owner must enter the test password, submit registration, verify email and sign back in; none of these results is claimed yet. No email templates, SMTP settings, pilot grants or production settings were changed.

### Registration walkthrough: password sign-in unresolved

The owner reports receiving “Confirm Change of Email” from the site sender and no recognised separate verification link/code. Staging Auth v2.197.0 records a successful combined update, an email-change verification GET/303 approximately 32 seconds later, the same now-permanent user with an email identity/password present, and subsequent password sign-in failures (`invalid_credentials`). The verification request used a browser user agent; this does not establish who or what opened the link. Presence of a password and confirmed-email flag does not prove the intended password works or that the owner experienced a complete verification journey. The original registration test remains unresolved; do not mark it passed.

The temporary page now labels the confirmed-email flag as server state, removes the confusing “no guest account was created” failure wording, and offers a separate user-operated recovery section. Nothing requests an email or changes a password automatically. Recovery must verify the original test identity before enabling a password update; unrelated/expired links and different accounts are rejected. 56 focused tests, TypeScript and whitespace checks pass. Live recovery/password sign-in are pending owner interaction. No user account, credentials, mail template, SMTP configuration or production setting was changed by this investigation.

### Recovery and subsequent password sign-in verified

The owner completed the separate recovery walkthrough. Staging audit/log readback confirms recovery requests, verification, password update, sign-out, then a successful password login (HTTP 200) to the original test identity `86c296bf-28d8-417f-8a78-8e5c08b32529`. The saved progress remains Beginner calibration, XP 0, level 1, streak 0 and no completed cases; its update timestamp is still the original fixture timestamp. No replacement identity or new progress record was needed.

This verifies the recovery/password-login happy path and retained test progress. It does not explain the first registration-password failure, prove a fresh registration journey without recovery, or cover expired links, cross-device completion and all account-switching cases. Those remain pending. Production and hosted configuration remain unchanged.

### First site-wide account foundation (local only)

Added `siteAccount.ts`, `SiteAccountProvider.tsx` and `accountBrowserStorage.ts`. They provide one verified identity state for app consumers, safe synchronous invalidation on account changes/sign-out, deferred SDK-event verification with stale-response guards, explicit guest continuation, and per-project/per-user cache handles that can be deactivated. Same-ID guest conversion retains the namespace. No legacy cache is automatically assigned to a newly signed-in account; no permission or entitlement is inferred from identity.

The real AppProvider and Practice, Featured Case, Learn, public unit preference and Exam storage consumers now support an account-owned workspace. Identity changes retire storage/request handles immediately and remount the whole workspace; same-ID guest conversion retains it. Data requests check the captured owner before using the canonical session. Late hydration, submissions and calibration retries cannot adopt the next account. Legacy unowned storage is left intact and is not imported.

`npm run dev:account-staging` runs the actual app at `http://127.0.0.1:5185/` with temporary email/password, guest and site-wide sign-out controls. It uses a separate staging session and a fixed staging bootstrap proxy, with analytics/replay initialization disabled. `/exam` uses the site identity and existing server access checks; a verified login does not grant pilot access. The mode is development-only and cannot be built for deployment. Ordinary production and legacy pilot entry points retain their current account behaviour.

Validation: full automated suite (1001 tests at the first integration checkpoint), TypeScript, isolated ordinary production build and static case-leak check passed. Temporary controls and their staging session marker are absent from that build. Live browser checks confirmed guest creation, staging bootstrap loading, a real protected Beginner Practice case, and the guest Exam sign-in gate. An additional integration test covers a calibration retry finishing after an account switch. No case was completed and no pilot access was granted. The owner's existing-account sign-in across both areas remains a manual acceptance step; clickable email callbacks and a fresh registration without recovery remain outstanding. No hosted settings or production deployment changed.
