# Content sources and scope — v3

## User-supplied material

The original upload `Pasted markdown.md` is preserved as `content/korean-source.md`. The lesson and existing prototype English come from the supplied v2, not from a new reproduction of the official English lesson. Block-level normalization notes are in `content/PROVENANCE-v2.md`; this prior provenance describes the v2 extraction.

The user supplied the Korean lesson, including conference links but not the full conference texts. This release does not bundle full externally retrieved conference talks.

## Scripture edition

`content/scriptures.json` preserves the uploaded v2 KRV (개역한글, not 개역개정) and KJV excerpts: 11 chapter records and 106 verses per language. Only Proverbs 3 is a full chapter. Source links and earlier checks supplied in v2 are retained separately in `content/SCRIPTURE_PROVENANCE-v2.md`. That inherited document is provenance, not a new rights verification performed for this release.

## Conference study summaries

The following official sources were consulted to prepare short original Korean/English study summaries. Both languages are explicitly labeled as summaries, not the original talk or an official translation. Summary paragraphs use local IDs and do not claim official paragraph positions.

- 그러므로 그들이 두려움을 가라앉히고 — 데이비드 에이 베드나 장로 (2015 · 04)
  https://www.churchofjesuschrist.org/study/general-conference/2015/04/therefore-they-hushed-their-fears?lang=kor
- 다시 신뢰하십시오 — 게릿 더블유 공 장로 (2021 · 10)
  https://www.churchofjesuschrist.org/study/general-conference/2021/10/51gong?lang=kor
- 예수님을 따름: 화평하게 하는 자가 됨 — 닐 엘 앤더슨 장로 (2022 · 04)
  https://www.churchofjesuschrist.org/study/general-conference/2022/04/15andersen?lang=kor
- 말은 중요합니다 — 로널드 에이 래스번드 장로 (2024 · 04)
  https://www.churchofjesuschrist.org/study/general-conference/2024/04/41rasband?lang=kor

The teaching manual paragraph comes from the quotation already present in the supplied Korean lesson (Teaching in the Savior’s Way, p19 in the linked document). Its English is the v2 demonstration translation, not a newly verified official English quotation. No other full manuals are included.

## Deployment documentation consulted

- Vercel build configuration: https://vercel.com/docs/builds/configure-a-build
- Vercel project JSON configuration: https://vercel.com/docs/project-configuration/vercel-json
- Church deep-link structure: https://www.churchofjesuschrist.org/learn/mobile-applications/deep-linking-in-gospel-library?lang=eng

Link identity parsing is used by this independent app; it does not imply Gospel Library synchronization, permission to scrape, or permission to redistribute every referenced document.

## Prototype artifacts

All sample members, comments and experiences are fictional UI demonstration content. New test-only registration text is generated in temporary test pages and is not in the release content bundle.

## Browser SDK

Supabase JavaScript SDK 2.112.4 is vendored in `src/vendor/` under the MIT license. The license is in `licenses/SUPABASE_JS_LICENSE.txt`. Authentication, email delivery and database access use the configured Supabase project. Privileged keys and SMTP credentials are not part of the browser bundle.
