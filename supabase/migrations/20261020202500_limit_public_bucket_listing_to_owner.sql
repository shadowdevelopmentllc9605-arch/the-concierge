-- Restrict Storage API object listing: it should not enumerate everyone's
-- public retailer imagery. Public URLs are still served by the public bucket.
-- This change must be validated in a PREVIEW project before merging to main.
DROP POLICY IF EXISTS concierge_uploads_read ON storage.objects;
DROP POLICY IF EXISTS concierge_uploads_read_public_files ON storage.objects;
DROP POLICY IF EXISTS concierge_uploads_list_own ON storage.objects;

CREATE POLICY concierge_uploads_read_public_files
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'concierge-uploads'
  AND storage.allow_any_operation(ARRAY[
    'object.get_authenticated',
    'object.get_authenticated_info'
  ])
);

CREATE POLICY concierge_uploads_list_own
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'concierge-uploads'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND storage.allow_only_operation('object.list')
);
