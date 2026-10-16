import { base44 } from '@/api/base44Client';
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
