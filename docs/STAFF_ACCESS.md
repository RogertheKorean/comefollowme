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

The planned study-prompt feature will use `array['admin','teacher']`. Its schema and UI are currently an unshipped draft while the user reviews an interactive mockup. They are not included in this release. The intended rules allow teachers to manage their own prompts and admins to manage all prompts; public reading and owned anonymous replies will use database policies. All displayed text must be escaped.

For a multi-table operation, expose a narrowly scoped transaction function and repeat the live role check inside it. Browser visibility checks improve the interface but do not replace database policies.

The content preparation tools remain browser-local. They can import a lesson, register reference text, and export `deployment-content.json`; they do not publish that content to Supabase. Publishing content still requires reviewing the export, replacing the repository file, and deploying the build. Ward calendar and study-prompt screens are currently design previews, not available production features.
