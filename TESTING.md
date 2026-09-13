# Together Insights verification

## Current release checks

- Node build and unit/integration suite: **42 passed**. Includes reference parsing,
  anchor validation, cloud ownership mapping, stale remote cache removal, snapshot
  restrictions, deployment content inclusion, and rejection of privileged browser keys.
- Live Supabase + Chromium suite: **14 passed**. Creates disposable identities and
  deletes them in `finally`; the successful run removed all seven identities and
  their dependent test records.
- Gmail SMTP: successful TLS connection and authentication with the supplied app
  password; SMTP configuration successfully applied to the Supabase project.

Live checks cover public/private RLS; forged-owner and other-user write denial;
comments/reactions and reaction uniqueness; read-only visits and optional nickname
settings without creating identities; first anonymous signup failure with retained
input; first anonymous reply/insight/reaction without an auth screen; stable retry
identities; anonymous session reuse after reload; metadata spoofing and self-grant
denial; a trusted temporary teacher role; explicit original-source links;
cross-browser comments; account-switch private-record isolation; and real password
recovery. No runtime page errors occurred.

The recovery test uses an administrator-generated link without sending mail to a
real recipient. Gmail authentication and remote configuration are established;
inbox delivery and spam placement were not tested by that run.

Machine-readable current results: `evidence/cloud-verification.json`. Earlier
`browser-report.json`, `regression-report.json`, and screenshots numbered 01-06
describe the original v3 local demo; they are historical evidence, not current
cloud/mobile release claims.

## Reproduction

```sh
npm run build
npm test
npm start
```

The live browser test is `tests/cloud-live.cjs`. It requires the Supabase JS SDK
and Playwright as test tools, a Chromium browser, public project configuration in
`.env.local`, and `SUPABASE_SECRET_KEY` available only to the test process. Do not
put that privileged key into source, Vercel frontend variables, or browser code.
The test creates and removes disposable users and posts against the configured
project; execute it only against an authorized project.

Optional environment variables `SUPABASE_MODULE`, `PLAYWRIGHT_MODULE`, and
`CHROMIUM_EXECUTABLE` can select already installed test tools. `TEST_SITE_URL`
defaults to `http://127.0.0.1:4173` and may target the deployed app for release checks.

## Mobile verification boundary

The immediate-participation update passed 12 focused Chromium/WebKit layout
checks at 320 and 390 pixels: dashboard, optional nickname, and anonymous composer.
No auth screen was required and read-only use created no identity. Results are
recorded in `evidence/guest-mobile-report.json`.

Chromium and WebKit UI checks passed at 320/360/390/430 x 844 and 844 x 390.
They cover touch targets, dashboard, reading, source drawer, paragraph selection,
composer, keyboard viewport simulation, and email/guest forms. An isolated WebKit
cloud probe established successful TLS, OPTIONS and REST HTTP 200, permitted
origins/headers, and a connected ready app. Earlier generic access-control messages
during rapid navigation were reproduced as cancelled in-flight requests.

Phone viewport, touch, keyboard layout, and browser engine results are recorded
separately in the mobile evidence. Browser emulation does not establish behavior
on every physical Android/iPhone, in-app browser, or vehicle Bluetooth system.
