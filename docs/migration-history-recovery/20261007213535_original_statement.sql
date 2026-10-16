
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on public.catalog_source, public.catalog_ingestion_run, public.product_source_record from anon, authenticated;
