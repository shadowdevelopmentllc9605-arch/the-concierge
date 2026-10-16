
drop trigger if exists on_auth_user_claim_base44_identity on auth.users;
drop trigger if exists on_auth_user_claim_base44_business on auth.users;

create trigger base44_10_claim_identity
after insert on auth.users
for each row execute function private.claim_base44_identity_for_new_user();

create trigger base44_20_claim_business
after insert on auth.users
for each row execute function private.claim_base44_business_for_new_user();

create table if not exists public.business_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('manager','sales_associate','cashier')),
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','on_break')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);
alter table public.business_memberships enable row level security;
create index if not exists business_memberships_user_id_idx on public.business_memberships(user_id);
create index if not exists business_memberships_business_id_idx on public.business_memberships(business_id);

create or replace function private.has_business_permission(p_business_id uuid, p_permission text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      exists (
        select 1 from public.businesses b
        where b.id = p_business_id
          and b.owner_user_id = (select auth.uid())
      )
      or exists (
        select 1 from public.business_memberships m
        where m.business_id = p_business_id
          and m.user_id = (select auth.uid())
          and m.status = 'active'
          and (
            m.role = 'manager'
            or p_permission is null
            or coalesce((m.permissions ->> p_permission)::boolean, false)
          )
      )
    );
$$;
revoke all on function private.has_business_permission(uuid,text) from public, anon;
grant execute on function private.has_business_permission(uuid,text) to authenticated, service_role;

grant select on public.business_memberships to authenticated;
grant select, insert, update, delete on public.business_memberships to service_role;

drop policy if exists business_memberships_select on public.business_memberships;
create policy business_memberships_select on public.business_memberships
for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_business_permission(business_id, null)
);

drop policy if exists businesses_select_owner on public.businesses;
create policy businesses_select_member on public.businesses
for select to authenticated
using (
  owner_user_id = (select auth.uid())
  or private.has_business_permission(id, null)
);

drop policy if exists businesses_update_owner on public.businesses;
create policy businesses_update_manager on public.businesses
for update to authenticated
using (private.has_business_permission(id, 'manage_business'))
with check (private.has_business_permission(id, 'manage_business'));

drop policy if exists business_locations_select_owner on public.business_locations;
create policy business_locations_select_member on public.business_locations
for select to authenticated
using (private.has_business_permission(business_id, null));

drop policy if exists business_locations_insert_owner on public.business_locations;
create policy business_locations_insert_manager on public.business_locations
for insert to authenticated
with check (private.has_business_permission(business_id, 'edit_floor_plan'));

drop policy if exists business_locations_update_owner on public.business_locations;
create policy business_locations_update_manager on public.business_locations
for update to authenticated
using (private.has_business_permission(business_id, 'edit_floor_plan'))
with check (private.has_business_permission(business_id, 'edit_floor_plan'));

drop policy if exists business_locations_delete_owner on public.business_locations;
create policy business_locations_delete_manager on public.business_locations
for delete to authenticated
using (private.has_business_permission(business_id, 'edit_floor_plan'));

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  photo_url text,
  role text not null check (role in ('manager','sales_associate','cashier')),
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','on_break')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.employees enable row level security;
create index if not exists employees_business_id_idx on public.employees(business_id);
create index if not exists employees_location_id_idx on public.employees(location_id);
create index if not exists employees_user_id_idx on public.employees(user_id);

grant select on public.employees to authenticated;
grant insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.employees to service_role;

drop policy if exists employees_select_member on public.employees;
create policy employees_select_member on public.employees
for select to authenticated
using (private.has_business_permission(business_id, null));

drop policy if exists employees_insert_manager on public.employees;
create policy employees_insert_manager on public.employees
for insert to authenticated
with check (private.has_business_permission(business_id, 'manage_employees'));

drop policy if exists employees_update_manager on public.employees;
create policy employees_update_manager on public.employees
for update to authenticated
using (private.has_business_permission(business_id, 'manage_employees'))
with check (private.has_business_permission(business_id, 'manage_employees'));

drop policy if exists employees_delete_manager on public.employees;
create policy employees_delete_manager on public.employees
for delete to authenticated
using (private.has_business_permission(business_id, 'manage_employees'));

