do $$
declare r record; idx_name text;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name, con.conname,
           string_agg(quote_ident(a.attname), ', ' order by u.ord) as cols
    from pg_constraint con
    join pg_class c on c.oid=con.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    join unnest(con.conkey) with ordinality as u(attnum,ord) on true
    join pg_attribute a on a.attrelid=c.oid and a.attnum=u.attnum
    where con.contype='f' and n.nspname in ('public','private')
      and not exists (
        select 1 from pg_index i
        where i.indrelid=con.conrelid
          and i.indisvalid
          and (i.indkey::smallint[])[0:cardinality(con.conkey)-1] = con.conkey
      )
    group by n.nspname,c.relname,con.conname,con.conrelid,con.conkey
  loop
    idx_name := left(r.table_name,35)||'_fk_'||substr(md5(r.conname),1,10)||'_idx';
    execute format('create index if not exists %I on %I.%I (%s)',idx_name,r.schema_name,r.table_name,r.cols);
  end loop;
end $$;

drop policy if exists payroll_manager_write on public.payroll_records;
create policy payroll_manager_insert on public.payroll_records for insert to authenticated
with check (private.has_business_permission(business_id,'view_payroll'));
create policy payroll_manager_update on public.payroll_records for update to authenticated
using (private.has_business_permission(business_id,'view_payroll'))
with check (private.has_business_permission(business_id,'view_payroll'));
create policy payroll_manager_delete on public.payroll_records for delete to authenticated
using (private.has_business_permission(business_id,'view_payroll'));

drop policy if exists purchase_items_write_checkout on public.purchase_items;
create policy purchase_items_insert_checkout on public.purchase_items for insert to authenticated
with check (exists (select 1 from public.purchases p where p.id=purchase_items.purchase_id and p.business_id is not null and private.has_business_permission(p.business_id,'process_checkout')));
create policy purchase_items_update_checkout on public.purchase_items for update to authenticated
using (exists (select 1 from public.purchases p where p.id=purchase_items.purchase_id and p.business_id is not null and private.has_business_permission(p.business_id,'process_checkout')))
with check (exists (select 1 from public.purchases p where p.id=purchase_items.purchase_id and p.business_id is not null and private.has_business_permission(p.business_id,'process_checkout')));
create policy purchase_items_delete_checkout on public.purchase_items for delete to authenticated
using (exists (select 1 from public.purchases p where p.id=purchase_items.purchase_id and p.business_id is not null and private.has_business_permission(p.business_id,'process_checkout')));