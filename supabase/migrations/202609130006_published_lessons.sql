begin;

-- Each id/version pair is a permanent content address used by saved note anchors.
create table public.together_published_lessons (
 revision_number bigint generated always as identity primary key,
 lesson_id text not null check (lesson_id ~ '^[A-Za-z0-9_-]{1,100}$'),
 version text not null check (version ~ '^[A-Za-z0-9_-]{1,100}$'),
 lesson jsonb not null check (
  jsonb_typeof(lesson)='object'
  and octet_length(lesson::text)<=2500000
  and lesson->>'id'=lesson_id
  and lesson->>'version'=version
 ),
 published_by uuid not null references auth.users(id),
 published_at timestamptz not null default now(),
 unique (lesson_id,version)
);
create index together_published_lessons_latest
 on public.together_published_lessons(lesson_id,revision_number desc);

alter table public.together_published_lessons enable row level security;
revoke all on public.together_published_lessons from anon,authenticated;
grant select(lesson_id,version,lesson,revision_number,published_at)
 on public.together_published_lessons to anon,authenticated;
create policy together_published_lessons_read on public.together_published_lessons
 for select to anon,authenticated using (true);

-- This validator mirrors ReferenceEngine.validateLesson after it has whitelisted
-- and normalized the reviewed browser payload. It also rejects hidden JSON keys.
create function public.together_validate_published_lesson(p_lesson jsonb)
returns void
language plpgsql
immutable
set search_path=''
as $$
declare
 v_section jsonb;
 v_block jsonb;
 v_total bigint:=0;
