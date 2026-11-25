-- Pause new sensitive images until recovery and consent are commissioned.
-- Existing owner SELECT and DELETE remain unchanged; public bucket is unaffected.
create policy concierge_sensitive_pilot_insert_pause on storage.objects
as restrictive for insert to authenticated
with check (bucket_id <> 'concierge-sensitive');
create policy concierge_sensitive_pilot_update_pause on storage.objects
as restrictive for update to authenticated
using (bucket_id <> 'concierge-sensitive')
with check (bucket_id <> 'concierge-sensitive');
