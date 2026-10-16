-- Restrict modifications in the existing public image bucket to the authenticated owner.
-- The bucket remains public only for non-sensitive images, preserving existing public-image behavior.
DROP POLICY IF EXISTS concierge_uploads_insert ON storage.objects;
DROP POLICY IF EXISTS concierge_uploads_update ON storage.objects;
DROP POLICY IF EXISTS concierge_uploads_delete ON storage.objects;
CREATE POLICY concierge_uploads_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'concierge-uploads' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY concierge_uploads_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'concierge-uploads' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'concierge-uploads' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY concierge_uploads_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'concierge-uploads' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
-- Use a separate private bucket for body scans and other sensitive measurements.
INSERT INTO storage.buckets (id, name, public)
VALUES ('concierge-sensitive', 'concierge-sensitive', false)
ON CONFLICT (id) DO UPDATE SET public = false;
CREATE POLICY concierge_sensitive_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'concierge-sensitive' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY concierge_sensitive_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'concierge-sensitive' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY concierge_sensitive_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'concierge-sensitive' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'concierge-sensitive' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY concierge_sensitive_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'concierge-sensitive' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);