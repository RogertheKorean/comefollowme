begin;

create table public.together_event_managers (
 user_id uuid not null references auth.users(id) on delete cascade,
 organization text not null check (organization in ('all','primary','relief','elders','youth','sunday-school')),
 created_at timestamptz not null default now(),
 primary key(user_id,organization)
);

alter table public.together_event_managers enable row level security;
revoke all on public.together_event_managers from anon,authenticated;
grant select on public.together_event_managers to authenticated;
create policy together_event_managers_read_self on public.together_event_managers
 for select to authenticated
 using (user_id=(select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false');

create function public.together_can_manage_event(target_organizations text[])
returns boolean language sql stable security definer set search_path='' as $$
 select
  (select auth.uid()) is not null
  and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  and coalesce(cardinality(target_organizations),0) between 1 and 6
  and target_organizations <@ array['all','primary','relief','elders','youth','sunday-school']::text[]
  and (
   public.together_has_role(array['admin']::text[])
   or exists (
    select 1 from public.together_event_managers m
    where m.user_id=(select auth.uid()) and m.organization='all'
   )
   or (
    not ('all'=any(target_organizations))
    and not exists (
     select 1 from unnest(target_organizations) requested(organization)
     where not exists (
      select 1 from public.together_event_managers m
      where m.user_id=(select auth.uid()) and m.organization=requested.organization
     )
    )
   )
  );
$$;
revoke all on function public.together_can_manage_event(text[]) from public;
grant execute on function public.together_can_manage_event(text[]) to anon,authenticated;

create function public.together_set_event_manager(target_email text,target_organization text,enabled boolean default true)
returns boolean language plpgsql security definer set search_path='' as $$
declare target_user_id uuid;
begin
 if not public.together_has_role(array['admin']::text[]) then
  raise exception 'admin role required' using errcode='42501';
 end if;
 if target_organization not in ('all','primary','relief','elders','youth','sunday-school') then
  raise exception 'invalid organization' using errcode='22023';
 end if;
 if enabled is null then
  raise exception 'enabled is required' using errcode='22004';
 end if;
 select u.id into target_user_id from auth.users u
 where lower(u.email)=lower(btrim(target_email))
  and u.email_confirmed_at is not null
  and coalesce(u.is_anonymous,false)=false
 limit 1;
 if target_user_id is null then return false; end if;
 if enabled then
  insert into public.together_event_managers(user_id,organization)
  values(target_user_id,target_organization)
  on conflict (user_id,organization) do nothing;
 else
  delete from public.together_event_managers
  where user_id=target_user_id and organization=target_organization;
 end if;
 return true;
end;
$$;
revoke all on function public.together_set_event_manager(text,text,boolean) from public,anon;
grant execute on function public.together_set_event_manager(text,text,boolean) to authenticated;

create table public.together_events (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique default substr(replace(gen_random_uuid()::text,'-',''),1,12) check (slug ~ '^[a-f0-9]{12}$'),
 title text not null check (char_length(btrim(title)) between 1 and 160),
 description text not null default '' check (char_length(description)<=5000),
 starts_at timestamptz not null,
 ends_at timestamptz not null check (ends_at>starts_at),
 timezone text not null default 'Asia/Seoul' check (char_length(btrim(timezone)) between 1 and 100),
 location text check (location is null or char_length(btrim(location)) between 1 and 300),
 organizations text[] not null check (
  cardinality(organizations) between 1 and 6
  and organizations <@ array['all','primary','relief','elders','youth','sunday-school']::text[]
 ),
 status text not null default 'draft' check (status in ('draft','published','cancelled')),
 poster_path text check (
  poster_path is null
  or (
   char_length(poster_path) between 40 and 260
   and poster_path ~ '^[a-f0-9-]{36}/[A-Za-z0-9._-]{1,200}\.(png|jpg|jpeg|webp)$'
   and split_part(poster_path,'/',1)=id::text
  )
 ),
 created_by uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index together_events_start on public.together_events(starts_at);
create index together_events_creator on public.together_events(created_by);
create index together_events_organizations on public.together_events using gin(organizations);

alter table public.together_events enable row level security;
revoke all on public.together_events from anon,authenticated;
grant select on public.together_events to anon,authenticated;
grant insert(id,title,description,starts_at,ends_at,timezone,location,organizations,status,poster_path,created_by) on public.together_events to authenticated;
grant update(title,description,starts_at,ends_at,timezone,location,organizations,status,poster_path) on public.together_events to authenticated;
grant delete on public.together_events to authenticated;

create policy together_events_read on public.together_events for select to anon,authenticated
 using (status in ('published','cancelled') or public.together_can_manage_event(organizations));
create policy together_events_create on public.together_events for insert to authenticated
 with check (created_by=(select auth.uid()) and public.together_can_manage_event(organizations));
create policy together_events_edit on public.together_events for update to authenticated
 using (public.together_can_manage_event(organizations))
 with check (public.together_can_manage_event(organizations));
create policy together_events_remove on public.together_events for delete to authenticated
 using (public.together_can_manage_event(organizations));

create function public.together_events_timestamp() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.created_at=now(); end if;
 new.updated_at=now();return new;
end;
$$;
create trigger together_events_timestamp before insert or update on public.together_events
 for each row execute function public.together_events_timestamp();
revoke all on function public.together_events_timestamp() from public;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('together-event-posters','together-event-posters',false,5242880,array['image/png','image/jpeg','image/webp']::text[])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy together_event_posters_read on storage.objects for select to anon,authenticated
 using (
  bucket_id='together-event-posters'
  and exists (
   select 1 from public.together_events e
   where (
    e.poster_path=name and e.status in ('published','cancelled')
   ) or (
    e.id::text=split_part(name,'/',1) and public.together_can_manage_event(e.organizations)
   )
  )
 );
create policy together_event_posters_create on storage.objects for insert to authenticated
 with check (
  bucket_id='together-event-posters'
  and name ~ '^[a-f0-9-]{36}/[A-Za-z0-9._-]{1,200}\.(png|jpg|jpeg|webp)$'
  and exists (
   select 1 from public.together_events e
   where e.id::text=split_part(name,'/',1) and public.together_can_manage_event(e.organizations)
  )
 );
create policy together_event_posters_remove on storage.objects for delete to authenticated
 using (
  bucket_id='together-event-posters'
  and exists (
   select 1 from public.together_events e
   where e.id::text=split_part(name,'/',1) and public.together_can_manage_event(e.organizations)
  )
 );

commit;
