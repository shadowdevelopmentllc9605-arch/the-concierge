
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_master_id uuid references public.product_master(id) on delete set null,
  product_variant_id uuid references public.product_variant(id) on delete set null,
  legacy_product_id text,
  product_name text,
  product_image_url text,
  unit_price numeric,
  size_label text,
  color_name text,
  quantity integer not null default 1 check (quantity > 0),
  width_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cart_items enable row level security;
grant select, insert, update, delete on public.cart_items to authenticated;
grant select, insert, update, delete on public.cart_items to service_role;
drop policy if exists cart_items_own on public.cart_items;
create policy cart_items_own on public.cart_items
for all to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));
create index if not exists cart_items_user_id_idx on public.cart_items(user_id);

create table if not exists public.shipping_addresses (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'US',
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shipping_addresses enable row level security;
grant select, insert, update, delete on public.shipping_addresses to authenticated;
grant select, insert, update, delete on public.shipping_addresses to service_role;
drop policy if exists shipping_addresses_own on public.shipping_addresses;
create policy shipping_addresses_own on public.shipping_addresses
for all to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));
create index if not exists shipping_addresses_user_id_idx on public.shipping_addresses(user_id);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_last_four text,
  card_type text,
  expiry_month integer,
  expiry_year integer,
  is_default boolean not null default false,
  billing_address jsonb,
  processor text not null default 'stripe' check (processor='stripe'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_methods enable row level security;
grant select on public.payment_methods to authenticated;
grant select, insert, update, delete on public.payment_methods to service_role;
drop policy if exists payment_methods_select_own on public.payment_methods;
create policy payment_methods_select_own on public.payment_methods
for select to authenticated
using (user_id=(select auth.uid()));
create index if not exists payment_methods_user_id_idx on public.payment_methods(user_id);

create table if not exists private.payment_method_processor_refs (
  payment_method_id uuid primary key references public.payment_methods(id) on delete cascade,
  processor_payment_method_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.payment_method_processor_refs enable row level security;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  subtotal numeric not null default 0,
  shipping_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  discount_amount numeric not null default 0,
  total numeric not null default 0,
  concierge_attributed boolean not null default true,
  attribution_source text not null default 'concierge_online'
    check (attribution_source in ('concierge_online','concierge_store_visit','none')),
  platform_fee_percent numeric not null default 4,
  platform_fee_amount numeric not null default 0,
  platform_fee_status text not null default 'pending'
    check (platform_fee_status in ('pending','collected','accrued','waived','partially_refunded','refunded','not_applicable')),
  currency text not null default 'usd',
  payment_status text not null default 'pending'
    check (payment_status in ('pending','paid','failed','refunded')),
  fulfillment_status text not null default 'pending_payment'
    check (fulfillment_status in ('pending_payment','processing','shipped','delivered','completed','cancelled')),
  payment_provider text check (payment_provider is null or payment_provider='stripe'),
  shipping_address jsonb,
  save_card boolean not null default false,
  save_shipping_address boolean not null default false,
  pro_sync_status text not null default 'pending'
    check (pro_sync_status in ('pending','completed','partial','not_applicable')),
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;
grant select on public.orders to authenticated;
grant select, insert, update, delete on public.orders to service_role;
create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  shopper_user_id uuid not null references auth.users(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete set null,
  location_id uuid references public.business_locations(id) on delete set null,
  product_master_id uuid references public.product_master(id) on delete set null,
  product_variant_id uuid references public.product_variant(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  legacy_cart_item_id text,
  legacy_product_id text,
  product_name text not null,
  product_image_url text,
  unit_price numeric not null,
  quantity integer not null default 1 check (quantity > 0),
  size_label text,
  color_name text,
  width_code text,
  vendor_name text,
  created_at timestamptz not null default now()
);
alter table public.order_items enable row level security;
grant select on public.order_items to authenticated;
grant select, insert, update, delete on public.order_items to service_role;
drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
for select to authenticated
using (
  shopper_user_id=(select auth.uid())
  or (business_id is not null and private.has_business_permission(business_id, null))
);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_business_id_idx on public.order_items(business_id);
create index if not exists order_items_shopper_user_id_idx on public.order_items(shopper_user_id);

create or replace function private.has_order_access(p_order_id uuid)
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
        select 1 from public.orders o
        where o.id=p_order_id and o.user_id=(select auth.uid())
      )
      or exists (
        select 1 from public.order_items oi
        where oi.order_id=p_order_id
          and oi.business_id is not null
          and private.has_business_permission(oi.business_id, null)
      )
    );
$$;
revoke all on function private.has_order_access(uuid) from public, anon;
grant execute on function private.has_order_access(uuid) to authenticated, service_role;

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
for select to authenticated
using (private.has_order_access(id));

create table if not exists private.order_payment_refs (
  order_id uuid primary key references public.orders(id) on delete cascade,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.order_payment_refs enable row level security;

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  shopper_user_id uuid references auth.users(id) on delete set null,
  customer_id uuid references public.store_customers(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  location_id uuid references public.business_locations(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  purchase_type text not null default 'in_store' check (purchase_type in ('online','in_store')),
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  discount_amount numeric not null default 0,
  shipping_amount numeric not null default 0,
  total numeric not null default 0,
  payment_method text,
  status text not null default 'pending'
    check (status in ('pending','processing','shipped','delivered','completed','refunded','cancelled')),
  external_purchase_id text,
  synced_to_customer boolean not null default false,
  sync_error text,
  payment_provider text,
  concierge_attributed boolean not null default false,
  attribution_source text not null default 'none'
    check (attribution_source in ('concierge_online','concierge_store_visit','none')),
  attribution_event_id text,
  platform_fee_percent numeric not null default 4,
  platform_fee_amount numeric not null default 0,
  platform_fee_status text not null default 'not_applicable'
    check (platform_fee_status in ('pending','collected','accrued','waived','partially_refunded','refunded','not_applicable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.purchases enable row level security;
revoke all on public.purchases from anon, authenticated;
grant select on public.purchases to authenticated;
grant insert (
  shopper_user_id,customer_id,employee_id,business_id,location_id,order_id,purchase_type,
  subtotal,tax_amount,discount_amount,shipping_amount,total,payment_method,status,
  external_purchase_id,synced_to_customer,sync_error,payment_provider,
  concierge_attributed,attribution_source,attribution_event_id,platform_fee_percent,platform_fee_amount,platform_fee_status
) on public.purchases to authenticated;
grant update (
  customer_id,employee_id,location_id,status,synced_to_customer,sync_error,updated_at
) on public.purchases to authenticated;
grant select, insert, update, delete on public.purchases to service_role;

drop policy if exists purchases_select on public.purchases;
create policy purchases_select on public.purchases
for select to authenticated
using (
  shopper_user_id=(select auth.uid())
  or (business_id is not null and private.has_business_permission(business_id, null))
);

drop policy if exists purchases_insert_checkout on public.purchases;
create policy purchases_insert_checkout on public.purchases
for insert to authenticated
with check (
  business_id is not null
  and private.has_business_permission(business_id, 'process_checkout')
);

drop policy if exists purchases_update_checkout on public.purchases;
create policy purchases_update_checkout on public.purchases
for update to authenticated
using (
  business_id is not null
  and private.has_business_permission(business_id, 'process_checkout')
)
with check (
  business_id is not null
  and private.has_business_permission(business_id, 'process_checkout')
);

create index if not exists purchases_shopper_user_id_idx on public.purchases(shopper_user_id);
create index if not exists purchases_business_id_idx on public.purchases(business_id);
create index if not exists purchases_order_id_idx on public.purchases(order_id);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  product_master_id uuid references public.product_master(id) on delete set null,
  product_variant_id uuid references public.product_variant(id) on delete set null,
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric not null default 0,
  size_label text,
  color_name text,
  width_code text,
  external_line_key text,
  created_at timestamptz not null default now()
);
alter table public.purchase_items enable row level security;
grant select, insert, update, delete on public.purchase_items to authenticated;
grant select, insert, update, delete on public.purchase_items to service_role;

drop policy if exists purchase_items_select on public.purchase_items;
create policy purchase_items_select on public.purchase_items
for select to authenticated
using (exists (
  select 1 from public.purchases p
  where p.id=purchase_id
    and (
      p.shopper_user_id=(select auth.uid())
      or (p.business_id is not null and private.has_business_permission(p.business_id, null))
    )
));

drop policy if exists purchase_items_write_checkout on public.purchase_items;
create policy purchase_items_write_checkout on public.purchase_items
for all to authenticated
using (exists (
  select 1 from public.purchases p
  where p.id=purchase_id
    and p.business_id is not null
    and private.has_business_permission(p.business_id, 'process_checkout')
))
with check (exists (
  select 1 from public.purchases p
  where p.id=purchase_id
    and p.business_id is not null
    and private.has_business_permission(p.business_id, 'process_checkout')
));

create index if not exists purchase_items_purchase_id_idx on public.purchase_items(purchase_id);

create table if not exists private.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  payload jsonb not null,
  processing_status text not null default 'received'
    check (processing_status in ('received','processed','failed','ignored')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table private.stripe_webhook_events enable row level security;

create table if not exists private.base44_commerce_staging (
  source_app text not null check (source_app in ('the_concierge','concierge_pro')),
  source_entity text not null check (source_entity in ('Order','Purchase','CartItem','PaymentMethod','ShippingAddress')),
  legacy_id text not null,
  legacy_user_id text,
  legacy_business_id text,
  payload jsonb not null,
  migration_status text not null default 'staged'
    check (migration_status in ('staged','linked','cutover_complete','needs_review')),
  staged_at timestamptz not null default now(),
  linked_at timestamptz,
  primary key (source_app, source_entity, legacy_id)
);
alter table private.base44_commerce_staging enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='store_visits_order_id_fkey'
  ) then
    alter table public.store_visits
      add constraint store_visits_order_id_fkey
      foreign key (order_id) references public.orders(id) on delete set null;
  end if;
end $$;
