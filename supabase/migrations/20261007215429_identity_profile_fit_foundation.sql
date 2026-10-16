
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.base44_user_staging (
  source_app text not null check (source_app in ('the_concierge','concierge_pro')),
  legacy_user_id text not null,
  email text,
  full_name text,
  source_role text,
  vendor_business_legacy_id text,
  vendor_role text,
  vendor_permissions jsonb,
  supabase_user_id uuid references auth.users(id) on delete set null,
  migration_status text not null default 'staged'
    check (migration_status in ('staged','linked','cutover_complete','needs_review')),
  source_payload jsonb not null default '{}'::jsonb,
  staged_at timestamptz not null default now(),
  linked_at timestamptz,
  primary key (source_app, legacy_user_id)
);
alter table private.base44_user_staging enable row level security;

create table if not exists private.base44_profile_staging (
  legacy_profile_id text primary key,
  legacy_user_id text not null,
  supabase_user_id uuid references auth.users(id) on delete set null,
  profile_payload jsonb not null,
  migration_status text not null default 'staged'
    check (migration_status in ('staged','linked','cutover_complete','needs_review')),
  staged_at timestamptz not null default now(),
  linked_at timestamptz
);
alter table private.base44_profile_staging enable row level security;

create table if not exists private.base44_measurement_validation_staging (
  legacy_record_id text primary key,
  legacy_user_id text not null,
  supabase_user_id uuid references auth.users(id) on delete set null,
  record_payload jsonb not null,
  migration_status text not null default 'staged'
    check (migration_status in ('staged','linked','cutover_complete','needs_review')),
  staged_at timestamptz not null default now(),
  linked_at timestamptz
);
alter table private.base44_measurement_validation_staging enable row level security;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  legacy_base44_user_id text unique,
  display_name text,
  birthday date,
  gender text check (gender is null or gender in ('male','female','prefer_not_to_say')),
  profile_picture_url text,
  style_preferences text[] not null default '{}'::text[],
  onboarding_completed boolean not null default false,
  onboarding_step integer not null default 1 check (onboarding_step >= 1),
  wishlist_visibility text not null default 'private'
    check (wishlist_visibility in ('public','private')),
  measurement_unit text not null default 'imperial'
    check (measurement_unit in ('metric','imperial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table if not exists public.fit_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  body_scan_front_path text,
  body_scan_side_path text,
  body_scan_back_path text,
  precision_scan_foot_left_path text,
  precision_scan_foot_right_path text,
  precision_scan_head_front_path text,
  precision_scan_head_side_path text,
  measurement_confidence numeric check (measurement_confidence is null or (measurement_confidence >= 0 and measurement_confidence <= 100)),
  measurement_method text,
  measurement_updated_at timestamptz,
  measurement_values_cm jsonb,
  legacy_measurements jsonb,
  suggested_sizes jsonb,
  measurement_validation_status text not null default 'estimated'
    check (measurement_validation_status in ('estimated','reviewed','partially_verified','verified')),
  measurement_sources jsonb,
  measurement_confidence_by_field jsonb,
  measurement_scan_diagnostics jsonb,
  measurement_protocol_version text,
  measurement_scan_values_cm jsonb,
  measurement_reference_standard text not null default 'concierge_anthropometry_v1',
  precision_measurement_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.fit_profiles enable row level security;

create table if not exists public.measurement_validation_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_base44_record_id text unique,
  protocol_version text not null,
  scan_method text,
  scan_timestamp timestamptz,
  verification_timestamp timestamptz,
  scan_quality numeric,
  scan_values_cm jsonb,
  reference_values_cm jsonb not null default '{}'::jsonb,
  absolute_errors_cm jsonb,
  verified_fields text[] not null default '{}'::text[],
  diagnostics jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.measurement_validation_records enable row level security;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.fit_profiles to authenticated;
grant select, insert, update, delete on public.measurement_validation_records to authenticated;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.fit_profiles to service_role;
grant select, insert, update, delete on public.measurement_validation_records to service_role;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists fit_profiles_select_own on public.fit_profiles;
create policy fit_profiles_select_own on public.fit_profiles
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists fit_profiles_insert_own on public.fit_profiles;
create policy fit_profiles_insert_own on public.fit_profiles
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists fit_profiles_update_own on public.fit_profiles;
create policy fit_profiles_update_own on public.fit_profiles
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists fit_profiles_delete_own on public.fit_profiles;
create policy fit_profiles_delete_own on public.fit_profiles
for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists measurement_validation_select_own on public.measurement_validation_records;
create policy measurement_validation_select_own on public.measurement_validation_records
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists measurement_validation_insert_own on public.measurement_validation_records;
create policy measurement_validation_insert_own on public.measurement_validation_records
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists measurement_validation_update_own on public.measurement_validation_records;
create policy measurement_validation_update_own on public.measurement_validation_records
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists measurement_validation_delete_own on public.measurement_validation_records;
create policy measurement_validation_delete_own on public.measurement_validation_records
for delete to authenticated
using ((select auth.uid()) = user_id);

create index if not exists measurement_validation_records_user_id_idx
  on public.measurement_validation_records(user_id);