begin
 if p_lesson is null or jsonb_typeof(p_lesson)<>'object' or octet_length(p_lesson::text)>2500000 then
  raise exception using errcode='22023',message='Invalid lesson object or size';
 end if;
 if not (p_lesson ?& array['id','version','title','date','sourceUrl','sourceLabel','translationStatus','alignment','raw','sections','blocks'])
  or exists(select 1 from jsonb_object_keys(p_lesson) k where k<>all(array['id','version','title','date','sourceUrl','sourceLabel','translationStatus','alignment','raw','sections','blocks'])) then
  raise exception using errcode='22023',message='Invalid lesson fields';
 end if;
 if jsonb_typeof(p_lesson->'id')<>'string' or (p_lesson->>'id')!~'^[A-Za-z0-9_-]{1,100}$'
  or jsonb_typeof(p_lesson->'version')<>'string' or (p_lesson->>'version')!~'^[A-Za-z0-9_-]{1,100}$' then
  raise exception using errcode='22023',message='Invalid lesson identity';
 end if;
 if jsonb_typeof(p_lesson->'title')<>'object'
  or not ((p_lesson->'title') ?& array['ko','en'])
  or exists(select 1 from jsonb_object_keys(p_lesson->'title') k where k<>all(array['ko','en']))
  or jsonb_typeof(p_lesson->'title'->'ko')<>'string' or char_length(btrim(p_lesson->'title'->>'ko')) not between 1 and 500
  or jsonb_typeof(p_lesson->'title'->'en')<>'string' or char_length(p_lesson->'title'->>'en')>500 then
  raise exception using errcode='22023',message='Invalid lesson title';
 end if;
 if jsonb_typeof(p_lesson->'date')<>'object'
  or not ((p_lesson->'date') ?& array['ko','en'])
  or exists(select 1 from jsonb_object_keys(p_lesson->'date') k where k<>all(array['ko','en']))
  or jsonb_typeof(p_lesson->'date'->'ko')<>'string' or char_length(p_lesson->'date'->>'ko')>200
  or jsonb_typeof(p_lesson->'date'->'en')<>'string' or char_length(p_lesson->'date'->>'en')>200 then
  raise exception using errcode='22023',message='Invalid lesson date';
 end if;
 if jsonb_typeof(p_lesson->'sourceUrl')<>'object'
  or not ((p_lesson->'sourceUrl') ?& array['ko','en'])
  or exists(select 1 from jsonb_object_keys(p_lesson->'sourceUrl') k where k<>all(array['ko','en']))
  or jsonb_typeof(p_lesson->'sourceUrl'->'ko')<>'string'
  or char_length(p_lesson->'sourceUrl'->>'ko')>4096
  or (p_lesson->'sourceUrl'->>'ko')!~'^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$'
  or jsonb_typeof(p_lesson->'sourceUrl'->'en')<>'string'
  or char_length(p_lesson->'sourceUrl'->>'en')>4096
  or ((p_lesson->'sourceUrl'->>'en')<>'' and (p_lesson->'sourceUrl'->>'en')!~'^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$') then
  raise exception using errcode='22023',message='Invalid lesson source URL';
 end if;
 if jsonb_typeof(p_lesson->'sourceLabel')<>'string' or char_length(p_lesson->>'sourceLabel')>200
  or jsonb_typeof(p_lesson->'translationStatus')<>'string' or char_length(p_lesson->>'translationStatus')>120
  or jsonb_typeof(p_lesson->'alignment')<>'string' or char_length(p_lesson->>'alignment')>120 then
  raise exception using errcode='22023',message='Invalid lesson metadata';
 end if;
 if jsonb_typeof(p_lesson->'raw')<>'object'
  or not ((p_lesson->'raw') ?& array['ko','en'])
  or exists(select 1 from jsonb_object_keys(p_lesson->'raw') k where k<>all(array['ko','en']))
  or jsonb_typeof(p_lesson->'raw'->'ko')<>'string' or char_length(p_lesson->'raw'->>'ko')>400000
  or jsonb_typeof(p_lesson->'raw'->'en')<>'string' or char_length(p_lesson->'raw'->>'en')>400000 then
  raise exception using errcode='22023',message='Invalid lesson raw text';
 end if;
 if jsonb_typeof(p_lesson->'sections')<>'array' or jsonb_array_length(p_lesson->'sections') not between 1 and 200 then
  raise exception using errcode='22023',message='Invalid lesson sections';
 end if;
 for v_section in select value from jsonb_array_elements(p_lesson->'sections') loop
  if jsonb_typeof(v_section)<>'object' or not (v_section ?& array['id','ko','en'])
   or exists(select 1 from jsonb_object_keys(v_section) k where k<>all(array['id','ko','en']))
   or jsonb_typeof(v_section->'id')<>'string' or (v_section->>'id')!~'^[A-Za-z0-9_-]{1,100}$'
   or jsonb_typeof(v_section->'ko')<>'string' or char_length(v_section->>'ko')>1000
   or jsonb_typeof(v_section->'en')<>'string' or char_length(v_section->>'en')>1000 then
   raise exception using errcode='22023',message='Invalid lesson section';
  end if;
 end loop;
 if (select count(*) from jsonb_array_elements(p_lesson->'sections'))<>(select count(distinct value->>'id') from jsonb_array_elements(p_lesson->'sections')) then
  raise exception using errcode='22023',message='Duplicate lesson section';
 end if;
 if jsonb_typeof(p_lesson->'blocks')<>'array' or jsonb_array_length(p_lesson->'blocks') not between 1 and 2000 then
  raise exception using errcode='22023',message='Invalid lesson blocks';
 end if;
 for v_block in select value from jsonb_array_elements(p_lesson->'blocks') loop
  if jsonb_typeof(v_block)<>'object' or not (v_block ?& array['id','sectionId','conceptId','kind','ko','en'])
   or exists(select 1 from jsonb_object_keys(v_block) k where k<>all(array['id','sectionId','conceptId','kind','ko','en']))
   or jsonb_typeof(v_block->'id')<>'string' or (v_block->>'id')!~'^[A-Za-z0-9_-]{1,100}$'
   or jsonb_typeof(v_block->'sectionId')<>'string' or (v_block->>'sectionId')!~'^[A-Za-z0-9_-]{1,100}$'
   or not exists(select 1 from jsonb_array_elements(p_lesson->'sections') s where s->>'id'=v_block->>'sectionId')
   or jsonb_typeof(v_block->'conceptId')<>'string' or char_length(v_block->>'conceptId')>250
   or jsonb_typeof(v_block->'kind')<>'string' or not ((v_block->>'kind')=any(array['text','media','title','references','credit','heading','quote']))
   or jsonb_typeof(v_block->'ko')<>'string' or char_length(v_block->>'ko')>100000
   or jsonb_typeof(v_block->'en')<>'string' or char_length(v_block->>'en')>100000 then
   raise exception using errcode='22023',message='Invalid lesson block';
  end if;
  v_total:=v_total+char_length(v_block->>'ko')+char_length(v_block->>'en');
 end loop;
 if v_total>800000 or (select count(*) from jsonb_array_elements(p_lesson->'blocks'))<>(select count(distinct value->>'id') from jsonb_array_elements(p_lesson->'blocks')) then
  raise exception using errcode='22023',message='Duplicate or oversized lesson blocks';
 end if;
