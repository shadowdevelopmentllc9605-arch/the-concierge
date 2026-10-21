/** Remove test objects and verify the deletion by independent admin listing.
 *
 * Some Supabase Storage RLS DELETE operations return success with an empty
 * removed-object list while leaving the bytes in place. Never claim cleanup
 * from the mutation response alone.
 */
export async function removeAndVerifyTestObject({ client, admin, bucket, path }) {
  if (typeof path !== 'string' || !path.includes('/')) {
    throw new Error('Unsafe test object path');
  }
  const lastSlash = path.lastIndexOf('/');
  const folder = path.slice(0, lastSlash);
  const file = path.slice(lastSlash + 1);
  if (!folder || !file || folder.includes('..') || file.includes('/')) {
    throw new Error('Unsafe test object path');
  }

  const checkPresent = async () => {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 100, search: file });
    if (error || !Array.isArray(data)) {
      throw new Error('Cannot independently verify Storage cleanup');
    }
    return data.some((item) => item.name === file);
  };

  // The owner delete may truthfully succeed, or silently delete zero objects.
  await client.storage.from(bucket).remove([path]);
  if (await checkPresent()) {
    const { error } = await admin.storage.from(bucket).remove([path]);
    if (error) throw new Error('Privileged cleanup request failed');
  }
  if (await checkPresent()) {
    throw new Error('Synthetic test object still exists after cleanup');
  }
  return true;
}
