
create table if not exists public.store_customers (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  shopper_user_id uuid references auth.users(id) on delete set null,
  legacy_linked_customer_id text,
  name text not null,
  email text,
  phone text,
  photo_url text,
  in_store boolean not null default false,
  store_position jsonb,
  entered_at timestamptz,
  assigned_employee_id uuid references public.employees(id) on delete set null,
  birthday date,
  preferences jsonb,
  total_spent numeric not null default 0,
  visit_count integer not null default 0,
  last_visit timestamptz,
  try_on_request_inventory_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.store_customers enable row level security;
grant select, insert, update, delete on public.store_customers to authenticated;
grant select, insert, update, delete on public.store_customers to service_role;

drop policy if exists store_customers_select on public.store_customers;
create policy store_customers_select on public.store_customers
for select to authenticated
using (
  shopper_user_id=(select auth.uid())
  or private.has_business_permission(business_id, null)
);

drop policy if exists store_customers_insert_member on public.store_customers;
create policy store_customers_insert_member on public.store_customers
for insert to authenticated
with check (private.has_business_permission(business_id, null));

drop policy if exists store_customers_update_member on public.store_customers;
create policy store_customers_update_member on public.store_customers
for update to authenticated
using (private.has_business_permission(business_id, null))
with check (private.has_business_permission(business_id, null));

drop policy if exists store_customers_delete_manager on public.store_customers;
create policy store_customers_delete_manager on public.store_customers
for delete to authenticated
using (private.has_business_permission(business_id, 'manage_customers'));

create index if not exists store_customers_business_id_idx on public.store_customers(business_id);
create index if not exists store_customers_shopper_user_id_idx on public.store_customers(shopper_user_id);
create index if not exists store_customers_location_id_idx on public.store_customers(location_id);

create table if not exists public.store_checkins (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  shopper_user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  location_id uuid references public.business_locations(id) on delete set null,
  legacy_vendor_id text,
  assigned_employee_id uuid references public.employees(id) on delete set null,
  status text not null default 'browsing'
    check (status in ('browsing','assisted','fitting_room','checkout','completed')),
  wishlist_item_ids uuid[] not null default '{}'::uuid[],
  checked_in_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.store_checkins enable row level security;
grant select, insert, update, delete on public.store_checkins to authenticated;
grant select, insert, update, delete on public.store_checkins to service_role;

drop policy if exists store_checkins_select on public.store_checkins;
create policy store_checkins_select on public.store_checkins
for select to authenticated
using (
  shopper_user_id=(select auth.uid())
  or (business_id is not null and private.has_business_permission(business_id, null))
);

drop policy if exists store_checkins_insert_own on public.store_checkins;
create policy store_checkins_insert_own on public.store_checkins
for insert to authenticated
with check (shopper_user_id=(select auth.uid()));

drop policy if exists store_checkins_update on public.store_checkins;
create policy store_checkins_update on public.store_checkins
for update to authenticated
using (
  shopper_user_id=(select auth.uid())
  or (business_id is not null and private.has_business_permission(business_id, null))
)
with check (
  shopper_user_id=(select auth.uid())
  or (business_id is not null and private.has_business_permission(business_id, null))
);

drop policy if exists store_checkins_delete_own on public.store_checkins;
create policy store_checkins_delete_own on public.store_checkins
for delete to authenticated
using (shopper_user_id=(select auth.uid()));

create index if not exists store_checkins_shopper_user_id_idx on public.store_checkins(shopper_user_id);
create index if not exists store_checkins_business_id_idx on public.store_checkins(business_id);

create table if not exists public.store_visits (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  customer_id uuid not null references public.store_customers(id) on delete cascade,
  checkin_id uuid references public.store_checkins(id) on delete set null,
  legacy_external_checkin_id text,
  entered_at timestamptz not null,
  exited_at timestamptz,
  status text not null default 'active' check (status in ('active','completed')),
  legacy_purchase_id text,
  order_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.store_visits enable row level security;
grant select, insert, update, delete on public.store_visits to authenticated;
grant select, insert, update, delete on public.store_visits to service_role;

drop policy if exists store_visits_select on public.store_visits;
create policy store_visits_select on public.store_visits
for select to authenticated
using (
  private.has_business_permission(business_id, null)
  or exists (
    select 1 from public.store_customers sc
    where sc.id=customer_id and sc.shopper_user_id=(select auth.uid())
  )
);

drop policy if exists store_visits_insert_member on public.store_visits;
create policy store_visits_insert_member on public.store_visits
for insert to authenticated
with check (private.has_business_permission(business_id, null));

drop policy if exists store_visits_update_member on public.store_visits;
create policy store_visits_update_member on public.store_visits
for update to authenticated
using (private.has_business_permission(business_id, null))
with check (private.has_business_permission(business_id, null));

drop policy if exists store_visits_delete_manager on public.store_visits;
create policy store_visits_delete_manager on public.store_visits
for delete to authenticated
using (private.has_business_permission(business_id, 'manage_customers'));

create index if not exists store_visits_business_id_idx on public.store_visits(business_id);
create index if not exists store_visits_customer_id_idx on public.store_visits(customer_id);
create index if not exists store_visits_checkin_id_idx on public.store_visits(checkin_id);

create table if not exists public.fitting_rooms (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  room_number text not null,
  status text not null default 'available'
    check (status in ('available','occupied','cleaning')),
  customer_id uuid references public.store_customers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, location_id, room_number)
);
alter table public.fitting_rooms enable row level security;
grant select, insert, update, delete on public.fitting_rooms to authenticated;
grant select, insert, update, delete on public.fitting_rooms to service_role;

drop policy if exists fitting_rooms_select_member on public.fitting_rooms;
create policy fitting_rooms_select_member on public.fitting_rooms
for select to authenticated
using (private.has_business_permission(business_id, null));

drop policy if exists fitting_rooms_insert_manager on public.fitting_rooms;
create policy fitting_rooms_insert_manager on public.fitting_rooms
for insert to authenticated
with check (private.has_business_permission(business_id, 'edit_floor_plan'));

drop policy if exists fitting_rooms_update_member on public.fitting_rooms;
create policy fitting_rooms_update_member on public.fitting_rooms
for update to authenticated
using (private.has_business_permission(business_id, null))
with check (private.has_business_permission(business_id, null));

drop policy if exists fitting_rooms_delete_manager on public.fitting_rooms;
create policy fitting_rooms_delete_manager on public.fitting_rooms
for delete to authenticated
using (private.has_business_permission(business_id, 'edit_floor_plan'));

create index if not exists fitting_rooms_business_id_idx on public.fitting_rooms(business_id);
create index if not exists fitting_rooms_customer_id_idx on public.fitting_rooms(customer_id);

create table if not exists public.fitting_room_items (
  id uuid primary key default gen_random_uuid(),
  fitting_room_id uuid not null references public.fitting_rooms(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  product_master_id uuid references public.product_master(id) on delete set null,
  is_suggested boolean not null default false,
  added_at timestamptz not null default now()
);
alter table public.fitting_room_items enable row level security;
grant select, insert, update, delete on public.fitting_room_items to authenticated;
grant select, insert, update, delete on public.fitting_room_items to service_role;

drop policy if exists fitting_room_items_member on public.fitting_room_items;
create policy fitting_room_items_member on public.fitting_room_items
for all to authenticated
using (exists (
  select 1 from public.fitting_rooms fr
  where fr.id=fitting_room_id
    and private.has_business_permission(fr.business_id, null)
))
with check (exists (
  select 1 from public.fitting_rooms fr
  where fr.id=fitting_room_id
    and private.has_business_permission(fr.business_id, null)
));

create index if not exists fitting_room_items_room_id_idx on public.fitting_room_items(fitting_room_id);

create table if not exists private.base44_store_interaction_staging (
  source_entity text not null check (source_entity in ('StoreCustomer','StoreCheckin','StoreVisit','FittingRoom')),
  legacy_id text not null,
  legacy_business_id text,
  legacy_user_id text,
  payload jsonb not null,
  migration_status text not null default 'staged'
    check (migration_status in ('staged','linked','cutover_complete','needs_review')),
  staged_at timestamptz not null default now(),
  linked_at timestamptz,
  primary key (source_entity, legacy_id)
);
alter table private.base44_store_interaction_staging enable row level security;
create index if not exists base44_store_interaction_business_idx
  on private.base44_store_interaction_staging(legacy_business_id);
create index if not exists base44_store_interaction_user_idx
  on private.base44_store_interaction_staging(legacy_user_id);
