# Exam account integration

## Current entry points — 18 November 2026

- Run `npm run dev -- --port 5184 --strictPort` and open `http://127.0.0.1:5184/dev/exam-pilot`. Configure both `VITE_SUPABASE_*` and `VITE_EXAM_PILOT_SUPABASE_*` for staging with public keys. Dashboard, Practice and Exam share the verified local account workspace. Email/password, email-first registration, password recovery and Google sign-in are implemented on `features`. The owner confirmed the main email sign-in, registration and password reset scenarios. [Registration evidence](EMAIL_FIRST_REGISTRATION.md) · [Password recovery evidence](PASSWORD_RECOVERY.md).
- Google uses a PKCE return at that exact localhost URL. Create account links Google to the guest, and Sign in goes directly to Google. A different account requires verified guest progress before adoption. Empty guests skip confirmation, while guests with work see the no-transfer warning. An unused Google identity selected on Sign in can create a separate account before the switch prompt.
- Email-code recovery for an already-linked Google identity is gated locally. Set `VITE_ENABLE_LOCAL_GOOGLE_CODE_RECOVERY=true` only after checking that staging delivers a numeric code to a Google-only test account, verifying it returns the same Supabase user ID, and confirming an unused test email creates no user. Until then, the conflict screen offers direct Google sign-in and staying as a guest.
- The local unified journey exposes **About You**, the dedicated three-Unit trial and, for the staging owner in the full setup view, a Unit picker. About You drafts are local and completed profiles are saved to the account on staging. The server enforces trial-only/full grants and trial allowance. The local Paid account switch changes presentation, and ordinary starts require the server's full grant.
- Hosted staging `/exam` uses `ExamPilotAuthScreen.tsx` and existing-account email codes. It shares `ExamPilotRuntime.tsx`, including the new ordinary builder and access checks. The unified sign-in/registration flow, dedicated trial entry and owner Unit picker are wired through local development. [Hosting and build settings](EXAM_PILOT_HOSTING.md).

## Original account UI checkpoint — 30 October 2026

The sections below record the initial visual-port scope. See the entry points above for the subsequent sign-in, onboarding and trial state.

## What is connected

- Real email/password sign-in and local sign-out use the existing staging pilot Auth client and its session key. Existing pilot sessions and owner-scoped recovery journals remain readable. Sessions from the separate account-staging proof app are not imported.
- Guest trial introduction, account menu, conditional onboarding and trial setup use the Figma Make reference. Current ABG Master hero, headings, cards, controls and clinical content are retained.
- Onboarding drafts/completion are local, validated and keyed by staging project origin, verified user ID and schema version 1. They do not affect question selection or grading.
- Free setup requests the independently configured three-case trial paper within existing pilot permissions. Paid account exposes existing server-permitted setup options. This toggle is presentation only, disabled during an active sitting, and resets on sign-out/account change (also on a full reload).
- Existing AI runtime, feedback, history, Error Log and recovery remain in use. Recoverable work takes precedence over onboarding. Dedicated trial attempts now reserve the account allowance at accepted submission and consume it after valid saved grading; standard pilot attempts do not consume it.
- Identity changes hide old private UI immediately, retire request/storage handles, and preserve journals under the original owner. Sign-out warns when unfinished work exists. Reauthentication only offers that account's recovery.

## Intentionally deferred

Registration, email verification/link outcomes and password recovery have visual layouts with truthful unavailable messages. Their actions do not send email, change credentials or simulate success. Passwords are cleared after sign-in submission and are never saved by these pages. Account fields/menu are masked from capture.

The initial account UI work did not include backend deployment. The later invited staging lifecycle release adds trial allowance enforcement and explicit grant scope. Payments, real paid-product enforcement, backend demographic storage and theme controls remain separate.

## Hosted boundary

`staging.abgmaster.com/exam` keeps its current pilot entry flow. Ordinary production `/exam` is unchanged. The new component, CSS, onboarding questionnaire and Paid account control are reachable only through the local development route and excluded from both deployable builds. Earlier uncommitted account-foundation work remains in this checkout.

## Validation

- Full app suite: 102 files, 1024 tests passed. Focused account, storage, route/navigation and ownership tests cover delayed authentication, denied pilot permission, conditional questions, obsolete records, sign-out/account switching, late responses, expired sessions and recovery precedence.
- TypeScript passed. Both isolated ordinary and Exam-pilot builds passed, along with static case-leak and development-control marker checks. Git whitespace checks passed.
- Browser: existing-account password sign-in and refresh verified against staging. Paid presentation remains unable to start an exam for that account, and real sign-out returns to Guest with account details hidden. The account without pilot permission receives the correct access message. Desktop account layout and phone-sized onboarding layout checked; incomplete onboarding focuses the first unanswered question.
- Complete live AI-marked sitting, feedback/history and real-account recovery walkthrough remain pending at the owner's request. The signed-in test account lacks pilot permission; no access was granted to force the test through. Automated runtime/recovery regressions pass.

Figma reference source was successfully obtained through the current desktop Figma connection after login. The source export is retained locally under ignored `.temp/figma-account-source-20261030`; no Figma theme or mock account logic was imported.
