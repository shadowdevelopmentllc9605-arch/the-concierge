-- Phase One Production: storage service limits (does not modify image objects)
UPDATE storage.buckets
SET file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']::text[]
WHERE id = 'concierge-uploads';

UPDATE storage.buckets
SET file_size_limit = 15 * 1024 * 1024,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']::text[]
WHERE id = 'concierge-sensitive';