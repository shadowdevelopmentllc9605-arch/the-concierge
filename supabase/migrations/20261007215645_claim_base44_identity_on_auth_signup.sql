
create or replace function private.claim_base44_identity_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_legacy_user record;
  v_profile record;
  v_validation record;
  v_birthday date;
begin
  if new.email is null then
    return new;
  end if;

  update private.base44_user_staging
     set supabase_user_id = new.id,
         migration_status = 'linked',
         linked_at = now()
   where lower(email) = lower(new.email)
     and (supabase_user_id is null or supabase_user_id = new.id);

  select source_app, legacy_user_id, full_name
    into v_legacy_user
    from private.base44_user_staging
   where supabase_user_id = new.id
   order by case when source_app = 'the_concierge' then 0 else 1 end
   limit 1;

  if found then
    insert into public.profiles (
      user_id, legacy_base44_user_id, display_name, created_at, updated_at
    ) values (
      new.id, v_legacy_user.legacy_user_id, v_legacy_user.full_name, now(), now()
    )
    on conflict (user_id) do update set
      display_name = coalesce(excluded.display_name, public.profiles.display_name),
      legacy_base44_user_id = coalesce(public.profiles.legacy_base44_user_id, excluded.legacy_base44_user_id),
      updated_at = now();
  end if;

  for v_profile in
    select p.*
      from private.base44_profile_staging p
      join private.base44_user_staging u
        on u.source_app = 'the_concierge'
       and u.legacy_user_id = p.legacy_user_id
     where u.supabase_user_id = new.id
  loop
    begin
      v_birthday := case
        when coalesce(v_profile.profile_payload->>'birthday','') ~ '^\d{4}-\d{2}-\d{2}$'
          then (v_profile.profile_payload->>'birthday')::date
        else null
      end;

      insert into public.profiles (
        user_id,
        legacy_base44_user_id,
        display_name,
        birthday,
        gender,
        profile_picture_url,
        style_preferences,
        onboarding_completed,
        onboarding_step,
        wishlist_visibility,
        measurement_unit,
        created_at,
        updated_at
      )
      select
        new.id,
        v_profile.legacy_user_id,
        coalesce(
          (select full_name from private.base44_user_staging
            where source_app='the_concierge'
              and legacy_user_id=v_profile.legacy_user_id
            limit 1),
          new.raw_user_meta_data->>'full_name'
        ),
        v_birthday,
        nullif(v_profile.profile_payload->>'gender',''),
        nullif(v_profile.profile_payload->>'profile_picture',''),
        coalesce(
          array(select jsonb_array_elements_text(coalesce(v_profile.profile_payload->'style_preferences','[]'::jsonb))),
          '{}'::text[]
        ),
        coalesce((v_profile.profile_payload->>'onboarding_completed')::boolean, false),
        greatest(coalesce((v_profile.profile_payload->>'onboarding_step')::integer, 1),1),
        coalesce(nullif(v_profile.profile_payload->>'wishlist_visibility',''),'private'),
        coalesce(nullif(v_profile.profile_payload->>'measurement_unit',''),'imperial'),
        now(),
        now()
      on conflict (user_id) do update set
        legacy_base44_user_id = excluded.legacy_base44_user_id,
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        birthday = excluded.birthday,
        gender = excluded.gender,
        profile_picture_url = excluded.profile_picture_url,
        style_preferences = excluded.style_preferences,
        onboarding_completed = excluded.onboarding_completed,
        onboarding_step = excluded.onboarding_step,
        wishlist_visibility = excluded.wishlist_visibility,
        measurement_unit = excluded.measurement_unit,
        updated_at = now();

      insert into public.fit_profiles (
        user_id,
        body_scan_front_path,
        body_scan_side_path,
        body_scan_back_path,
        precision_scan_foot_left_path,
        precision_scan_foot_right_path,
        precision_scan_head_front_path,
        precision_scan_head_side_path,
        measurement_confidence,
        measurement_method,
        measurement_updated_at,
        measurement_values_cm,
        legacy_measurements,
        suggested_sizes,
        measurement_validation_status,
        measurement_sources,
        measurement_confidence_by_field,
        measurement_scan_diagnostics,
        measurement_protocol_version,
        measurement_scan_values_cm,
        measurement_reference_standard,
        precision_measurement_metadata,
        created_at,
        updated_at
      ) values (
        new.id,
        nullif(v_profile.profile_payload->>'body_scan_front',''),
        nullif(v_profile.profile_payload->>'body_scan_side',''),
        nullif(v_profile.profile_payload->>'body_scan_back',''),
        nullif(v_profile.profile_payload->>'precision_scan_foot_left',''),
        nullif(v_profile.profile_payload->>'precision_scan_foot_right',''),
        nullif(v_profile.profile_payload->>'precision_scan_head_front',''),
        nullif(v_profile.profile_payload->>'precision_scan_head_side',''),
        case when nullif(v_profile.profile_payload->>'measurement_confidence','') is not null
          then (v_profile.profile_payload->>'measurement_confidence')::numeric else null end,
        nullif(v_profile.profile_payload->>'measurement_method',''),
        case when nullif(v_profile.profile_payload->>'measurement_updated_at','') is not null
          then (v_profile.profile_payload->>'measurement_updated_at')::timestamptz else null end,
        v_profile.profile_payload->'measurement_values_cm',
        v_profile.profile_payload->'measurements',
        v_profile.profile_payload->'suggested_sizes',
        coalesce(nullif(v_profile.profile_payload->>'measurement_validation_status',''),'estimated'),
        v_profile.profile_payload->'measurement_sources',
        v_profile.profile_payload->'measurement_confidence_by_field',
        v_profile.profile_payload->'measurement_scan_diagnostics',
        nullif(v_profile.profile_payload->>'measurement_protocol_version',''),
        v_profile.profile_payload->'measurement_scan_values_cm',
        coalesce(nullif(v_profile.profile_payload->>'measurement_reference_standard',''),'concierge_anthropometry_v1'),
        v_profile.profile_payload->'precision_measurement_metadata',
        now(),
        now()
      )
      on conflict (user_id) do update set
        body_scan_front_path = excluded.body_scan_front_path,
        body_scan_side_path = excluded.body_scan_side_path,
        body_scan_back_path = excluded.body_scan_back_path,
        precision_scan_foot_left_path = excluded.precision_scan_foot_left_path,
        precision_scan_foot_right_path = excluded.precision_scan_foot_right_path,
        precision_scan_head_front_path = excluded.precision_scan_head_front_path,
        precision_scan_head_side_path = excluded.precision_scan_head_side_path,
        measurement_confidence = excluded.measurement_confidence,
        measurement_method = excluded.measurement_method,
        measurement_updated_at = excluded.measurement_updated_at,
        measurement_values_cm = excluded.measurement_values_cm,
        legacy_measurements = excluded.legacy_measurements,
        suggested_sizes = excluded.suggested_sizes,
        measurement_validation_status = excluded.measurement_validation_status,
        measurement_sources = excluded.measurement_sources,
        measurement_confidence_by_field = excluded.measurement_confidence_by_field,
        measurement_scan_diagnostics = excluded.measurement_scan_diagnostics,
        measurement_protocol_version = excluded.measurement_protocol_version,
        measurement_scan_values_cm = excluded.measurement_scan_values_cm,
        measurement_reference_standard = excluded.measurement_reference_standard,
        precision_measurement_metadata = excluded.precision_measurement_metadata,
        updated_at = now();

      update private.base44_profile_staging
         set supabase_user_id = new.id,
             migration_status = 'linked',
             linked_at = now()
       where legacy_profile_id = v_profile.legacy_profile_id;
    exception when others then
      update private.base44_profile_staging
         set migration_status = 'needs_review'
       where legacy_profile_id = v_profile.legacy_profile_id;
      raise warning 'Base44 profile migration needs review for legacy profile %', v_profile.legacy_profile_id;
    end;
  end loop;

  for v_validation in
    select m.*
      from private.base44_measurement_validation_staging m
      join private.base44_user_staging u
        on u.source_app = 'the_concierge'
       and u.legacy_user_id = m.legacy_user_id
     where u.supabase_user_id = new.id
  loop
    begin
      insert into public.measurement_validation_records (
        user_id,
        legacy_base44_record_id,
        protocol_version,
        scan_method,
        scan_timestamp,
        verification_timestamp,
        scan_quality,
        scan_values_cm,
        reference_values_cm,
        absolute_errors_cm,
        verified_fields,
        diagnostics,
        notes
      ) values (
        new.id,
        v_validation.legacy_record_id,
        coalesce(nullif(v_validation.record_payload->>'protocol_version',''),'legacy_unknown'),
        nullif(v_validation.record_payload->>'scan_method',''),
        case when nullif(v_validation.record_payload->>'scan_timestamp','') is not null
          then (v_validation.record_payload->>'scan_timestamp')::timestamptz else null end,
        case when nullif(v_validation.record_payload->>'verification_timestamp','') is not null
          then (v_validation.record_payload->>'verification_timestamp')::timestamptz else null end,
        case when nullif(v_validation.record_payload->>'scan_quality','') is not null
          then (v_validation.record_payload->>'scan_quality')::numeric else null end,
        v_validation.record_payload->'scan_values_cm',
        coalesce(v_validation.record_payload->'reference_values_cm','{}'::jsonb),
        v_validation.record_payload->'absolute_errors_cm',
        coalesce(
          array(select jsonb_array_elements_text(coalesce(v_validation.record_payload->'verified_fields','[]'::jsonb))),
          '{}'::text[]
        ),
        v_validation.record_payload->'diagnostics',
        nullif(v_validation.record_payload->>'notes','')
      )
      on conflict (legacy_base44_record_id) do update set
        user_id = excluded.user_id,
        protocol_version = excluded.protocol_version,
        scan_method = excluded.scan_method,
        scan_timestamp = excluded.scan_timestamp,
        verification_timestamp = excluded.verification_timestamp,
        scan_quality = excluded.scan_quality,
        scan_values_cm = excluded.scan_values_cm,
        reference_values_cm = excluded.reference_values_cm,
        absolute_errors_cm = excluded.absolute_errors_cm,
        verified_fields = excluded.verified_fields,
        diagnostics = excluded.diagnostics,
        notes = excluded.notes,
        updated_at = now();

      update private.base44_measurement_validation_staging
         set supabase_user_id = new.id,
             migration_status = 'linked',
             linked_at = now()
       where legacy_record_id = v_validation.legacy_record_id;
    exception when others then
      update private.base44_measurement_validation_staging
         set migration_status = 'needs_review'
       where legacy_record_id = v_validation.legacy_record_id;
      raise warning 'Base44 validation migration needs review for legacy record %', v_validation.legacy_record_id;
    end;
  end loop;

  return new;
exception when others then
  raise warning 'Base44 identity claim failed for Supabase auth user %', new.id;
  return new;
end;
$$;

revoke all on function private.claim_base44_identity_for_new_user() from public, anon, authenticated;
grant execute on function private.claim_base44_identity_for_new_user() to postgres, service_role;

drop trigger if exists on_auth_user_claim_base44_identity on auth.users;
create trigger on_auth_user_claim_base44_identity
after insert on auth.users
for each row execute function private.claim_base44_identity_for_new_user();
