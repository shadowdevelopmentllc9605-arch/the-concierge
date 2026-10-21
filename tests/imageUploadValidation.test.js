import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateImageUpload, MAX_PUBLIC_IMAGE_BYTES, MAX_PRIVATE_IMAGE_BYTES } from '../src/lib/imageUploadValidation.js';

const image = (type, size) => ({ type, size, name: 'test-photo' });

test('allow standard JPEG, PNG and WebP images within the public size limit', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    const file = image(type, MAX_PUBLIC_IMAGE_BYTES);
    assert.equal(validateImageUpload(file), file);
  }
});

test('reject scripts, SVG, other content and oversize/empty uploads', () => {
  for (const type of ['image/svg+xml', 'text/html', 'application/javascript', 'application/pdf', '']) {
    assert.throws(() => validateImageUpload(image(type, 1024)), /JPEG, PNG, or WebP/);
  }
  assert.throws(() => validateImageUpload(image('image/jpeg', MAX_PUBLIC_IMAGE_BYTES + 1)), /10 MB/);
  assert.throws(() => validateImageUpload(image('image/jpeg', 0)), /non-empty/);
});

test('private limit is greater but remains an explicit ceiling', () => {
  assert.doesNotThrow(() => validateImageUpload(image('image/jpeg', MAX_PRIVATE_IMAGE_BYTES), MAX_PRIVATE_IMAGE_BYTES));
  assert.throws(() => validateImageUpload(image('image/jpeg', MAX_PRIVATE_IMAGE_BYTES + 1), MAX_PRIVATE_IMAGE_BYTES), /15 MB/);
});

test('both production uploader methods validate their files and private uploads stay disabled by default', () => {
  const source = readFileSync(new URL('../src/api/base44Client.js', import.meta.url), 'utf8');
  const publicUploader = source.slice(source.indexOf('async UploadFile'), source.indexOf('async UploadPrivateFile'));
  const privateUploader = source.slice(source.indexOf('async UploadPrivateFile'), source.indexOf('async CreateFileSignedUrl'));
  assert.match(publicUploader, /validateImageUpload\(file, MAX_PUBLIC_IMAGE_BYTES\)/);
  assert.match(privateUploader, /validateImageUpload\(file, MAX_PRIVATE_IMAGE_BYTES\)/);
  assert.match(privateUploader, /VITE_PRIVATE_UPLOADS_ENABLED !== 'true'/);
});

test('migration enforces size and MIME restrictions on both Storage buckets', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261019031500_limit_storage_image_mime_and_size.sql', import.meta.url), 'utf8');
  assert.match(sql, /concierge-uploads/);
  assert.match(sql, /concierge-sensitive/);
  assert.match(sql, /allowed_mime_types/);
  assert.match(sql, /file_size_limit/);
  for (const type of ['image/jpeg','image/png','image/webp']) assert.ok(sql.includes(type));
  assert.doesNotMatch(sql, /image\/svg\+xml/);
});

test('public bucket listing is owner-only while named image reads remain supported', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20261020202500_limit_public_bucket_listing_to_owner.sql', import.meta.url),
    'utf8'
  );
  assert.match(sql, /DROP POLICY IF EXISTS concierge_uploads_read ON storage\.objects/);
  assert.match(sql, /CREATE POLICY concierge_uploads_list_own/);
  assert.match(sql, /storage\.allow_only_operation\('object\.list'\)/);
  assert.match(sql, /\(storage\.foldername\(name\)\)\[1\] = \(SELECT auth\.uid\(\)\)::text/);
  assert.match(sql, /CREATE POLICY concierge_uploads_read_public_files/);
  assert.match(sql, /storage\.allow_any_operation/);
  assert.match(sql, /'object\.get_authenticated'/);
  assert.doesNotMatch(sql, /USING\s*\(\s*bucket_id\s*=\s*'concierge-uploads'\s*\)/);
});
