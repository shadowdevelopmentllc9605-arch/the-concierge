
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  product_master_id uuid references public.product_master(id) on delete set null,
  legacy_linked_product_id text,
  name text not null,
  sku text,
  category text,
  description text,
  price numeric not null default 0,
  cost numeric,
  image_urls text[] not null default '{}'::text[],
  dimensions jsonb,
  stock_quantity integer not null default 0,
  low_stock_threshold integer not null default 5,
  floor_position jsonb,
  sizes text[] not null default '{}'::text[],
  colors text[] not null default '{}'::text[],
  try_on_image_url text,
  size_chart jsonb,
  brand text,
  style_type text,
  footwear_type text not null default 'all',
  width_options text[] not null default '{}'::text[],
  footwear_fit jsonb,
  size_chart_measurement_basis text not null default 'body',
  garment_fit jsonb,
  garment_measurements jsonb,
  style_number text,
  mpn text,
  gtin text,
  retailer_product_url text,
  catalog_migration_status text not null default 'unlinked'
    check (catalog_migration_status in ('unlinked','linked','needs_review')),
  catalog_migrated_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.inventory_items enable row level security;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.inventory_items to service_role;

drop policy if exists inventory_items_select_member on public.inventory_items;
create policy inventory_items_select_member on public.inventory_items
for select to authenticated
using (private.has_business_permission(business_id, null));

drop policy if exists inventory_items_insert_manager on public.inventory_items;
create policy inventory_items_insert_manager on public.inventory_items
for insert to authenticated
with check (private.has_business_permission(business_id, 'manage_inventory'));

drop policy if exists inventory_items_update_manager on public.inventory_items;
create policy inventory_items_update_manager on public.inventory_items
for update to authenticated
using (private.has_business_permission(business_id, 'manage_inventory'))
with check (private.has_business_permission(business_id, 'manage_inventory'));

drop policy if exists inventory_items_delete_manager on public.inventory_items;
create policy inventory_items_delete_manager on public.inventory_items
for delete to authenticated
using (private.has_business_permission(business_id, 'manage_inventory'));

create index if not exists inventory_items_business_id_idx on public.inventory_items(business_id);
create index if not exists inventory_items_location_id_idx on public.inventory_items(location_id);
create index if not exists inventory_items_product_master_id_idx on public.inventory_items(product_master_id);
create index if not exists inventory_items_sku_idx on public.inventory_items(business_id, sku);

create table if not exists public.inventory_variants (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  product_variant_id uuid references public.product_variant(id) on delete set null,
  size_label text,
  color_name text,
  sku text,
  stock_quantity integer not null default 0,
  width_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.inventory_variants enable row level security;
grant select, insert, update, delete on public.inventory_variants to authenticated;
grant select, insert, update, delete on public.inventory_variants to service_role;

drop policy if exists inventory_variants_select_member on public.inventory_variants;
create policy inventory_variants_select_member on public.inventory_variants
for select to authenticated
using (exists (
  select 1 from public.inventory_items i
  where i.id=inventory_item_id
    and private.has_business_permission(i.business_id, null)
));

drop policy if exists inventory_variants_insert_manager on public.inventory_variants;
create policy inventory_variants_insert_manager on public.inventory_variants
for insert to authenticated
with check (exists (
  select 1 from public.inventory_items i
  where i.id=inventory_item_id
    and private.has_business_permission(i.business_id, 'manage_inventory')
));

drop policy if exists inventory_variants_update_manager on public.inventory_variants;
create policy inventory_variants_update_manager on public.inventory_variants
for update to authenticated
using (exists (
  select 1 from public.inventory_items i
  where i.id=inventory_item_id
    and private.has_business_permission(i.business_id, 'manage_inventory')
))
with check (exists (
  select 1 from public.inventory_items i
  where i.id=inventory_item_id
    and private.has_business_permission(i.business_id, 'manage_inventory')
));

drop policy if exists inventory_variants_delete_manager on public.inventory_variants;
create policy inventory_variants_delete_manager on public.inventory_variants
for delete to authenticated
using (exists (
  select 1 from public.inventory_items i
  where i.id=inventory_item_id
    and private.has_business_permission(i.business_id, 'manage_inventory')
));

create index if not exists inventory_variants_item_id_idx on public.inventory_variants(inventory_item_id);
create index if not exists inventory_variants_product_variant_id_idx on public.inventory_variants(product_variant_id);
create index if not exists inventory_variants_sku_idx on public.inventory_variants(sku);

create table if not exists public.inventory_stock_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  inventory_variant_id uuid references public.inventory_variants(id) on delete set null,
  event_key text not null,
  quantity_delta integer not null,
  reason text,
  source text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  processed_at timestamptz not null default now(),
  unique (business_id, event_key)
);
alter table public.inventory_stock_events enable row level security;
grant select, insert on public.inventory_stock_events to authenticated;
grant select, insert, update, delete on public.inventory_stock_events to service_role;

drop policy if exists inventory_stock_events_select_member on public.inventory_stock_events;
create policy inventory_stock_events_select_member on public.inventory_stock_events
for select to authenticated
using (private.has_business_permission(business_id, null));

drop policy if exists inventory_stock_events_insert_manager on public.inventory_stock_events;
create policy inventory_stock_events_insert_manager on public.inventory_stock_events
for insert to authenticated
with check (
  private.has_business_permission(business_id, 'manage_inventory')
  and (created_by_user_id is null or created_by_user_id=(select auth.uid()))
);

create index if not exists inventory_stock_events_business_id_idx on public.inventory_stock_events(business_id);
create index if not exists inventory_stock_events_item_id_idx on public.inventory_stock_events(inventory_item_id);
create index if not exists inventory_stock_events_variant_id_idx on public.inventory_stock_events(inventory_variant_id);

create table if not exists private.base44_inventory_item_staging (
  legacy_inventory_id text primary key,
  legacy_business_id text not null,
  legacy_location_id text,
  inventory_payload jsonb not null,
  migration_status text not null default 'staged'
    check (migration_status in ('staged','linked','cutover_complete','needs_review')),
  staged_at timestamptz not null default now(),
  linked_at timestamptz
);
alter table private.base44_inventory_item_staging enable row level security;
create index if not exists base44_inventory_item_staging_business_idx
  on private.base44_inventory_item_staging(legacy_business_id);
