
-- This optional Supabase event-trigger helper is provisioned on the existing production
-- database, but is absent in a freshly provisioned preview database.
-- RLS is explicitly enabled on application tables by the individual migrations.
DO $
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM public, anon, authenticated;
  END IF;
END
$;
revoke all on public.catalog_source, public.catalog_ingestion_run, public.product_source_record from anon, authenticated;
