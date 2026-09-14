begin;

alter table public.together_prompts
 add column poster_path text
 check (
  poster_path is null
  or poster_path ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(png|jpg|jpeg|webp)$'
 );
grant insert(poster_path),update(poster_path) on public.together_prompts to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('together-prompt-posters','together-prompt-posters',false,5242880,array['image/png','image/jpeg','image/webp']::text[])
on conflict (id) do update
 set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create function public.together_can_author_prompt_poster()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select
  (select auth.uid()) is not null
  and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  and exists (
   select 1 from auth.users u
   where u.id=(select auth.uid()) and u.email_confirmed_at is not null and coalesce(u.is_anonymous,false)=false
  )
  and public.together_has_role(array['admin','teacher']::text[]);
$$;
revoke all on function public.together_can_author_prompt_poster() from public,anon;
grant execute on function public.together_can_author_prompt_poster() to authenticated;

create policy together_prompt_posters_read on storage.objects
 for select to anon,authenticated
 using (
  bucket_id='together-prompt-posters'
  and exists (
   select 1 from public.together_prompts p
   where p.poster_path=name
 )
 );

-- Storage object deletion first resolves the target through SELECT.  Authors
-- therefore need private read access to their own pending/detached uploads;
-- admins need it across the bucket for cleanup and support.
create policy together_prompt_posters_author_read on storage.objects
 for select to authenticated
 using (
  bucket_id='together-prompt-posters'
  and public.together_can_author_prompt_poster()
  and (
   public.together_has_role(array['admin']::text[])
   or (
    owner_id=(select auth.uid())::text
    and split_part(name,'/',1)=(select auth.uid())::text
   )
  )
 );

create policy together_prompt_posters_create on storage.objects
 for insert to authenticated
 with check (
  bucket_id='together-prompt-posters'
  and name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(png|jpg|jpeg|webp)$'
  and split_part(name,'/',1)=(select auth.uid())::text
  and public.together_can_author_prompt_poster()
 );

create policy together_prompt_posters_remove on storage.objects
 for delete to authenticated
 using (
  bucket_id='together-prompt-posters'
  and not exists (
   select 1 from public.together_prompts p
   where p.poster_path=name
  )
  and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  and (
   public.together_has_role(array['admin']::text[])
   or (
    owner_id=(select auth.uid())::text
    and
    split_part(name,'/',1)=(select auth.uid())::text
    and public.together_has_role(array['teacher']::text[])
   )
  )
 );

create function public.together_prompts_validate_poster()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
 v_uid uuid:=(select auth.uid());
begin
 if tg_op='UPDATE' then
  if new.poster_path is not distinct from old.poster_path then return new; end if;
 end if;
 if new.poster_path is null then return new; end if;
 if not exists (
  select 1 from storage.objects o
  where o.bucket_id='together-prompt-posters' and o.name=new.poster_path
 ) then
  raise exception using errcode='23503',message='Prompt poster object does not exist';
 end if;
 if (select auth.role())<>'service_role' and (
  v_uid is null
  or split_part(new.poster_path,'/',1)<>v_uid::text
  or not public.together_can_author_prompt_poster()
 ) then
  raise exception using errcode='42501',message='Prompt poster must belong to the acting author';
 end if;
 return new;
end;
$$;
create trigger together_prompts_validate_poster
 before insert or update of poster_path on public.together_prompts
 for each row execute function public.together_prompts_validate_poster();
revoke all on function public.together_prompts_validate_poster() from public,anon,authenticated;

commit;
