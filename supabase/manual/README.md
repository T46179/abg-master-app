# Protected Practice Supabase Setup

## Order
1. Open your Supabase project.
2. In the left sidebar, open `SQL Editor`.
3. Click `New query`.
4. Paste and run [`001_protected_practice_base_schema.sql`](./001_protected_practice_base_schema.sql).
5. Open `Table Editor` and confirm these tables now exist:
   - `published_cases`
   - `issued_case_sessions`
   - `practice_prepare_events`
6. Generate fresh content from the private content repo so it writes:
   - `docs/runtime_bootstrap.json`
   - `docs/published_cases_seed.sql`
7. Open `SQL Editor` again and paste the generated `published_cases_seed.sql` file from the content repo. Run it to load the canonical protected cases.
8. Deploy the two Edge Functions from this repo:
   - `prepare-practice-cases`
   - `submit-practice-case`
9. Verify that protected practice works end-to-end with `VITE_ENABLE_PROTECTED_CASE_DELIVERY=true`.
10. Only after that verification, run [`002_attempts_hardening_after_cutover.sql`](./002_attempts_hardening_after_cutover.sql).

## Beginner-Friendly Notes
- Run one SQL file at a time.
- Wait for the green success message after each run.
- If Supabase shows an error, stop there and fix it before moving to the next file.
- The generated `published_cases_seed.sql` file comes from the private content repo. It is the exact SQL that inserts the protected cases into `published_cases`.
- Do not run the final attempts hardening script until the protected submit flow is live. Before that point, the current frontend still needs browser write access to `attempts`.
