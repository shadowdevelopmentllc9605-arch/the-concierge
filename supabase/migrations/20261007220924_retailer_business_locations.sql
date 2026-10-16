
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  name text not null,
  logo_url text,
  floor_plan_url text,
  address text,
  phone text,
  email text,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  tax_rate numeric not null default 0,
  setup_complete boolean not null default false,
  open_procedures text,
  close_procedures text,
  linked_customer_app_legacy_id text,
  default_location_id uuid,
  stripe_connected_account_id text,
  stripe_onboarding_complete boolean not null default false,
  stripe_charges_enabled boolean not null default false,
  stripe_payouts_enabled boolean not null default false,
  stripe_transfers_enabled boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_subscription_status text,
  stripe_subscription_current_period_end timestamptz,
  stripe_subscription_cancel_at_period_end boolean not null default false,
  billing_plan text check (billing_plan is null or billing_plan in ('founding','standard')),
  billing_price_id text,
  billing_location_quantity integer not null default 1 check (billing_location_quantity >= 1),
  founding_started_at timestamptz,
  founding_expires_at timestamptz,
  platform_fee_percent numeric not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.businesses enable row level security;

revoke all on public.businesses from anon, authenticated;
grant select on public.businesses to authenticated;
grant insert (
  legacy_base44_id, name, logo_url, floor_plan_url, address, phone, email,
  owner_user_id, tax_rate, setup_complete, open_procedures, close_procedures,
  linked_customer_app_legacy_id, default_location_id
) on public.businesses to authenticated;
grant update (
  name, logo_url, floor_plan_url, address, phone, email, tax_rate,
  setup_complete, open_procedures, close_procedures, default_location_id, updated_at
) on public.businesses to authenticated;
grant delete on public.businesses to authenticated;
grant select, insert, update, delete on public.businesses to service_role;

drop policy if exists businesses_select_owner on public.businesses;
create policy businesses_select_owner on public.businesses
for select to authenticated
using ((select auth.uid()) = owner_user_id);

drop policy if exists businesses_insert_owner on public.businesses;
create policy businesses_insert_owner on public.businesses
for insert to authenticated
with check ((select auth.uid()) = owner_user_id);

drop policy if exists businesses_update_owner on public.businesses;
create policy businesses_update_owner on public.businesses
for update to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

drop policy if exists businesses_delete_owner on public.businesses;
create policy businesses_delete_owner on public.businesses
for delete to authenticated
using ((select auth.uid()) = owner_user_id);

create index if not exists businesses_owner_user_id_idx on public.businesses(owner_user_id);

