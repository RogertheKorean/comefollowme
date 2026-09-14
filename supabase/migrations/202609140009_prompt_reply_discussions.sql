begin;

create table public.together_prompt_reply_comments (
 id uuid primary key,
 reply_id uuid not null references public.together_prompt_replies(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 author text not null check (char_length(btrim(author)) between 1 and 50),
 body text not null check (char_length(btrim(body)) between 1 and 1500),
 created_at timestamptz not null default now()
);
create index together_prompt_reply_comments_reply
 on public.together_prompt_reply_comments(reply_id,created_at,id);
create index together_prompt_reply_comments_owner
 on public.together_prompt_reply_comments(owner_id);

create table public.together_prompt_reply_reactions (
 reply_id uuid not null references public.together_prompt_replies(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(reply_id,owner_id)
);
create index together_prompt_reply_reactions_owner
 on public.together_prompt_reply_reactions(owner_id);

alter table public.together_prompt_reply_comments enable row level security;
alter table public.together_prompt_reply_reactions enable row level security;
revoke all on public.together_prompt_reply_comments,public.together_prompt_reply_reactions from anon,authenticated;
grant select on public.together_prompt_reply_comments,public.together_prompt_reply_reactions to anon,authenticated;
grant insert(id,reply_id,owner_id,author,body) on public.together_prompt_reply_comments to authenticated;
grant insert(reply_id,owner_id) on public.together_prompt_reply_reactions to authenticated;
grant delete on public.together_prompt_reply_comments,public.together_prompt_reply_reactions to authenticated;

create policy together_prompt_reply_comments_read
 on public.together_prompt_reply_comments
 for select to anon,authenticated
 using (
  exists (
   select 1 from public.together_prompt_replies r
   where r.id=reply_id
  )
 );
create policy together_prompt_reply_comments_create
 on public.together_prompt_reply_comments
 for insert to authenticated
 with check (
  owner_id=(select auth.uid())
  and exists (
   select 1 from public.together_prompt_replies r
   where r.id=reply_id
  )
 );
create policy together_prompt_reply_comments_remove
 on public.together_prompt_reply_comments
 for delete to authenticated
 using (owner_id=(select auth.uid()));

create policy together_prompt_reply_reactions_read
 on public.together_prompt_reply_reactions
 for select to anon,authenticated
 using (
  exists (
   select 1 from public.together_prompt_replies r
   where r.id=reply_id
  )
 );
create policy together_prompt_reply_reactions_create
 on public.together_prompt_reply_reactions
 for insert to authenticated
 with check (
  owner_id=(select auth.uid())
  and exists (
   select 1 from public.together_prompt_replies r
   where r.id=reply_id
  )
 );
create policy together_prompt_reply_reactions_remove
 on public.together_prompt_reply_reactions
 for delete to authenticated
 using (owner_id=(select auth.uid()));

create function public.together_prompt_reply_discussions_timestamp()
returns trigger
language plpgsql
set search_path=''
as $$
begin
 new.created_at=now();
 return new;
end;
$$;
create trigger together_prompt_reply_comments_timestamp
 before insert on public.together_prompt_reply_comments
 for each row execute function public.together_prompt_reply_discussions_timestamp();
create trigger together_prompt_reply_reactions_timestamp
 before insert on public.together_prompt_reply_reactions
 for each row execute function public.together_prompt_reply_discussions_timestamp();
revoke all on function public.together_prompt_reply_discussions_timestamp() from public;

commit;
