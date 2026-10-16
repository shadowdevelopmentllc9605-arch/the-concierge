
create index if not exists base44_user_staging_supabase_user_id_idx
  on private.base44_user_staging(supabase_user_id);
create index if not exists base44_profile_staging_supabase_user_id_idx
  on private.base44_profile_staging(supabase_user_id);
create index if not exists base44_measurement_validation_staging_supabase_user_id_idx
  on private.base44_measurement_validation_staging(supabase_user_id);
create index if not exists base44_user_staging_email_idx
  on private.base44_user_staging(lower(email));
create index if not exists base44_profile_staging_legacy_user_id_idx
  on private.base44_profile_staging(legacy_user_id);
create index if not exists base44_measurement_validation_staging_legacy_user_id_idx
  on private.base44_measurement_validation_staging(legacy_user_id);
