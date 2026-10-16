
insert into storage.buckets (id, name, public)
values ('concierge-uploads','concierge-uploads',true)
on conflict (id) do update set public=true;

drop policy if exists "concierge_uploads_read" on storage.objects;
create policy "concierge_uploads_read"
on storage.objects for select
to public
using (bucket_id='concierge-uploads');

drop policy if exists "concierge_uploads_insert" on storage.objects;
create policy "concierge_uploads_insert"
on storage.objects for insert
to authenticated
with check (bucket_id='concierge-uploads');

drop policy if exists "concierge_uploads_update" on storage.objects;
create policy "concierge_uploads_update"
on storage.objects for update
to authenticated
using (bucket_id='concierge-uploads')
with check (bucket_id='concierge-uploads');

drop policy if exists "concierge_uploads_delete" on storage.objects;
create policy "concierge_uploads_delete"
on storage.objects for delete
to authenticated
using (bucket_id='concierge-uploads');
