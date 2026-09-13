# Published lesson revisions

Published lessons are public study content. Reading `together_published_lessons` needs no account and must never create an anonymous identity. Publishing goes only through `together_publish_lesson`; the database checks a confirmed, non-anonymous `admin` or `editor` role independently of the browser UI.

Every revision is stored under the stable pair `lesson.id@lesson.version`. Existing rows cannot be changed or deleted by browser roles, so note anchors keep resolving. The dashboard should show only `TogetherPublishing.getLatestLessons()`, while the reader's lesson resolver should merge `TogetherPublishing.getLessons()` so an older anchored revision remains available.

The browser contract is:

- `TogetherPublishing.ready`: initial public load promise.
- `load()`: load every published revision initially, then use the latest revision number and exact row count to avoid refetching unchanged bodies. Changed data emits `together:lessons`.
- `getLessons()`: cloned historical lesson payloads.
- `getLatest(id)`: cloned latest payload for one stable ID, or `null`.
- `getLatestLessons()`: one latest payload per stable ID.
- `publish(reviewedLesson, {expectedVersion})`: publish the exact normalized payload returned by `ReferenceEngine.validateLesson`.

For a new stable ID, pass `expectedVersion: null`. For an edit, freeze the latest observed version when the revision is loaded and pass it after preview. An exact retry of the same ID, version, and JSON succeeds idempotently. Any other stale baseline returns PostgREST code `PT409` with HTTP 409; the editor should keep the draft and reload before another preview.

Migrations `supabase/migrations/202609130006_published_lessons.sql` and `202609130007_published_lesson_conflicts.sql` were applied to the configured Supabase project on 2026-09-13. The second migration translates the internal serialization signal used by the original RPC into an immediate HTTP 409 response. Neither migration contains a seed lesson. Run the local contract tests with `node --test tests/lesson-publishing.test.cjs tests/lesson-publishing-migration.test.cjs`. Run `node tests/lesson-publishing-live.cjs` with the same explicit live-test environment used by the other Supabase wrappers. The live wrapper creates uniquely identified revisions and users and removes those exact records in `finally`.
