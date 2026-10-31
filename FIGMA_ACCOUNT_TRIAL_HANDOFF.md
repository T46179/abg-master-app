# Figma handoff: account pages and trial onboarding

Add the following pages and states to the current ABG Master Exam work. Follow its visual language, typography, components and interaction patterns. Produce desktop and mobile versions.

## Design and prototype scope

Design the pages, their visual states and basic clickable navigation between them. Use dummy data and simulated outcomes throughout. Do not implement authentication, send or verify emails, validate real verification links, save account/profile data, track trial usage or build backend logic. A prototype click can stand in for a successful email verification or password reset. Form selections, show/hide password and opening menus are sufficient local interactions.

For UX and prototyping, treat the placeholder Exam units currently being used as the **trial paper**. Connect the trial journey to that paper.

## Exam entry and profile navigation

Add a **new, not-signed-in user state** of the Exam dashboard. Clearly show that a trial exam is available and provide a prominent **Start trial exam** action. Keep this within the current Exam layout and flow. The action should lead into account creation or sign-in, followed by onboarding and the exam setup. Trial details can use the current placeholder paper; no trial-limit or entitlement logic is needed.

Remove the current "Stay Updated" CTA in the navigation. Keep the night mode toggle as is. Add appropriate navigation for profile and the sign in/sign out feature as you see fit. 

## New pages

### 1. Create account
- Email and password entered together; show/hide password.
- Primary action: **Create account**.
- Link: **Already have an account? Sign in**.
- Supporting message: creating an account saves progress across devices; registering a guest keeps their current progress.
- Keep professional-background questions out of this form.

### 2. Sign in
- Email and password; show/hide password.
- Primary action: **Sign in**.
- Links: **Forgot password?** and **Create account**.
- When a guest with progress signs into an existing account, show a short notice: "Signing in will load this account's saved progress. Your current guest progress won't be added to it."

### 3. Check your email
- Show a sample email address and instructions to click the verification link in their email.
- Actions: **Resend email**, **Correct email address**, **Continue to Practice**.
- Include a sample resend-confirmation state.
- Connect to the verification-success page through a simulated prototype action; no actual email verification is needed.

### 4. Forgot password
- Email field and **Send reset link**.
- Confirmation state: "If an account exists for this email, we'll send a password reset link."
- Actions to return to sign-in or request another email.
- Simulate following the reset email to the new-password page.

### 5. Set a new password
- New password and confirmation; show/hide password.
- Primary action: **Save new password**.
- Success state with a clear **Sign in** action.

### 6. Email-link result
Use one shared page layout with these sample variants:
- Email verified: confirmation and **Continue** to the intended activity.
- Expired or already-used verification link: clear message with sign-in or request-another-email action.
- Expired or already-used password-reset link: **Request a new reset link**.
- Temporary failure: clear message and **Try again**.

These are visual prototype states, not functioning email links.

### 7. Tell us a little about yourself
Place this after trial entry and account sign-in/verification, before exam setup. Account creation and ordinary Practice remain available without this step.
The intent is: new signed in users have access to cross device settings and saved user data. These users will be allowed access to one trial exam (the current example units you have already designed). Before beginning the trial exam, they will be required to answer demographic questions, which will then allow them to begin the trial exam. 

**Heading:** Tell us a little about yourself

**Supporting copy:** Share your background and learning goals to help us make ABG Master more useful to you.

**Professional role - single choice:**
- Doctor
- Medical student
- Nurse
- Paramedic
- Other (optional text field)

**Stage of training - doctors only, single choice:**
- Intern / resident / junior doctor
- Registrar / specialty trainee
- Specialist / consultant
- Other
- Prefer not to say

**Specialty - show for Doctor or Nurse, single choice; use only these options:**
- Emergency medicine
- Intensive care
- Anaesthetics
- Respiratory
- Other
- Not yet chosen/prefer not to say

**What is your main reason for using ABG Master? - single choice:**
- Preparing for an exam
- Improving clinical skills
- General study and revision
- Teaching others

**Primary action:** Begin trial exam

## Prototype connections
- New signed-out Exam dashboard -> Start trial exam -> Create account or Sign in.
- Create account -> Check your email -> simulated Email verified -> Tell us a little about yourself, when entering through the trial.
- Sign in from trial entry -> Tell us a little about yourself.
- Tell us a little about yourself -> current Exam setup -> Begin exam -> placeholder trial paper.
- Account creation/sign-in opened from the profile icon -> account flow -> current Exam dashboard.
- Forgot password -> email-sent state -> simulated reset link -> Set a new password -> success -> Sign in.

Use loading, validation, error and success variants within these layouts. Keep the tone friendly, concise and clear. 
