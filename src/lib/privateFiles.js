import { base44, supabase } from '@/api/base44Client';
import { isPrivateImageUri } from '@/lib/privateImageUri';

/**
 * Resolve a sensitive body/precision scan through the signed, owner-scoped
 * private bucket only. Legacy HTTP references are intentionally not displayed:
 * they must be migrated to private storage rather than re-exposed.
 */
export async function resolveFileUrl(uri) {
  if (!isPrivateImageUri(uri)) return '';
  const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri });
  return res.signed_url || '';
}

/**
 * Read a private image through the authenticated Storage endpoint rather than
 * treating a successful signed-link request as proof that the image rendered.
 * The returned object URL is local to this browser; callers MUST revoke it.
 * Never send sensitive scans to the public uploads bucket.
 */
export async function downloadPrivateImagePreview(uri) {
  if (!isPrivateImageUri(uri)) throw new Error('Invalid private image reference.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user?.id) throw new Error('Sign in to view your private scan.');
  const prefix = 'concierge-sensitive/' + auth.user.id + '/';
  if (!uri.startsWith(prefix)) throw new Error('This private image belongs to another account.');

  const path = uri.slice('concierge-sensitive/'.length);
  const { data: blob, error } = await supabase.storage.from('concierge-sensitive').download(path);
  if (error) throw new Error('Private image download failed: ' + error.message);
  if (!blob || blob.size < 1) throw new Error('Private image download returned no data.');
  return URL.createObjectURL(blob);
}

/**
 * Restore an already uploaded private image after a mobile camera picker
 * returns without displaying it. List can only return this signed-in owner's
 * folder by Storage RLS. No public URLs, account-wide listing or other users.
 */
export async function findLatestOwnPrivatePhoto() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user?.id) throw new Error('Sign in to load a private image.');
  const { data: entries, error } = await supabase.storage.from('concierge-sensitive')
    .list(auth.user.id, { limit: 30, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) throw new Error('Could not list your private scans: ' + error.message);
  const latest = (entries || []).find(entry => typeof entry.name === 'string'
    && /^[^/]+\.(?:png|jpe?g|webp)$/i.test(entry.name) && entry.id);
  return latest ? 'concierge-sensitive/' + auth.user.id + '/' + latest.name : null;
}
