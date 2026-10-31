# Local Exam account integration

Implemented on `features` at `/dev/exam-pilot`. Run the ordinary Vite development server (`npm run dev`); the current walkthrough is at http://127.0.0.1:5184/dev/exam-pilot. There is no new preview URL or simulated identity selector.


Update, 31 October 2026: the subsequent email-first milestone connects registration/password completion and joins the local Practice/Exam identity. See `EMAIL_FIRST_REGISTRATION.md` for current behavior, staging-only changes and pending manual acceptance. The original visual-port checkpoint below is retained for context.

## What is connected

- Real email/password sign-in and local sign-out use the existing staging pilot Auth client and its session key. Existing pilot sessions and owner-scoped recovery journals remain readable. Sessions from the separate account-staging proof app are not imported.
- Guest trial introduction, account menu, conditional onboarding and trial setup use the Figma Make reference. Current ABG Master hero, headings, cards, controls and clinical content are retained.
- Onboarding drafts/completion are local, validated and keyed by staging project origin, verified user ID and schema version 1. They do not affect question selection or grading.
- Free setup requests only the server-permitted three-case pilot path. Paid account exposes existing server-permitted setup options. This toggle is presentation only, disabled during an active sitting, and resets on sign-out/account change (also on a full reload).
- Existing AI runtime, feedback, history, Error Log and recovery remain in use. Recoverable work takes precedence over onboarding. Pilot attempts do not create trial entitlements or trial-consumption records.
- Identity changes hide old private UI immediately, retire request/storage handles, and preserve journals under the original owner. Sign-out warns when unfinished work exists. Reauthentication only offers that account's recovery.

## Intentionally deferred

Registration, email verification/link outcomes and password recovery have visual layouts with truthful unavailable messages. Their actions do not send email, change credentials or simulate success. Passwords are cleared after sign-in submission and are never saved by these pages. Account fields/menu are masked from capture.

Payments, real paid/trial enforcement, backend demographic storage and all theme controls are outside this change. No grants, snapshots, credentials, hosted settings or deployment were changed.

## Hosted boundary

`staging.abgmaster.com/exam` keeps its current pilot entry flow. Ordinary production `/exam` is unchanged. The new component, CSS, onboarding questionnaire and Paid account control are reachable only through the local development route and excluded from both deployable builds. Earlier uncommitted account-foundation work remains in this checkout.

## Validation

- Full app suite: 102 files, 1024 tests passed. Focused account, storage, route/navigation and ownership tests cover delayed authentication, denied pilot permission, conditional questions, obsolete records, sign-out/account switching, late responses, expired sessions and recovery precedence.
- TypeScript passed. Both isolated ordinary and Exam-pilot builds passed, along with static case-leak and development-control marker checks. Git whitespace checks passed.
- Browser: existing-account password sign-in and refresh verified against staging. Paid presentation remains unable to start an exam for that account, and real sign-out returns to Guest with account details hidden. The account without pilot permission receives the correct access message. Desktop account layout and phone-sized onboarding layout checked; incomplete onboarding focuses the first unanswered question.
- Complete live AI-marked sitting, feedback/history and real-account recovery walkthrough remain pending at the owner's request. The signed-in test account lacks pilot permission; no access was granted to force the test through. Automated runtime/recovery regressions pass.

Figma reference source was successfully obtained through the current desktop Figma connection after login. The source export is retained locally under ignored `.temp/figma-account-source-20261030`; no Figma theme or mock account logic was imported.
