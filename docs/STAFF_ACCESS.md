# Staff access

Visitors can read the site and participate without an email account. Supabase anonymous sign-in gives each participating browser its own owner ID. It is an identity for record ownership, not a staff role.

The `together_staff` table is the authority for operator access. Its roles are:

- `admin`: content preparation and classroom presentation
- `editor`: content preparation
- `teacher`: classroom presentation and study-prompt creation

Only a trusted SQL session or service-side process may add, update, or remove staff rows. The browser roles have no table write grants or write policies. A staff member can read only their own row, and anonymous identities cannot read a staff row. Do not derive staff access from email, browser state, `user_metadata`, or the Supabase `authenticated` database role; anonymous users also use that database role.

The migration provisions the confirmed owner account as `admin` and preserves an existing assignment. Further grants must use a trusted SQL session, for example:

```sql
insert into public.together_staff(user_id,role)
values ('USER_UUID','editor')
on conflict (user_id) do update set role=excluded.role;
```

`public.together_has_role(text[])` performs a live, server-side role lookup and rejects anonymous identities. Future server tables must use it in every privileged write policy. For example, server-persisted content can allow public reads while enforcing editor writes:

```sql
create policy content_write on public.example_content
for all to authenticated
using (public.together_has_role(array['admin','editor']::text[]))
with check (public.together_has_role(array['admin','editor']::text[]));
```

Study prompts use `array['admin','teacher']`. A teacher can change or delete only prompts they created; an admin can manage every prompt. The immutable 12-character slug is for routing, not secrecy. Prompt and reply reads are public. Reply insert and delete policies bind each reply to its email or anonymous Supabase identity. The UI must escape prompt authors, reply authors, titles, questions, reading text, and reference labels because these are untrusted values.

Calendar management is separate from the general staff roles. `together_event_managers` grants one or more organizations to a confirmed, nonanonymous user. Valid identifiers are `all`, `primary`, `relief`, `elders`, `youth`, and `sunday-school`. An explicit `all` grant permits every organization; otherwise every organization targeted by an event must appear in the manager's grants. The `admin` staff role can manage all events. The `editor` and `teacher` roles do not grant calendar access by themselves.

An admin can provision or revoke one calendar grant with the server-checked RPC. It returns `false` when no confirmed account matches the email:

```sql
select public.together_set_event_manager('manager@example.com','primary',true);
select public.together_set_event_manager('manager@example.com','primary',false);
```

Calendar event slugs, IDs, creators, and timestamps are immutable to browser clients. Published and cancelled events are public; drafts are visible only to an admin or a manager whose grants cover every target organization. Event updates check both the stored and replacement organization arrays. `TogetherAccess.organizations`, `can('events')`, `canManageEvent(row)`, and `allowedEventOrganizations()` mirror these rules for interface visibility while database policies remain authoritative.

Event posters use the private `together-event-posters` bucket with a 5 MB limit and PNG, JPEG, or WebP MIME types. Object paths must be `EVENT_UUID/RANDOM_FILENAME.ext`. Visitors use Storage `download(path)` and a temporary blob URL; they can download only the path attached to a published or cancelled event. Managers can upload, read, and delete files only inside event folders they manage. Upload without overwrite, update `poster_path` last, then remove the old file. Delete the poster through the Storage API before deleting its event row because direct deletion from `storage.objects` leaves the underlying file orphaned.

For a multi-table operation, expose a narrowly scoped transaction function and repeat the live role check inside it. Browser visibility checks improve the interface but do not replace database policies.

The content preparation tools remain browser-local. They can import a lesson, register reference text, and export `deployment-content.json`; they do not publish that content to Supabase. Publishing content still requires reviewing the export, replacing the repository file, and deploying the build. Study prompts and calendar events are separate Supabase-backed records.
