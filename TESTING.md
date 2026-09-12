# Verification for this delivery

## Passed

- Production static build with Node and no external dependencies.
- **36 Node unit/integration tests**: URL normalization, numeric/discontinuous and opaque selectors, chapter ranges, safe protocols, Markdown extraction, missing locations, content revisions, document/lesson validation, content-pack build inclusion, failure on malformed deployment data, identical root/public output.
- **46 Chromium DOM workflow checks**: conference reading, language separation, selections, highlight, capture, empty-input validation, posting, replies, exact return to source, nested back navigation, full-text registration, version pinning, missing language display, library audit, private-data-free content pack, HTML sanitization, consent/presentation, storage serialization, mobile layout and Escape behavior.
- **17 additional Chromium regression checks**: every source link renders a pane without exceptions, original lesson selection/private notes, chapter navigation, manual p19, importing a new lesson with automatic reference discovery, atomic pack validation, and injected storage failure recovery.
- No runtime page errors, external popups or external content fetches observed in the workflow run.
- Captures in this Chromium run were actual local DOM reading-area PNGs (`dom-reference-viewport`), not fallback quote cards.
- The included local HTTP server returned 200 and bytes identical to `public/index.html`.

Machine-readable records are in `evidence/verification-summary.json`, `browser-report.json` and `regression-report.json`. Node output is included as `node-test-results.txt`. Screenshots use clean demo content; test-only registered replacement paragraphs are not bundled into the application.

## Important test boundary

This execution environment's browser policy blocks HTTP/file navigation, including the local server. Browser UI tests therefore used Playwright `set_content` to run the actual built HTML and a **localStorage test double**. Serialization was carried into a fresh browser document to check the app's storage round trip. Storage-full behavior was tested by injected failure.

These results do **not** establish native localStorage persistence/quota behavior, actual Vercel deployment success, Safari/Firefox compatibility, or real iOS/Android touch behavior. Mobile checks used Chromium with a 390 × 844 viewport. The local server was independently checked through HTTP, not through an allowed browser navigation. There is no backend or live multi-member sharing to test.

## Reproduce

```sh
npm run build
npm test
npm start
```

In another terminal, with Python Playwright and a Chromium browser installed:

```sh
python tests/browser_smoke.py --url http://127.0.0.1:4173
```

`CHROMIUM_EXECUTABLE` may point to a local browser executable. The standard URL mode tests real origin storage. The restricted-environment checks can be reproduced with:

```sh
python tests/browser_smoke.py --isolated
python tests/regression_checks.py
```

Playwright is only a test dependency. It is not required to build, host or use this prototype. The repository does not automatically run browser tests on Vercel.
