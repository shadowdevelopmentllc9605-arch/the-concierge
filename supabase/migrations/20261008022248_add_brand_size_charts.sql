
create table if not exists public.brand_size_charts (
 id uuid primary key default gen_random_uuid(),
 legacy_base44_id text unique,
 brand_name text not null,
 brand_key text not null,
 parent_name text,
 manufacturer_name text,
 relationship_type text,
 region text not null default 'US',
 audience text,
 category_group text,
 chart_name text not null,
 fit_type text,
 measurement_basis text default 'body',
 source_url text not null,
 source_retrieved_at timestamptz,
 source_type text,
 active boolean not null default true,
 version text,
 notes text,
 entries jsonb not null default '[]'::jsonb,
 gender_detail text,
 footwear_type text,
 last_name text,
 width_system text,
 fit_guidance text,
 sock_profile text,
 size_adjustment_steps numeric,
 age_group text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists brand_size_charts_brand_key_idx on public.brand_size_charts(brand_key);
create index if not exists brand_size_charts_lookup_idx on public.brand_size_charts(brand_key,audience,category_group,active);
alter table public.brand_size_charts enable row level security;
drop policy if exists brand_size_charts_read on public.brand_size_charts;
create policy brand_size_charts_read on public.brand_size_charts for select using (active = true);
