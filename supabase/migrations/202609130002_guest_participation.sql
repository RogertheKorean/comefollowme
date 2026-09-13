begin;
-- Guests receive their own Supabase Auth identity; they never share an owner ID.
drop policy together_notes_create on public.together_notes;
create policy together_notes_create on public.together_notes for insert to authenticated with check (owner_id=(select auth.uid()));
drop policy together_comments_create on public.together_comments;
create policy together_comments_create on public.together_comments for insert to authenticated with check (owner_id=(select auth.uid()) and exists(select 1 from public.together_notes n where n.id=note_id and n.scope='class'));
drop policy together_reactions_create on public.together_reactions;
create policy together_reactions_create on public.together_reactions for insert to authenticated with check (owner_id=(select auth.uid()) and exists(select 1 from public.together_notes n where n.id=note_id and n.scope='class'));
commit;
