create or replace function public.set_closet_item_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;
revoke all on function public.set_closet_item_updated_at() from public, anon, authenticated;
create trigger closet_items_set_updated_at before update on public.closet_items
for each row execute function public.set_closet_item_updated_at();
