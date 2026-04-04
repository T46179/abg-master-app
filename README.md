# ABG Master App

Standalone React + TypeScript + Vite frontend for ABG Master.

## Current Setup

- the app builds for GitHub Pages under `/abg-master-app/`
- protected Practice loads runtime bootstrap from `public/runtime_bootstrap.json`
- legacy fallback payload still exists in `public/abg_cases.json`
- Supabase config is sourced from Vite env vars only
- runtime behavior remains BASE_URL-relative for asset loading and routing
- protected Practice now uses Supabase Edge Functions for issued-case delivery and server-side grading
- direct browser writes to `attempts` are no longer used after the protected cutover

## Environment Variables

Create a local `.env.local` file if you want Supabase-enabled persistence:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_ENABLE_PROTECTED_CASE_DELIVERY=false
```

If these values are omitted, the app falls back to local-only behavior.
Current recommended beta setting is `VITE_ENABLE_PROTECTED_CASE_DELIVERY=true` once:
- the protected practice schema has been created in Supabase
- `published_cases` has been seeded from the generated SQL
- both Edge Functions have been deployed
- the final attempts hardening step has been run

## Local Commands

Run from this repo root:

```bash
npm install
npm run dev
npm run test
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

## Release Workflow

Use [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md) before pushing a public update.

## Runtime Notes

- runtime asset loading stays `import.meta.env.BASE_URL`-relative
- router basename stays aligned to `import.meta.env.BASE_URL`
- local storage keys and meanings stay unchanged
- Supabase anonymous auth remains the identity layer
- `user_progress` still syncs remotely when available
- final grading and `attempts` inserts now happen through `submit-practice-case`
- `Exam` and `Leaderboard` remain teaser routes in this pass

## Current Protected Practice State

This repo now supports both a legacy fallback path and the current protected beta path:
- legacy fallback mode can still read `public/abg_cases.json`
- protected mode reads `public/runtime_bootstrap.json`
- protected mode requests issued cases through Supabase Edge Functions
- protected mode submits final answers for server-side grading and attempt logging
- current canonical case content is seeded into Supabase from `abg-master-content/generated/published_cases_seed.sql`

Manual Supabase setup scripts live in [`supabase/manual`](./supabase/manual/README.md).