create table if not exists private.base44_employee_staging (
  legacy_employee_id text primary key,
  legacy_business_id text not null,
  legacy_location_id text,
  legacy_user_id text,
  employee_payload jsonb not null,
  supabase_employee_id uuid references public.employees(id) on delete set null,
  migration_status text not null default 'staged'
    check (migration_status in ('staged','linked','cutover_complete','needs_review')),
  staged_at timestamptz not null default now(),
  linked_at timestamptz
);
alter table private.base44_employee_staging enable row level security;
create index if not exists base44_employee_staging_business_idx on private.base44_employee_staging(legacy_business_id);
create index if not exists base44_employee_staging_user_idx on private.base44_employee_staging(legacy_user_id);
create index if not exists base44_employee_staging_supabase_idx on private.base44_employee_staging(supabase_employee_id);

create or replace function private.claim_base44_employee_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee record;
  v_business_id uuid;
  v_location_id uuid;
  v_employee_id uuid;
begin
  for v_employee in
    select es.*
    from private.base44_employee_staging es
    where
      es.legacy_user_id in (
        select us.legacy_user_id
        from private.base44_user_staging us
        where us.source_app='concierge_pro'
          and (us.supabase_user_id = new.id or lower(us.email)=lower(new.email))
      )
      or lower(coalesce(es.employee_payload->>'email','')) = lower(new.email)
  loop
    begin
      select bs.supabase_business_id into v_business_id
      from private.base44_business_staging bs
      where bs.legacy_business_id = v_employee.legacy_business_id;

      if v_business_id is null then
        select b.id into v_business_id
        from public.businesses b
        where b.legacy_base44_id = v_employee.legacy_business_id;
      end if;

      if v_business_id is null then
        update private.base44_employee_staging
        set migration_status='needs_review'
        where legacy_employee_id=v_employee.legacy_employee_id;
        continue;
      end if;

      v_location_id := null;
      if nullif(v_employee.legacy_location_id,'') is not null then
        select bl.id into v_location_id
        from public.business_locations bl
        where bl.legacy_base44_id = v_employee.legacy_location_id;
      end if;

      insert into public.business_memberships (
        business_id,user_id,role,permissions,status
      ) values (
        v_business_id,
        new.id,
        coalesce(nullif(v_employee.employee_payload->>'role',''),'sales_associate'),
        coalesce(v_employee.employee_payload->'permissions','{}'::jsonb),
        coalesce(nullif(v_employee.employee_payload->>'status',''),'active')
      )
      on conflict (business_id,user_id) do update set
        role=excluded.role,
        permissions=excluded.permissions,
        status=excluded.status,
        updated_at=now();

      insert into public.employees (
        legacy_base44_id,business_id,location_id,user_id,name,email,photo_url,role,permissions,status
      ) values (
        v_employee.legacy_employee_id,
        v_business_id,
        v_location_id,
        new.id,
        coalesce(nullif(v_employee.employee_payload->>'name',''),new.raw_user_meta_data->>'full_name',new.email),
        coalesce(nullif(v_employee.employee_payload->>'email',''),new.email),
        nullif(v_employee.employee_payload->>'photo_url',''),
        coalesce(nullif(v_employee.employee_payload->>'role',''),'sales_associate'),
        coalesce(v_employee.employee_payload->'permissions','{}'::jsonb),
        coalesce(nullif(v_employee.employee_payload->>'status',''),'active')
      )
      on conflict (legacy_base44_id) do update set
        business_id=excluded.business_id,
        location_id=excluded.location_id,
        user_id=excluded.user_id,
        name=excluded.name,
        email=excluded.email,
        photo_url=excluded.photo_url,
        role=excluded.role,
        permissions=excluded.permissions,
        status=excluded.status,
        updated_at=now()
      returning id into v_employee_id;

      update private.base44_employee_staging
      set supabase_employee_id=v_employee_id,
          migration_status='linked',
          linked_at=now()
      where legacy_employee_id=v_employee.legacy_employee_id;
    exception when others then
      update private.base44_employee_staging
      set migration_status='needs_review'
      where legacy_employee_id=v_employee.legacy_employee_id;
      raise warning 'Base44 employee migration needs review for legacy employee %', v_employee.legacy_employee_id;
    end;
  end loop;

  return new;
exception when others then
  raise warning 'Base44 employee claim failed for Supabase auth user %', new.id;
  return new;
end;
$$;
revoke all on function private.claim_base44_employee_for_new_user() from public, anon, authenticated;
grant execute on function private.claim_base44_employee_for_new_user() to postgres, service_role;

drop trigger if exists base44_30_claim_employee on auth.users;
create trigger base44_30_claim_employee
after insert on auth.users
for each row execute function private.claim_base44_employee_for_new_user();
