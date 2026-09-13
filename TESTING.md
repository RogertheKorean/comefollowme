# Together Insights verification

## Current release checks

Version 4.2.0 was checked on 2026-09-13 against the configured Supabase project:

- 52 unit/build checks: dates, organization filters, anchor validation, public-only
  browser configuration, and 800 ms draft debounce, unchanged writes, identity
  isolation, lifecycle flush, and storage quota recovery.
- 15 existing cloud workflow checks, including ordinary comment autosave/reload,
  lazy anonymous participation, ownership, email sign-in, and password recovery.
- 9 community integration checkpoints: question and event RLS, private poster
  access and revocation, retry-safe anonymous replies with draft restore/clear,
  teacher authoring, and the manager's draft/edit/preview/publish/cancel/delete flow.
- 6 question author UI checks, including a real selected passage creating a new
  question, authenticated short-link reload, and the 320 px editor.
- 36 route/layout checks across Chromium and WebKit at 320, 390, and 1440 px,
  plus browser history and read-only visits without identity creation.

Evidence is in `evidence/cloud-verification.json`, `evidence/community-live.json`,
`evidence/prompt-author-live.json`, and `evidence/community-layout-report.json`.
Live tests use disposable fixtures; each final successful live run printed its
cleanup result. The community test fixture is a generated valid PNG, not user content.

Historical evidence files may describe earlier prototype or cloud checks. They are not
claims about the current question and calendar release.

## Reproduction

```sh
npm run build
npm test
npm start
```

The live browser tests are `tests/cloud-live.cjs`, `tests/community-live.cjs`, and
`tests/prompt-author-live.cjs`. They require the Supabase JS SDK
and Playwright as test tools, a Chromium browser, public project configuration in
`.env.local`, and `SUPABASE_SECRET_KEY` available only to the test process. Do not
put that privileged key into source, Vercel frontend variables, or browser code.
The test creates and removes disposable users and posts against the configured
project; execute it only against an authorized project.

Optional environment variables `SUPABASE_MODULE`, `PLAYWRIGHT_MODULE`, and
`CHROMIUM_EXECUTABLE` can select already installed test tools. `TEST_SITE_URL`
defaults to `http://127.0.0.1:4173` and may target the deployed app for release checks.

## Mobile verification boundary

Verify 320 px and 390 px layouts for question replies, question editing, calendar
filters, event editing, and Korea-time labels before release. Browser emulation does
not establish behavior on every physical Android/iPhone, in-app browser, or vehicle
Bluetooth system.
