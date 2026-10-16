
create or replace function public.get_runtime_secret(secret_name text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1
$$;
revoke all on function public.get_runtime_secret(text) from public, anon, authenticated;
grant execute on function public.get_runtime_secret(text) to service_role;
create unique index if not exists purchases_external_purchase_id_uidx on public.purchases(external_purchase_id) where external_purchase_id is not null;
