// Client-side checks improve error messages; Storage bucket limits are the authoritative guard.
export const ALLOWED_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_PUBLIC_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PRIVATE_IMAGE_BYTES = 15 * 1024 * 1024;

export function validateImageUpload(file, maxBytes = MAX_PUBLIC_IMAGE_BYTES) {
  if (!file || !Number.isFinite(file.size) || file.size <= 0) {
    throw new Error('Choose a non-empty image to upload.');
  }
  if (!ALLOWED_IMAGE_TYPES.includes(String(file.type || '').toLowerCase())) {
    throw new Error('Use a JPEG, PNG, or WebP image. Other file formats are not supported.');
  }
  if (file.size > maxBytes) {
    throw new Error(`Image exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB upload limit.`);
  }
  return file;
}
