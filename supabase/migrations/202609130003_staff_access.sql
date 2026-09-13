begin;

create table public.together_staff (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('admin','editor','teacher')),
 created_at timestamptz not null default now()
);

alter table public.together_staff enable row level security;
revoke all on public.together_staff from anon,authenticated;
grant select on public.together_staff to authenticated;

create policy together_staff_read_self on public.together_staff
 for select to authenticated
 using (
  user_id=(select auth.uid())
  and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
 );

create function public.together_has_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select
  (select auth.uid()) is not null
  and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  and coalesce(array_length(required_roles,1),0)>0
  and exists (
   select 1
   from public.together_staff s
   where s.user_id=(select auth.uid())
    and s.role=any(required_roles)
  );
$$;

revoke all on function public.together_has_role(text[]) from public,anon;
grant execute on function public.together_has_role(text[]) to authenticated;

-- Provision the confirmed site-owner account without changing any existing grant.
insert into public.together_staff(user_id,role)
select id,'admin'
from auth.users
where lower(email)='rogernhpark@gmail.com'
 and email_confirmed_at is not null
 and coalesce(is_anonymous,false)=false
on conflict (user_id) do nothing;

commit;
