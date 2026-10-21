-- Limit uploads at the Storage service boundary, not only within browser UI.
-- Public bucket is only for non-sensitive user/store imagery.
-- Private bucket remains private and is disabled in production browser clients
-- until independent encrypted blob backups and a restore drill are verified.
UPDATE storage.buckets
SET file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'concierge-uploads';

UPDATE storage.buckets
SET file_size_limit = 15 * 1024 * 1024,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'concierge-sensitive';
