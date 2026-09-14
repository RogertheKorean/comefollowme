# September 14–20, 2026 reference content

Scope: the published lesson “하나님은 나의 구원이시라 / God Is My Salvation”,
ID `import-e7506efb14edb0b4bc60f022`, version
`0d5741bd14164062d5582a06d09ccf44d46091338ee56622ca2947215dfc6dc3`.
Its Korean and English blocks contain 76 and 79 links respectively. The inventory
is `reference-coverage-2026-09-14.json`; it records direct links and expanded
chapter ranges, not an inventory of every page linked recursively from them.

## Bible text

Added complete Isaiah 1–12, 2 Kings 15–20, 2 Chronicles 26–32, Matthew 1, 4, 21,
and Luke 1: 29 chapters and 798 verses in each language. Existing chapter
records are retained. Editions are Korean 개역한글 (KRV 1961), attributed to
대한성서공회 (Korean Bible Society), and English King James Version (KJV).
The Korean wording differs from the 개역개정 edition used in Gospel Library.

The Korean Bible Society states that the economic copyright in 개역한글 expired
on December 31, 2011, and that this edition can be used without copyright fees:

- https://www.bskorea.or.kr/bbs/content.php?co_id=subpage2_3_4_1
- https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&wr_id=5

Text was checked and extracted from the verse content of Bible.com KRV edition
88 and KJV edition 1 on September 14, 2026. Each chapter retains its exact
source URL, edition, provenance and a content revision. `isaiah-source-receipts.json`
records 58 page hashes, retrieval times, verse counts and text hashes. No page
navigation, notes, verse-number labels or advertising is included. Empty
continuation spans are ignored; unnumbered text continuations stay in the same
verse. Duplicate numbered verses, gaps and empty verses fail acquisition.
The expected chapter counts were independently checked against the KJV JSON
in `thiagobodruk/bible` revision `13225a15fa5e3e3043495b0c82df56c3fdfeb7f4`.
That repository's Korean text was not used for this import.

## Other sources

`deployment-content.json` adds 26 language records for 13 source identities:
the Guide to the Scriptures index and Isaiah entry, Bible Dictionary Isaiah,
the cited Oaks article, Scripture Helps Isaiah 1–12, Isaiah the Prophet,
two songs, the Liahona/Friend/For the Strength of Youth collections, and
reading guides to 3 Nephi 23:1–3 and 1 Nephi 19:23.

Modern copyrighted articles, guide entries, children's stories, lyrics and
Book of Mormon translations are represented by brief original summaries or
source guides, clearly marked `summary`, rather than copied in full.
These summaries are not official translations. Their `summary-*` block IDs
and `sourceId:false` identify local paragraphs; the original verse/paragraph
targets remain unresolved where the original text has not been included.
Magazine collection links remain collection guides, not claims that entire
archives have been downloaded. English-only source metadata keeps the Oaks
article and Bible Dictionary source buttons on the checked English pages.

The English words of “High on the Mountain Top”, Joel H. Johnson (1802–1882),
are included in full. The Church lists this hymn as public domain:
https://www.churchofjesuschrist.org/bc/content/shared/content/english/pdf/create/public-domain-hymns-hymnbook.pdf?lang=eng
The Korean translation and score are not reproduced. Local stanza IDs are
not represented as official source paragraph IDs.

Official source URLs are retained in each record and the coverage inventory.
The cited article is *Ensign*, January 1995, “Scripture Reading and Revelation”
by Dallin H. Oaks; the lesson's Liahona link is a separate magazine collection.
The Church's site terms distinguish personal downloads from public mirroring:
https://www.churchofjesuschrist.org/learn/legal/terms-of-use/go?lang=eng

This update does not bundle the full Old Testament or complete magazine,
conference or scripture-guide archives. Original target positions, language
availability and permission to reproduce any future full text need separate
verification before extending this pack.
