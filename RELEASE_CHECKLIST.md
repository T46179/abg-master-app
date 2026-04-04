# ABG Master App Release Checklist

Use this checklist whenever you want to publish an update to the public app.

## 1. Prepare Content

Run case generation from the private content repo:

```bash
cd E:\Desktop\abg-master\abg-master-content
python -m generator.generate_cases
```

Expected result:

- `generated/abg_cases.json` is updated in `abg-master-content`
- `generated/runtime_bootstrap.json` is updated in `abg-master-content`
- `generated/published_cases_seed.sql` is updated in `abg-master-content`
- `public/abg_cases.json` is mirrored and updated in `abg-master-app`
- `public/runtime_bootstrap.json` is mirrored and updated in `abg-master-app`

If you do not have `python` on PATH, use your local Python launcher or IDE task instead.

## 2. Review Private Repo Changes

From `abg-master-content`:

```bash
git status
```

Confirm you are happy with any changed files before committing and pushing to the private repo.

## 3. Review Public Repo Changes

From `abg-master-app`:

```bash
git status
```

Make sure the public repo only contains files you are comfortable exposing publicly.

Typical expected public changes:

- app code under `src/`
- `public/abg_cases.json`
- `public/runtime_bootstrap.json`
- `README.md` or release notes

## 4. Local Verification

From `abg-master-app`:

```bash
npm run test
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Verify:

- the app loads successfully
- the dashboard renders correctly
- you can start and complete a practice case
- refresh preserves progress as expected
- updated cases appear in the app

## 5. Push Private Repo

From `abg-master-content`:

```bash
git add .
git commit -m "Update generated cases and content"
git push origin main
```

Adjust the commit message if the release includes other work.

## 6. Push Public Repo

From `abg-master-app`:

```bash
git add .
git commit -m "Release updated app build and cases"
git push origin main
```

## 7. Deploy / Publish

If GitHub Pages is enabled for the public repo:

- confirm the latest commit has deployed
- open the live app URL
- test the deployed version, not just local preview

## 8. Final Smoke Test

On the live public app:

- open the app in a fresh browser session
- start a case
- answer through to completion
- refresh once
- confirm the app still behaves normally

## Notes

- Keep Supabase secrets in `.env.local` only. Do not commit them.
- The public repo is the deployable app.
- The private repo is the content and generator source of truth.
- For now, publishing remains a manual workflow: generate in private, verify, then push both repos as needed.
