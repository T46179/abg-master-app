# ABG Master App

Standalone React + TypeScript + Vite frontend for ABG Master.

## Current Setup

- the app builds for GitHub Pages under `/abg-master-app/`
- case data is loaded from `public/abg_cases.json` as a temporary repo-local source of truth
- Supabase config is sourced from Vite env vars only
- runtime behavior remains BASE_URL-relative for asset loading and routing
- scoring, progression, persistence, and Supabase fallback behavior are preserved from the current frontend

## Environment Variables

Create a local `.env.local` file if you want Supabase-enabled persistence:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_ENABLE_PROTECTED_CASE_DELIVERY=false
```

If these values are omitted, the app falls back to local-only behavior.
Set `VITE_ENABLE_PROTECTED_CASE_DELIVERY=true` only after:
- the protected practice schema has been created in Supabase
- `published_cases` has been seeded from the generated SQL
- both Edge Functions have been deployed

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
- Supabase anonymous auth and `user_progress` / `attempts` semantics stay unchanged
- `Exam` and `Leaderboard` remain teaser routes in this pass

## Next Architecture Step

This repo now supports a protected-practice rollout path:
- legacy mode still reads `public/abg_cases.json`
- protected mode reads `public/runtime_bootstrap.json` and requests issued cases through Supabase Edge Functions

Manual Supabase setup scripts live in [`supabase/manual`](./supabase/manual/README.md).
