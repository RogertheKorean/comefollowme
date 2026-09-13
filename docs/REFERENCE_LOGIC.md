# v3 reference resolver and source fidelity

## Pipeline

`Markdown links → normalized URL → canonical document key → language → registered version → original paragraph selectors → right-side reader`

The browser never fetches Church pages and has no remote proxy, API key, crawler, iframe reader, or undocumented Gospel Library API. Unknown references do not fall through to external navigation. `src/library.js` intercepts normal reference clicks before legacy listeners. The anchors themselves use `href="#reference"`; the real URL is a data attribute. Source details provide a copy button. A prominent explicit external link in the reference header opens the original page in a new tab, using the selected language. This link is exempted from internal reference navigation.

## Identity and targets

- Recognized Church scripture URLs yield keys such as `ot/prov/3`.
- Conference and manual keys retain the `/study/...` pathname. Language and paragraph fragments are not part of the Church document key.
- Non-Church URL query strings are retained because they can identify different documents.
- `lang=kor` / `lang=eng` select separately registered text. The app does not translate missing text.
- Numeric selectors support `p5-p7`, `p1-p4,p18` and `#p5`.
- Opaque IDs such as `p_qUmpH` are retained. Ranges such as `p_zrYGD-p_vgHOp` use the registered document order, never alphabetic order.
- Visible chapter ranges such as `잠언 1~4장` become chapter tabs, including chapters not yet registered.
- Unresolved or invalid selectors are shown as missing; adjacent text is not presented as an exact match.

## Supported input

Inline Markdown links (including nested square brackets and URL parentheses), bare HTTP(S) URLs and autolinks are recognized. Existing relative links inside a registered text are resolved against its source URL. Plain text mentions with no URL are not automatically looked up. Markdown reference-definition syntax `[text][identifier]` and arbitrary rich HTML rendering are not implemented.

Reference text can be pasted as Markdown/plain text or loaded from `.md`, `.txt`, `.html`. In HTML mode, scripts, embedded frames, forms, styles and media elements are removed in an inert parser. Retained text is escaped again during rendering. Only safe HTTP(S) destinations are stored. Heading/paragraph IDs are retained; without original IDs, deterministic local IDs are assigned.

## Anchors and revisions

An insight stores `language`, `edition`, `revision`, `reference.key`, `reference.unitIds`, exact quote, UTF-16 start/end offsets, prefix/suffix context, and originating lesson location. UI row indices are not treated as official paragraph IDs. Snapshot PNGs supplement text anchors; they are not the only source of location information.

Content versions are deterministic fingerprints, not security signatures. Old reference versions remain available so saved reflections can reopen their original text. Highlights are scoped to language and version. Translation switches do not transfer offsets or auto-translate personal notes.

A conference summary is explicitly `coverage: "summary"`, and its `summary-*` positions are local, not official talk positions. Registering full text does not relabel old summary reflections as quotations of the full talk.

## Registration and distribution

Registration is validated before mutation, previewed, and only saved after the content-use confirmation. Failed storage writes keep previous reference records. Local entries are persisted in `together.insights.demo.v3`. A content-only export excludes reflections, comments, captures, highlights and the presentation queue. Replace `content/deployment-content.json` with that export and rebuild to distribute reading materials.

The build validates reference documents and lesson imports before emitting a single HTML bundle. `public/index.html` and `index.html` are generated outputs; edit `src/` and `content/`, then rebuild. Editing `public/index.html` alone is overwritten by the next Vercel build.

## Deliberate boundaries

Registered text is readable and highlightable. Images, PDFs, magazine indexes, unregistered documents and unavailable language editions receive an in-app status panel; their remote binaries or entire archives are not downloaded. Nested references are resolved when clicked, not recursively crawled. There are no actual accounts, multi-user permissions, push notifications, server persistence or live collaboration.

Browsers can refuse SVG/Canvas-based reading-area capture. The application labels a replacement quotation card instead of claiming a system screenshot was captured. The screenshot covers text in this app, never another application or the entire device screen.
