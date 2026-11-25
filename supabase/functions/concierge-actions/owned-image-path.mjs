// Resolve only a signed-in user's Concierge image. Never fetch a caller-provided URL.
export function resolveOwnedClothingImage(payload, projectUrl, ownerId) {
  if (typeof ownerId !== 'string' || !ownerId || !payload) return null;
  let bucket, path;
  try {
    if (typeof payload.file_uri === 'string' && payload.file_uri) {
      const prefix = 'concierge-sensitive/';
      if (!payload.file_uri.startsWith(prefix)) return null;
      bucket = 'concierge-sensitive';
      path = payload.file_uri.slice(prefix.length);
    } else {
      const u = new URL(String(payload.file_url || ''));
      if (u.origin !== new URL(projectUrl).origin || u.username || u.password || u.hash) return null;
      const routes = [
        ['concierge-sensitive', '/storage/v1/object/sign/concierge-sensitive/'],
        ['concierge-uploads', '/storage/v1/object/public/concierge-uploads/'],
        ['concierge-uploads', '/storage/v1/object/sign/concierge-uploads/'],
      ];
      const route = routes.find(([, prefix]) => u.pathname.startsWith(prefix));
      if (!route) return null;
      [bucket] = route;
      path = u.pathname.slice(route[1].length).split('/').map(decodeURIComponent).join('/');
      // Encoded path separators must not change the object key.
      if (/%2f|%5c/i.test(u.pathname)) return null;
    }
    const parts = path.split('/');
    if (path.length > 400 || parts.length < 2 || parts[0] !== ownerId ||
        parts.some(part => !/^[A-Za-z0-9._-]+$/.test(part) || part === '.' || part === '..')) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}
