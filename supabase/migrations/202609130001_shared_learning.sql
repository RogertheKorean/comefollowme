begin;

create table public.together_notes (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 lesson_key text not null check (char_length(lesson_key) between 1 and 200),
 author text not null check (char_length(btrim(author)) between 1 and 50),
 language text not null check (language in ('ko','en')),
 body text not null check (char_length(btrim(body)) between 1 and 3000),
 type text not null check (type in ('insight','question','application')),
 scope text not null check (scope in ('class','private')),
 consent boolean not null default false check (scope='class' or consent=false),
 anchor jsonb not null check (coalesce(jsonb_typeof(anchor)='object' and octet_length(anchor::text)<131072 and anchor->>'lessonKey'=lesson_key and jsonb_typeof(anchor->'segments')='array' and jsonb_typeof(anchor->'quote')='string',false)),
 snapshot jsonb check (snapshot is null or coalesce(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<1600000 and snapshot->>'data' ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$',false)),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index together_notes_lesson_created on public.together_notes(lesson_key,created_at desc);
create index together_notes_owner on public.together_notes(owner_id);
create table public.together_comments (
 id uuid primary key,
 note_id uuid not null references public.together_notes(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 author text not null check (char_length(btrim(author)) between 1 and 50),
 body text not null check (char_length(btrim(body)) between 1 and 1500),
 created_at timestamptz not null default now()
);
create index together_comments_note on public.together_comments(note_id,created_at);
create index together_comments_owner on public.together_comments(owner_id);
create table public.together_reactions (
 note_id uuid not null references public.together_notes(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(note_id,owner_id)
);
create index together_reactions_owner on public.together_reactions(owner_id);

alter table public.together_notes enable row level security;
alter table public.together_comments enable row level security;
alter table public.together_reactions enable row level security;
revoke all on public.together_notes,public.together_comments,public.together_reactions from anon,authenticated;
grant select on public.together_notes,public.together_comments,public.together_reactions to anon,authenticated;
grant insert,delete on public.together_notes,public.together_comments,public.together_reactions to authenticated;
grant update(body,author,type,scope,consent,anchor,snapshot) on public.together_notes to authenticated;

create policy together_notes_read on public.together_notes for select to anon,authenticated using (scope='class' or owner_id=(select auth.uid()));
create policy together_notes_create on public.together_notes for insert to authenticated with check (owner_id=(select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false');
create policy together_notes_edit on public.together_notes for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy together_notes_remove on public.together_notes for delete to authenticated using (owner_id=(select auth.uid()));
create policy together_comments_read on public.together_comments for select to anon,authenticated using (exists(select 1 from public.together_notes n where n.id=note_id));
create policy together_comments_create on public.together_comments for insert to authenticated with check (owner_id=(select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and exists(select 1 from public.together_notes n where n.id=note_id and n.scope='class'));
create policy together_comments_remove on public.together_comments for delete to authenticated using (owner_id=(select auth.uid()));
create policy together_reactions_read on public.together_reactions for select to anon,authenticated using (exists(select 1 from public.together_notes n where n.id=note_id));
create policy together_reactions_create on public.together_reactions for insert to authenticated with check (owner_id=(select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and exists(select 1 from public.together_notes n where n.id=note_id and n.scope='class'));
create policy together_reactions_remove on public.together_reactions for delete to authenticated using (owner_id=(select auth.uid()));

create function public.together_validate_write() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  new.updated_at=now();
 else
  new.created_at=now();
  if TG_TABLE_NAME='together_notes' then new.updated_at=now(); end if;
 end if;
 return new;
end;
$$;
create trigger together_notes_timestamp before insert or update on public.together_notes for each row execute function public.together_validate_write();
create trigger together_comments_timestamp before insert on public.together_comments for each row execute function public.together_validate_write();
create trigger together_reactions_timestamp before insert on public.together_reactions for each row execute function public.together_validate_write();
revoke all on function public.together_validate_write() from public;
commit;
