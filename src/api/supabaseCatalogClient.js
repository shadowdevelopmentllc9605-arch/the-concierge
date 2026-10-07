const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

function buildUrl(table, params = {}) {
  if (!isConfigured) {
    throw new Error('Supabase catalog client is not configured for this environment.');
  }

  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', params.select || '*');

  if (params.limit) url.searchParams.set('limit', String(params.limit));
  if (params.offset) url.searchParams.set('offset', String(params.offset));
  if (params.order) url.searchParams.set('order', params.order);

  for (const [key, value] of Object.entries(params.filters || {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

async function request(table, params = {}) {
  const response = await fetch(buildUrl(table, params), {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase catalog request failed (${response.status}): ${detail}`);
  }

  return response.json();
}

export const supabaseCatalog = {
  isConfigured,

  listProducts(options = {}) {
    return request('product_master', {
      limit: options.limit || 100,
      offset: options.offset || 0,
      order: options.order || 'brand_name.asc,product_name.asc',
      filters: {
        active: 'eq.true',
        dedup_status: 'neq.duplicate',
        ...(options.filters || {}),
      },
    });
  },

  listVariants(productMasterId, options = {}) {
    return request('product_variant', {
      limit: options.limit || 250,
      offset: options.offset || 0,
      order: options.order || 'variant_key.asc',
      filters: {
        product_master_id: `eq.${productMasterId}`,
        active: 'eq.true',
        ...(options.filters || {}),
      },
    });
  },

  listOffers(productMasterId, options = {}) {
    return request('retailer_offer', {
      limit: options.limit || 250,
      offset: options.offset || 0,
      order: options.order || 'retailer_name.asc,current_price.asc.nullslast',
      filters: {
        product_master_id: `eq.${productMasterId}`,
        active: 'eq.true',
        ...(options.filters || {}),
      },
    });
  },

  async healthcheck() {
    const rows = await request('product_master', {
      select: 'id',
      limit: 1,
      filters: { active: 'eq.true' },
    });
    return { ok: true, rows: rows.length };
  },
};
