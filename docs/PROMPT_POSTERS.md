# Question posters and lesson links

Study questions can be published with or without one optional PNG, JPEG, or WebP poster up to 5 MB. The `together-prompt-posters` bucket is private. Visitors can download an object only while its exact path is referenced by a public `together_prompts` row, so an uploaded file remains private until the question write succeeds.

Poster paths have the form `<author user UUID>/<object UUID>.<extension>`. Confirmed, non-anonymous admins and teachers can upload only into their own folder. A database trigger verifies that a newly attached object exists and belongs to the acting author's folder. A teacher can edit prompts they created; an admin can edit any prompt and attach a replacement uploaded into the admin's own folder.

The editor uploads after local preview and immediately before the prompt row write. It keeps the same prompt UUID and object path while a failed write remains open, making a retry idempotent. When replacing or removing a poster, it patches the row first and then removes the old, now-unreferenced object. Storage policy rejects deleting an object that is still attached. Question deletion follows the same row-first order.

New question editors select the current weekly lesson and fill its official source URL. The author may override that URL with a specific scripture. Changing the lesson updates only the lesson key and source URL and clears an anchor from a different lesson; it preserves the entered title, question, reference label, and reading text. Editing an existing prompt keeps its exact historical lesson selection and any source override.

Shared `/p/<12-hex-slug>` links continue to open the poster, reading material, official source, and reply input directly for unsigned visitors. Viewing or downloading a poster does not create an anonymous identity; identity creation remains deferred until a visitor submits a reply.

Apply `supabase/migrations/202609140008_prompt_posters.sql` before deploying the UI. The migration contains no prompt or poster seed data. Local policy and wiring checks run with `node --test tests/prompt-posters.test.cjs`. The explicit live checks are `node tests/prompt-posters-live.cjs` and the updated `node tests/prompt-author-live.cjs`; both use disposable exact IDs and remove their rows, objects, and identities in `finally`.
