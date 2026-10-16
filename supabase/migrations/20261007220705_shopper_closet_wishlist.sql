
create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_base44_id text unique,
  legacy_product_id text,
  product_master_id uuid references public.product_master(id) on delete set null,
  product_name text,
  product_image_url text,
  product_price numeric,
  legacy_vendor_id text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.wishlist_items enable row level security;
grant select, insert, update, delete on public.wishlist_items to authenticated;
grant select, insert, update, delete on public.wishlist_items to service_role;

drop policy if exists wishlist_items_select_own on public.wishlist_items;
create policy wishlist_items_select_own on public.wishlist_items
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists wishlist_items_insert_own on public.wishlist_items;
create policy wishlist_items_insert_own on public.wishlist_items
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists wishlist_items_update_own on public.wishlist_items;
create policy wishlist_items_update_own on public.wishlist_items
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists wishlist_items_delete_own on public.wishlist_items;
create policy wishlist_items_delete_own on public.wishlist_items
for delete to authenticated
using ((select auth.uid()) = user_id);

create index if not exists wishlist_items_user_id_idx
  on public.wishlist_items(user_id);
create index if not exists wishlist_items_product_master_id_idx
  on public.wishlist_items(product_master_id);

create table if not exists public.closet_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_base44_id text unique,
  product_master_id uuid references public.product_master(id) on delete set null,
  image_url text,
  item_type text,
  size_label text,
  color_name text,
  style_category text,
  description text,
  source text not null default 'uploaded'
    check (source in ('uploaded','purchased')),
  external_purchase_id text,
  external_line_key text,
  width_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.closet_items enable row level security;
grant select, insert, update, delete on public.closet_items to authenticated;
grant select, insert, update, delete on public.closet_items to service_role;

drop policy if exists closet_items_select_own on public.closet_items;
create policy closet_items_select_own on public.closet_items
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists closet_items_insert_own on public.closet_items;
create policy closet_items_insert_own on public.closet_items
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists closet_items_update_own on public.closet_items;
create policy closet_items_update_own on public.closet_items
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists closet_items_delete_own on public.closet_items;
create policy closet_items_delete_own on public.closet_items
for delete to authenticated
using ((select auth.uid()) = user_id);

create index if not exists closet_items_user_id_idx
  on public.closet_items(user_id);
create index if not exists closet_items_product_master_id_idx
  on public.closet_items(product_master_id);
