begin;

-- 40001 is reserved for serialization failures and may be retried by database
-- infrastructure. Keep the proven v1 implementation internal and translate its
-- intentional optimistic-concurrency exception to an explicit HTTP 409.
alter function public.together_publish_lesson(jsonb,text)
 rename to together_publish_lesson_v1;
revoke all on function public.together_publish_lesson_v1(jsonb,text)
 from public,anon,authenticated;

create function public.together_publish_lesson(p_lesson jsonb,p_expected_version text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
 return public.together_publish_lesson_v1(p_lesson,p_expected_version);
exception
 when serialization_failure then
  raise exception using
   errcode='PT409',
   message='Published lesson changed; reload before publishing a new revision';
end;
$$;
revoke all on function public.together_publish_lesson(jsonb,text)
 from public,anon,authenticated;
grant execute on function public.together_publish_lesson(jsonb,text)
 to authenticated;

commit;
