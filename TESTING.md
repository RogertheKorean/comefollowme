# Together Insights verification

## Current release checks

Version 4.4.0 was checked on 2026-09-14 against the configured Supabase project:

- 82 unit/build checks, including inert clipboard conversion, source extraction,
  permission boundaries, private posters, and retry/cleanup wiring.
- 7 live import UI checkpoints, including rich webpage paste at the
  selected text position, preserved scripture links in a published lesson,
  native plain-text fallback, no pasted script execution or image requests,
  and Chromium/WebKit editors at 320 px.
- 4 live poster backend checkpoints: optional images, pending-file privacy,
  attached public reads, teacher ownership, admin replacement, and actual object
  deletion verified with privileged list and download. All temporary rows,
  objects and four identities were removed after the successful run.
- 8 live question UI checkpoints covering automatic weekly source links,
  preserved overrides, image preview/upload, retry after a lost upload response,
  unsigned short-link access, 800 ms reply drafts restored after reload, actual
  guest submission, and visibility to another unsigned visitor. The editor,
  selected-passage flow, and mobile layouts were also checked.

Evidence: `evidence/importer-live.json`, `evidence/prompt-author-live.json`,
and their associated mobile screenshots. These are browser checks, not physical
Android/iPhone device certification. Test prompts and posters are disposable
fixtures; no user question or poster was seeded by this release.

Migration 008 was applied before UI deployment. The pre-existing second weekly
lesson was repaired separately as an immutable revision: 76 Korean and 79 English
links were matched to official source text, retaining all 46 paragraph IDs and
the exact text after link markup is removed. Both public API bytes and actual
production reader links were verified; its earlier revision remains available.

## Earlier release checks

Version 4.3.0 was checked on 2026-09-13 against the configured Supabase project:

- 74 unit/build checks, including bilingual metadata extraction, missing-field
  handling, date ranges, exact reviewed publication, identity changes, schema
  grants, conflicts, and refresh probes that avoid reloading unchanged history.
- 4 live publishing backend checkpoints: admin/editor publishing, idempotent
  retries, historical versions, immediate PT409 stale-write errors, and denied
  ordinary/teacher/anonymous/malformed/direct writes. One tracked lesson history
  and five disposable identities were removed in finally.
- 6 import UI checkpoints: source-first order, metadata corrections, repeated
  headings, preview invalidation, server publication and anonymous visitor reads,
  existing lesson edits, real concurrent-edit conflicts, reload-safe private
  drafts, and Chromium/WebKit editors at 320 px. Its tracked editor and lesson
  history were removed in finally. Evidence: `evidence/importer-live.json` and
  `evidence/import-chromium-320.png`, `evidence/import-webkit-320.png`.

The unchanged community and authentication flows also have the following
passing checks from version 4.2.0 on the same date:

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
