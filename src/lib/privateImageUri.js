/** Body and precision scans must resolve only from the owner-scoped private bucket.
 * Reject legacy public URLs rather than displaying sensitive photos anonymously.
 */
const PRIVATE_IMAGE_URI = /^concierge-sensitive\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/?#]+$/i;

export function isPrivateImageUri(uri) {
  return typeof uri === 'string' && PRIVATE_IMAGE_URI.test(uri);
}
