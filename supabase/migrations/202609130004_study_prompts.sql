begin;

create table public.together_prompts (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique default substr(replace(gen_random_uuid()::text,'-',''),1,12)
  check (slug ~ '^[a-f0-9]{12}$'),
 title text not null check (char_length(btrim(title)) between 1 and 160),
 question text not null check (char_length(btrim(question)) between 1 and 3000),
 reading_text text not null check (char_length(btrim(reading_text)) between 1 and 10000),
 source_url text not null check (
 char_length(source_url) between 1 and 4096
  and source_url ~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$'
 ),
 reference_label text check (reference_label is null or char_length(btrim(reference_label)) between 1 and 200),
 anchor jsonb check (anchor is null or coalesce(jsonb_typeof(anchor)='object' and octet_length(anchor::text)<131072,false)),
 lesson_key text check (lesson_key is null or char_length(btrim(lesson_key)) between 1 and 200),
 author text not null check (char_length(btrim(author)) between 1 and 50),
 created_by uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index together_prompts_created on public.together_prompts(created_at desc);
create index together_prompts_creator on public.together_prompts(created_by);

create table public.together_prompt_replies (
 id uuid primary key,
 prompt_id uuid not null references public.together_prompts(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 author text not null check (char_length(btrim(author)) between 1 and 50),
 body text not null check (char_length(btrim(body)) between 1 and 3000),
 created_at timestamptz not null default now()
);
create index together_prompt_replies_prompt on public.together_prompt_replies(prompt_id,created_at);
create index together_prompt_replies_owner on public.together_prompt_replies(owner_id);

alter table public.together_prompts enable row level security;
alter table public.together_prompt_replies enable row level security;
revoke all on public.together_prompts,public.together_prompt_replies from anon,authenticated;
grant select on public.together_prompts,public.together_prompt_replies to anon,authenticated;
grant insert(id,title,question,reading_text,source_url,reference_label,anchor,lesson_key,author,created_by) on public.together_prompts to authenticated;
grant update(title,question,reading_text,source_url,reference_label,anchor,lesson_key,author) on public.together_prompts to authenticated;
grant delete on public.together_prompts to authenticated;
grant insert(id,prompt_id,owner_id,author,body) on public.together_prompt_replies to authenticated;
grant delete on public.together_prompt_replies to authenticated;

create policy together_prompts_read on public.together_prompts
 for select to anon,authenticated using (true);
create policy together_prompts_create on public.together_prompts
 for insert to authenticated
 with check (
  created_by=(select auth.uid())
  and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  and public.together_has_role(array['admin','teacher']::text[])
 );
create policy together_prompts_edit on public.together_prompts
 for update to authenticated
 using (
  coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  and (
   public.together_has_role(array['admin']::text[])
   or (created_by=(select auth.uid()) and public.together_has_role(array['teacher']::text[]))
  )
 )
 with check (
  coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  and (
   public.together_has_role(array['admin']::text[])
   or (created_by=(select auth.uid()) and public.together_has_role(array['teacher']::text[]))
  )
 );
create policy together_prompts_remove on public.together_prompts
 for delete to authenticated
 using (
  coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  and (
   public.together_has_role(array['admin']::text[])
   or (created_by=(select auth.uid()) and public.together_has_role(array['teacher']::text[]))
  )
 );

create policy together_prompt_replies_read on public.together_prompt_replies
 for select to anon,authenticated using (true);
create policy together_prompt_replies_create on public.together_prompt_replies
 for insert to authenticated
 with check (
  owner_id=(select auth.uid())
  and exists(select 1 from public.together_prompts p where p.id=prompt_id)
 );
create policy together_prompt_replies_remove on public.together_prompt_replies
 for delete to authenticated using (owner_id=(select auth.uid()));

create function public.together_prompts_timestamp()
returns trigger
language plpgsql
set search_path=''
as $$
begin
 if tg_op='INSERT' then
  new.created_at=now();
 end if;
 new.updated_at=now();
 return new;
end;
$$;
create trigger together_prompts_timestamp
 before insert or update on public.together_prompts
 for each row execute function public.together_prompts_timestamp();
revoke all on function public.together_prompts_timestamp() from public;

create function public.together_prompt_replies_timestamp()
returns trigger
language plpgsql
set search_path=''
as $$
begin
 new.created_at=now();
 return new;
end;
$$;
create trigger together_prompt_replies_timestamp
 before insert on public.together_prompt_replies
 for each row execute function public.together_prompt_replies_timestamp();
revoke all on function public.together_prompt_replies_timestamp() from public;

commit;