end;
$$;
revoke all on function public.together_validate_published_lesson(jsonb) from public,anon,authenticated;

create function public.together_published_lessons_immutable()
returns trigger
language plpgsql
set search_path=''
as $$
begin
 if (select auth.role())='service_role' then
  if tg_op='DELETE' then return old; end if;
  return new;
 end if;
 raise exception using errcode='55000',message='Published lesson revisions are immutable';
end;
$$;
create trigger together_published_lessons_immutable
 before update or delete on public.together_published_lessons
 for each row execute function public.together_published_lessons_immutable();
revoke all on function public.together_published_lessons_immutable() from public,anon,authenticated;

create function public.together_publish_lesson(p_lesson jsonb,p_expected_version text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 v_user_id uuid:=(select auth.uid());
 v_lesson_id text;
 v_version text;
 v_current_version text;
 v_row public.together_published_lessons%rowtype;
begin
 if v_user_id is null
  or coalesce((select auth.jwt()->>'is_anonymous'),'false')<>'false'
  or not exists(select 1 from auth.users u where u.id=v_user_id and u.email_confirmed_at is not null and coalesce(u.is_anonymous,false)=false)
  or not public.together_has_role(array['admin','editor']::text[]) then
  raise exception using errcode='42501',message='Confirmed admin or editor access is required';
 end if;
 perform public.together_validate_published_lesson(p_lesson);
 if p_expected_version is not null and p_expected_version!~'^[A-Za-z0-9_-]{1,100}$' then
  raise exception using errcode='22023',message='Invalid expected lesson version';
 end if;
 v_lesson_id:=p_lesson->>'id';
 v_version:=p_lesson->>'version';
 perform pg_advisory_xact_lock(hashtextextended(v_lesson_id,0));

 select * into v_row from public.together_published_lessons
  where lesson_id=v_lesson_id and version=v_version;
 if found then
  if v_row.lesson<>p_lesson then
   raise exception using errcode='23505',message='Lesson version already exists with different content';
  end if;
  return jsonb_build_object('lesson',v_row.lesson,'lessonId',v_row.lesson_id,'version',v_row.version,'revisionNumber',v_row.revision_number,'publishedAt',v_row.published_at,'idempotent',true);
 end if;

 select version into v_current_version from public.together_published_lessons
  where lesson_id=v_lesson_id order by revision_number desc limit 1;
 if found then
  if p_expected_version is null or p_expected_version<>v_current_version then
   raise exception using errcode='40001',message='Published lesson changed; reload before publishing a new revision';
  end if;
 elsif p_expected_version is not null then
  raise exception using errcode='40001',message='Published lesson changed or was removed; reload before publishing';
 end if;

 insert into public.together_published_lessons(lesson_id,version,lesson,published_by)
 values(v_lesson_id,v_version,p_lesson,v_user_id)
 returning * into v_row;
 return jsonb_build_object('lesson',v_row.lesson,'lessonId',v_row.lesson_id,'version',v_row.version,'revisionNumber',v_row.revision_number,'publishedAt',v_row.published_at,'idempotent',false);
end;
$$;
revoke all on function public.together_publish_lesson(jsonb,text) from public,anon,authenticated;
grant execute on function public.together_publish_lesson(jsonb,text) to authenticated;

commit;
