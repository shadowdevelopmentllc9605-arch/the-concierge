import { base44 } from '@/api/base44Client';

/**
 * Resolves a stored file reference to a fetchable/renderable URL.
 * Private file URIs get a short-lived signed URL; legacy public
 * http(s) URLs are returned unchanged.
 */
export async function resolveFileUrl(uri) {
  if (!uri) return '';
  if (/^https?:\/\//i.test(uri)) return uri;
  const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri });
  return res.signed_url || '';
}