create table if not exists public.business_locations (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  address text,
  latitude numeric,
  longitude numeric,
  tax_rate numeric not null default 0,
  floor_plan_url text,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.business_locations enable row level security;
grant select, insert, update, delete on public.business_locations to authenticated;
grant select, insert, update, delete on public.business_locations to service_role;

drop policy if exists business_locations_select_owner on public.business_locations;
create policy business_locations_select_owner on public.business_locations
for select to authenticated
using (exists (
  select 1 from public.businesses b
  where b.id = business_id and b.owner_user_id = (select auth.uid())
));

drop policy if exists business_locations_insert_owner on public.business_locations;
create policy business_locations_insert_owner on public.business_locations
for insert to authenticated
with check (exists (
  select 1 from public.businesses b
  where b.id = business_id and b.owner_user_id = (select auth.uid())
));

drop policy if exists business_locations_update_owner on public.business_locations;
create policy business_locations_update_owner on public.business_locations
for update to authenticated
using (exists (
  select 1 from public.businesses b
  where b.id = business_id and b.owner_user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.businesses b
  where b.id = business_id and b.owner_user_id = (select auth.uid())
));

drop policy if exists business_locations_delete_owner on public.business_locations;
create policy business_locations_delete_owner on public.business_locations
for delete to authenticated
using (exists (
  select 1 from public.businesses b
  where b.id = business_id and b.owner_user_id = (select auth.uid())
));

create index if not exists business_locations_business_id_idx on public.business_locations(business_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'businesses_default_location_id_fkey'
  ) then
    alter table public.businesses
      add constraint businesses_default_location_id_fkey
      foreign key (default_location_id) references public.business_locations(id) on delete set null;
  end if;
end $$;

create table if not exists private.base44_business_staging (
  legacy_business_id text primary key,
  owner_legacy_user_id text,
  supabase_business_id uuid references public.businesses(id) on delete set null,
  business_payload jsonb not null,
  migration_status text not null default 'staged'
    check (migration_status in ('staged','linked','cutover_complete','needs_review')),
  staged_at timestamptz not null default now(),
  linked_at timestamptz
);
alter table private.base44_business_staging enable row level security;
create index if not exists base44_business_staging_owner_legacy_user_id_idx
  on private.base44_business_staging(owner_legacy_user_id);
create index if not exists base44_business_staging_supabase_business_id_idx
  on private.base44_business_staging(supabase_business_id);

create table if not exists private.base44_business_location_staging (
  legacy_location_id text primary key,
  legacy_business_id text not null,
  supabase_location_id uuid references public.business_locations(id) on delete set null,
  location_payload jsonb not null,
  migration_status text not null default 'staged'
    check (migration_status in ('staged','linked','cutover_complete','needs_review')),
  staged_at timestamptz not null default now(),
  linked_at timestamptz
);
alter table private.base44_business_location_staging enable row level security;
create index if not exists base44_business_location_staging_business_idx
  on private.base44_business_location_staging(legacy_business_id);
create index if not exists base44_business_location_staging_supabase_location_idx
  on private.base44_business_location_staging(supabase_location_id);

create or replace function private.claim_base44_business_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business record;
  v_location record;
  v_business_id uuid;
  v_location_id uuid;
begin
  for v_business in
    select bs.*
      from private.base44_business_staging bs
     where exists (
       select 1
         from private.base44_user_staging us
        where us.source_app = 'concierge_pro'
          and us.supabase_user_id = new.id
          and (
            us.legacy_user_id = bs.owner_legacy_user_id
            or us.vendor_business_legacy_id = bs.legacy_business_id
          )
     )
  loop
    begin
      insert into public.businesses (
        legacy_base44_id,
        name,
        logo_url,
        floor_plan_url,
        address,
        phone,
        email,
        owner_user_id,
        tax_rate,
        setup_complete,
        open_procedures,
        close_procedures,
        linked_customer_app_legacy_id,
        stripe_connected_account_id,
        stripe_onboarding_complete,
        stripe_charges_enabled,
        stripe_payouts_enabled,
        stripe_transfers_enabled,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_subscription_status,
        stripe_subscription_current_period_end,
        stripe_subscription_cancel_at_period_end,
        billing_plan,
        billing_price_id,
        billing_location_quantity,
        founding_started_at,
        founding_expires_at,
        platform_fee_percent
      ) values (
        v_business.legacy_business_id,
        coalesce(nullif(v_business.business_payload->>'name',''),'Unnamed business'),
        nullif(v_business.business_payload->>'logo_url',''),
        nullif(v_business.business_payload->>'floor_plan_url',''),
        nullif(v_business.business_payload->>'address',''),
        nullif(v_business.business_payload->>'phone',''),
        nullif(v_business.business_payload->>'email',''),
        new.id,
        coalesce(nullif(v_business.business_payload->>'tax_rate','')::numeric,0),
        coalesce(nullif(v_business.business_payload->>'setup_complete','')::boolean,false),
        nullif(v_business.business_payload->>'open_procedures',''),
        nullif(v_business.business_payload->>'close_procedures',''),
        nullif(v_business.business_payload->>'linked_customer_app_id',''),
        nullif(v_business.business_payload->>'stripe_connected_account_id',''),
        coalesce(nullif(v_business.business_payload->>'stripe_onboarding_complete','')::boolean,false),
        coalesce(nullif(v_business.business_payload->>'stripe_charges_enabled','')::boolean,false),
        coalesce(nullif(v_business.business_payload->>'stripe_payouts_enabled','')::boolean,false),
        coalesce(nullif(v_business.business_payload->>'stripe_transfers_enabled','')::boolean,false),
        nullif(v_business.business_payload->>'stripe_customer_id',''),
        nullif(v_business.business_payload->>'stripe_subscription_id',''),
        nullif(v_business.business_payload->>'stripe_subscription_status',''),
        case when nullif(v_business.business_payload->>'stripe_subscription_current_period_end','') is not null
          then (v_business.business_payload->>'stripe_subscription_current_period_end')::timestamptz else null end,
        coalesce(nullif(v_business.business_payload->>'stripe_subscription_cancel_at_period_end','')::boolean,false),
        nullif(v_business.business_payload->>'billing_plan',''),
        nullif(v_business.business_payload->>'billing_price_id',''),
        greatest(coalesce(nullif(v_business.business_payload->>'billing_location_quantity','')::integer,1),1),
        case when nullif(v_business.business_payload->>'founding_started_at','') is not null
          then (v_business.business_payload->>'founding_started_at')::timestamptz else null end,
        case when nullif(v_business.business_payload->>'founding_expires_at','') is not null
          then (v_business.business_payload->>'founding_expires_at')::timestamptz else null end,
        coalesce(nullif(v_business.business_payload->>'platform_fee_percent','')::numeric,4)
      )
      on conflict (legacy_base44_id) do update set
        owner_user_id = excluded.owner_user_id,
        name = excluded.name,
        logo_url = excluded.logo_url,
        floor_plan_url = excluded.floor_plan_url,
        address = excluded.address,
        phone = excluded.phone,
        email = excluded.email,
        tax_rate = excluded.tax_rate,
        setup_complete = excluded.setup_complete,
        open_procedures = excluded.open_procedures,
        close_procedures = excluded.close_procedures,
        linked_customer_app_legacy_id = excluded.linked_customer_app_legacy_id,
        updated_at = now()
      returning id into v_business_id;

      update private.base44_business_staging
         set supabase_business_id = v_business_id,
             migration_status = 'linked',
             linked_at = now()
       where legacy_business_id = v_business.legacy_business_id;

      for v_location in
        select *
          from private.base44_business_location_staging
         where legacy_business_id = v_business.legacy_business_id
      loop
        insert into public.business_locations (
          legacy_base44_id,business_id,name,address,latitude,longitude,tax_rate,
          floor_plan_url,is_default,active
        ) values (
          v_location.legacy_location_id,
          v_business_id,
          coalesce(nullif(v_location.location_payload->>'name',''),'Location'),
          nullif(v_location.location_payload->>'address',''),
          case when nullif(v_location.location_payload->>'lat','') is not null
            then (v_location.location_payload->>'lat')::numeric else null end,
          case when nullif(v_location.location_payload->>'lng','') is not null
            then (v_location.location_payload->>'lng')::numeric else null end,
          coalesce(nullif(v_location.location_payload->>'tax_rate','')::numeric,0),
          nullif(v_location.location_payload->>'floor_plan_url',''),
          coalesce(nullif(v_location.location_payload->>'is_default','')::boolean,false),
          coalesce(nullif(v_location.location_payload->>'active','')::boolean,true)
        )
        on conflict (legacy_base44_id) do update set
          business_id = excluded.business_id,
          name = excluded.name,
          address = excluded.address,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          tax_rate = excluded.tax_rate,
          floor_plan_url = excluded.floor_plan_url,
          is_default = excluded.is_default,
          active = excluded.active,
          updated_at = now()
        returning id into v_location_id;

        update private.base44_business_location_staging
           set supabase_location_id = v_location_id,
               migration_status = 'linked',
               linked_at = now()
         where legacy_location_id = v_location.legacy_location_id;
      end loop;
    exception when others then
      update private.base44_business_staging
         set migration_status='needs_review'
       where legacy_business_id=v_business.legacy_business_id;
      raise warning 'Base44 business migration needs review for legacy business %', v_business.legacy_business_id;
    end;
  end loop;

  return new;
exception when others then
  raise warning 'Base44 business claim failed for Supabase auth user %', new.id;
  return new;
end;
$$;

revoke all on function private.claim_base44_business_for_new_user() from public, anon, authenticated;
grant execute on function private.claim_base44_business_for_new_user() to postgres, service_role;

drop trigger if exists on_auth_user_claim_base44_business on auth.users;
create trigger on_auth_user_claim_base44_business
after insert on auth.users
for each row execute function private.claim_base44_business_for_new_user();
