
create extension if not exists pgcrypto;

create table public.product_master (
  id uuid primary key default gen_random_uuid(),
  base44_id text unique,
  canonical_key text not null unique,
  brand_name text not null,
  brand_key text not null,
  product_name text not null,
  style_number text,
  mpn text,
  primary_gtin text,
  department text,
  category text,
  subcategory text,
  product_type text,
  audiences text[] not null default '{}',
  age_groups text[] not null default '{}',
  official_description text,
  materials text[] not null default '{}',
  fit_cut text not null default 'unknown' check (fit_cut in ('compression','skinny','slim','tailored','regular','relaxed','oversized','unknown')),
  silhouette text,
  rise text,
  length_profile text,
  neckline text,
  sleeve_style text,
  closure_type text,
  footwear_type text not null default 'all' check (footwear_type in ('all','athletic_running','athletic_training','walking','casual_sneaker','dress_oxford_derby','loafer_slipon','boot_work','boot_hiking','boot_fashion','sandal','heel_pump','other')),
  season_tags text[] not null default '{}',
  occasion_tags text[] not null default '{}',
  activity_tags text[] not null default '{}',
  primary_image_url text,
  image_urls text[] not null default '{}',
  brand_product_url text,
  status text not null default 'active' check (status in ('active','discontinued','archived','unknown')),
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  canonical_confidence numeric(4,3) not null default 1 check (canonical_confidence between 0 and 1),
  dedup_status text not null default 'canonical' check (dedup_status in ('canonical','review','duplicate')),
  duplicate_of_product_master_id uuid references public.product_master(id) on delete set null,
  identifier_fingerprint text,
  legacy_product_ids text[] not null default '{}',
  source_record_count integer not null default 0 check (source_record_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variant (
  id uuid primary key default gen_random_uuid(),
  base44_id text unique,
  product_master_id uuid not null references public.product_master(id) on delete cascade,
  variant_key text not null,
  sku text,
  gtin text,
  upc text,
  ean text,
  mpn text,
  size_label text,
  size_system text,
  size_region text not null default 'US',
  color_name text,
  color_family text,
  width_code text,
  width_label text,
  length_code text,
  inseam_label text,
  band_size text,
  cup_size text,
  material_variant text,
  image_urls text[] not null default '{}',
  status text not null default 'active' check (status in ('active','unavailable','discontinued','unknown')),
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  identifier_fingerprint text,
  legacy_variant_ids text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_master_id, variant_key)
);

create table public.retailer_offer (
  id uuid primary key default gen_random_uuid(),
  base44_id text unique,
  offer_key text not null unique,
  product_master_id uuid not null references public.product_master(id) on delete cascade,
  product_variant_id uuid references public.product_variant(id) on delete set null,
  offer_scope text not null default 'variant' check (offer_scope in ('style','variant')),
  retailer_name text not null,
  retailer_key text not null,
  business_id text,
  location_id text,
  channel text not null default 'unknown' check (channel in ('brand_dtc','department_store','specialty','marketplace','local_store','other','unknown')),
  retailer_sku text,
  seller_product_id text,
  offer_url text,
  currency text not null default 'USD',
  regular_price numeric(12,2),
  current_price numeric(12,2),
  sale_price numeric(12,2),
  sale_active boolean not null default false,
  availability text not null default 'unknown' check (availability in ('in_stock','out_of_stock','limited','preorder','backorder','unknown')),
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  available_online boolean,
  available_in_store boolean,
  fulfillment text not null default 'unknown' check (fulfillment in ('shipping','pickup','shipping_and_pickup','store_only','unknown')),
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  price_checked_at timestamptz,
  availability_checked_at timestamptz,
  stale_after timestamptz,
  freshness_status text not null default 'unknown' check (freshness_status in ('fresh','aging','stale','unknown')),
  source_record_id uuid,
  source_confidence numeric(4,3) not null default 1 check (source_confidence between 0 and 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_source (
  id uuid primary key default gen_random_uuid(),
  base44_id text unique,
  source_key text not null unique,
  source_name text not null,
  owner_type text not null check (owner_type in ('brand','retailer','manufacturer','affiliate_partner','merchant','manual','other')),
  owner_name text,
  owner_key text,
  brand_key text,
  retailer_key text,
  source_type text not null check (source_type in ('official_api','affiliate_feed','merchant_feed','csv_xml','json_ld','sitemap','category_page','html','manual')),
  priority_rank smallint not null check (priority_rank between 1 and 9),
  endpoint_url text,
  auth_type text not null default 'none' check (auth_type in ('none','api_key','oauth','feed_credentials','other')),
  refresh_interval_minutes integer not null default 1440 check (refresh_interval_minutes > 0),
  supports_products boolean not null default true,
  supports_variants boolean not null default true,
  supports_price boolean not null default false,
  supports_availability boolean not null default false,
  supports_images boolean not null default true,
  terms_status text not null default 'unknown' check (terms_status in ('approved','review_required','restricted','unknown')),
  health_status text not null default 'pending' check (health_status in ('healthy','degraded','blocked','pending','disabled')),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  parser_version text,
  notes text,
  enabled boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_ingestion_run (
  id uuid primary key default gen_random_uuid(),
  base44_id text unique,
  catalog_source_id uuid references public.catalog_source(id) on delete set null,
  source_key text not null,
  run_type text not null default 'incremental' check (run_type in ('full','incremental','price_availability','verification','manual')),
  status text not null default 'queued' check (status in ('queued','running','completed','partial','failed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  discovered_count integer not null default 0,
  product_created_count integer not null default 0,
  product_updated_count integer not null default 0,
  variant_created_count integer not null default 0,
  variant_updated_count integer not null default 0,
  offer_created_count integer not null default 0,
  offer_updated_count integer not null default 0,
  duplicate_skipped_count integer not null default 0,
  failed_count integer not null default 0,
  stale_marked_count integer not null default 0,
  parser_version text,
  error_summary text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.fashion_intelligence (
  id uuid primary key default gen_random_uuid(),
  base44_id text unique,
  product_master_id uuid not null references public.product_master(id) on delete cascade,
  model_version text not null,
  derived_at timestamptz not null,
  factual_snapshot_version text,
  style_archetypes text[] not null default '{}',
  aesthetic_tags text[] not null default '{}',
  trend_tags text[] not null default '{}',
  occasion_tags text[] not null default '{}',
  season_tags text[] not null default '{}',
  outfit_roles text[] not null default '{}',
  compatible_categories text[] not null default '{}',
  formality_score numeric(4,3) check (formality_score between 0 and 1),
  versatility_score numeric(4,3) check (versatility_score between 0 and 1),
  trend_relevance_score numeric(4,3) check (trend_relevance_score between 0 and 1),
  attributes jsonb not null default '[]'::jsonb,
  source_fields_used text[] not null default '{}',
  overall_confidence numeric(4,3) check (overall_confidence between 0 and 1),
  human_reviewed boolean not null default false,
  status text not null default 'active' check (status in ('active','needs_review','superseded')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.product_source_record (
  id uuid primary key default gen_random_uuid(),
  base44_id text unique,
  entity_type text not null check (entity_type in ('product_master','product_variant','retailer_offer','fashion_intelligence')),
  entity_id uuid not null,
  catalog_source_id uuid references public.catalog_source(id) on delete set null,
  source_type text not null check (source_type in ('official_api','affiliate_feed','merchant_feed','csv_xml','json_ld','sitemap','category_page','html','manual','other')),
  source_owner_type text not null check (source_owner_type in ('brand','retailer','manufacturer','partner','manual','other')),
  source_owner_name text,
  source_owner_key text,
  source_url text,
  source_identifier text,
  observed_at timestamptz not null,
  verified_at timestamptz,
  stale_after timestamptz,
  freshness_status text not null default 'unknown' check (freshness_status in ('fresh','aging','stale','unreachable','unknown')),
  confidence numeric(4,3) not null default 1 check (confidence between 0 and 1),
  evidence_fields text[] not null default '{}',
  checksum text,
  raw_payload_ref text,
  parser_version text,
  status text not null default 'active' check (status in ('active','replaced','invalid')),
  supersedes_source_record_id uuid references public.product_source_record(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.retailer_offer
  add constraint retailer_offer_source_record_fk
  foreign key (source_record_id) references public.product_source_record(id) on delete set null;

create index product_master_brand_key_idx on public.product_master(brand_key);
create index product_master_category_idx on public.product_master(category);
create index product_master_status_active_idx on public.product_master(status, active);
create index product_master_identifier_idx on public.product_master(identifier_fingerprint) where identifier_fingerprint is not null;
create index product_variant_master_idx on public.product_variant(product_master_id);
create index product_variant_gtin_idx on public.product_variant(gtin) where gtin is not null;
create index retailer_offer_master_idx on public.retailer_offer(product_master_id);
create index retailer_offer_variant_idx on public.retailer_offer(product_variant_id);
create index retailer_offer_retailer_idx on public.retailer_offer(retailer_key, active);
create index retailer_offer_freshness_idx on public.retailer_offer(freshness_status, stale_after);
create index product_source_entity_idx on public.product_source_record(entity_type, entity_id);
create index product_source_source_idx on public.product_source_record(catalog_source_id);
create index ingestion_source_idx on public.catalog_ingestion_run(source_key, started_at desc);
create index fashion_product_idx on public.fashion_intelligence(product_master_id, active);

alter table public.product_master enable row level security;
alter table public.product_variant enable row level security;
alter table public.retailer_offer enable row level security;
alter table public.catalog_source enable row level security;
alter table public.catalog_ingestion_run enable row level security;
alter table public.product_source_record enable row level security;
alter table public.fashion_intelligence enable row level security;

grant select on public.product_master, public.product_variant, public.retailer_offer, public.fashion_intelligence to anon, authenticated;
grant all on public.product_master, public.product_variant, public.retailer_offer, public.catalog_source, public.catalog_ingestion_run, public.product_source_record, public.fashion_intelligence to service_role;

create policy "catalog products public read"
on public.product_master for select
to anon, authenticated
using (active = true and dedup_status <> 'duplicate');

create policy "catalog variants public read"
on public.product_variant for select
to anon, authenticated
using (active = true);

create policy "catalog offers public read"
on public.retailer_offer for select
to anon, authenticated
using (active = true);

create policy "fashion intelligence public read"
on public.fashion_intelligence for select
to anon, authenticated
using (active = true);

comment on table public.product_master is 'Canonical product identity shared by The Concierge and Concierge Pro.';
comment on table public.product_variant is 'Confirmed sellable/observable product variants.';
comment on table public.retailer_offer is 'Retailer-specific price, availability and fulfillment.';
comment on table public.product_source_record is 'Private provenance and freshness evidence for catalog records.';
