import { supabase } from '@/api/supabaseClient';
import { normalizeShopperPurchase } from '@/lib/shopperPurchases';
import { isSellableOffer } from '@/lib/cartVariantSelection';
import { validateImageUpload, MAX_PUBLIC_IMAGE_BYTES, MAX_PRIVATE_IMAGE_BYTES } from '@/lib/imageUploadValidation';

const directTables = {
  CartItem: 'cart_items',
  ClosetItem: 'closet_items',
  Order: 'orders',
  PaymentMethod: 'payment_methods',
  ShippingAddress: 'shipping_addresses',
  Purchase: 'purchases',
  WishlistItem: 'wishlist_items',
  AppNotification: 'app_notifications',
  Business: 'businesses',
  Vendor: 'businesses',
  Employee: 'employees',
  InventoryItem: 'inventory_items',
  BusinessLocation: 'business_locations',
  StoreAlert: 'store_alerts',
  StoreCustomer: 'store_customers',
  StoreCheckin: 'store_checkins',
  StoreVisit: 'store_visits',
  FittingRoom: 'fitting_rooms',
  CustomerNotification: 'notification_campaigns',
  AIFeedback: 'ai_feedback',
  ShoppingExperience: 'shopping_experiences',
  Friend: 'friends',
  PayrollRecord: 'payroll_records',
  ProductReview: 'product_reviews',
  BrandSizeChart: 'brand_size_charts'
};

const fieldMaps = {
  WishlistItem: { product_id: 'product_master_id', product_image: 'product_image_url', vendor_id: 'legacy_vendor_id' },
  CartItem: { product_id: 'product_master_id', product_image: 'product_image_url', price: 'unit_price', product_price: 'unit_price', size: 'size_label', color: 'color_name' },
  Purchase: { user_id: 'shopper_user_id' },
  StoreCheckin: { user_id: 'shopper_user_id', vendor_id: 'legacy_vendor_id' },
  ProductReview: { product_id: 'product_master_id', vendor_id: 'business_id' },
  Vendor: { business_name: 'name' }
};

const sortMap = { created_date: 'created_at', updated_date: 'updated_at' };

const mapKey = (entity, key) => fieldMaps[entity]?.[key] || sortMap[key] || key;

const toDb = (entity, payload = {}) =>
  Object.fromEntries(Object.entries(payload).map(([key, value]) => [mapKey(entity, key), value]));

const fromDb = (entity, row) => {
  if (!row) return row;
  const out = { ...row, created_date: row.created_at, updated_date: row.updated_at };
  if (entity === 'Vendor' || entity === 'Business') out.business_name = row.name;
  if (entity === 'WishlistItem') {
    out.product_id = row.product_master_id;
    out.product_image = row.product_image_url;
    out.vendor_id = row.legacy_vendor_id;
  }
  if (entity === 'CartItem') {
    out.product_id = row.product_master_id;
    out.product_image = row.product_image_url;
    out.price = row.unit_price;
    out.product_price = Number(row.unit_price ?? 0);
    out.size = row.size_label || '';
    out.color = row.color_name || '';
  }
  if (entity === 'Purchase') return normalizeShopperPurchase(out);
  if (entity === 'StoreCheckin') {
    out.user_id = row.shopper_user_id;
    out.vendor_id = row.legacy_vendor_id;
  }
  if (entity === 'ProductReview') {
    out.product_id = row.product_master_id;
  }
  return out;
};

const applyFilters = (builder, entity, filters = {}) => {
  let query = builder;
  for (const [key, value] of Object.entries(filters || {})) {
    if (value === undefined || value === null || value === '') continue;
    const column = mapKey(entity, key);
    if (Array.isArray(value)) query = query.in(column, value);
    else query = query.eq(column, value);
  }
  return query;
};

const profileFields = new Set([
  'display_name','birthday','gender','profile_picture_url','style_preferences','onboarding_completed',
  'onboarding_step','wishlist_visibility','measurement_unit'
]);
const fitFields = new Set([
  'body_scan_front_path','body_scan_side_path','body_scan_back_path','precision_scan_foot_left_path',
  'precision_scan_foot_right_path','precision_scan_head_front_path','precision_scan_head_side_path',
  'measurement_confidence','measurement_method','measurement_updated_at','measurement_values_cm',
  'legacy_measurements','suggested_sizes','measurement_validation_status','measurement_sources',
  'measurement_confidence_by_field','measurement_scan_diagnostics','measurement_protocol_version',
  'measurement_scan_values_cm','measurement_reference_standard','precision_measurement_metadata'
]);

const normalizeProfileInput = (payload = {}) => {
  const p = { ...payload };
  if ('profile_picture' in p) { p.profile_picture_url = p.profile_picture; delete p.profile_picture; }
  if ('measurements' in p) { p.legacy_measurements = p.measurements; delete p.measurements; }
  if ('body_scan_front' in p) { p.body_scan_front_path = p.body_scan_front; delete p.body_scan_front; }
  if ('body_scan_side' in p) { p.body_scan_side_path = p.body_scan_side; delete p.body_scan_side; }
  if ('body_scan_back' in p) { p.body_scan_back_path = p.body_scan_back; delete p.body_scan_back; }
  return p;
};

const splitProfile = (payload = {}) => {
  const normalized = normalizeProfileInput(payload);
  const profiles = {};
  const fit = {};
  for (const [key, value] of Object.entries(normalized)) {
    if (key === 'id') continue;
    if (key === 'user_id') { profiles.user_id = value; fit.user_id = value; continue; }
    if (profileFields.has(key)) profiles[key] = value;
    if (fitFields.has(key)) fit[key] = value;
  }
  return { profiles, fit };
};

const loadProfiles = async (filters = {}) => {
  let query = supabase.from('profiles').select('*');
  if (filters.user_id) query = query.eq('user_id', filters.user_id);
  const { data: profiles, error } = await query;
  if (error) throw error;
  const ids = (profiles || []).map(p => p.user_id);
  let fits = [];
  if (ids.length) {
    const fitResult = await supabase.from('fit_profiles').select('*').in('user_id', ids);
    if (fitResult.error) throw fitResult.error;
    fits = fitResult.data || [];
  }
  const fitByUser = new Map(fits.map(f => [f.user_id, f]));
  return (profiles || []).map(p => {
    const fit = fitByUser.get(p.user_id) || {};
    return {
      ...p,
      ...fit,
      id: p.user_id,
      profile_picture: p.profile_picture_url,
      measurements: fit.legacy_measurements,
      body_scan_front: fit.body_scan_front_path,
      body_scan_side: fit.body_scan_side_path,
      body_scan_back: fit.body_scan_back_path
    };
  });
};

const saveProfile = async (id, payload, create = false) => {
  const userId = payload.user_id || id;
  if (!userId) throw new Error('User profile requires a user id.');
  const { profiles, fit } = splitProfile({ ...payload, user_id: userId });
  if (Object.keys(profiles).length > 1) {
    const result = await supabase.from('profiles').upsert(profiles, { onConflict: 'user_id' }).select().single();
    if (result.error) throw result.error;
  } else if (create) {
    const result = await supabase.from('profiles').upsert({ user_id: userId }, { onConflict: 'user_id' });
    if (result.error) throw result.error;
  }
  if (Object.keys(fit).length > 1) {
    const result = await supabase.from('fit_profiles').upsert(fit, { onConflict: 'user_id' });
    if (result.error) throw result.error;
  }
  const rows = await loadProfiles({ user_id: userId });
  return rows[0] || null;
};

const loadProducts = async (filters = {}, sort = '-created_date', limit = 100) => {
  let query = supabase.from('product_master').select('*').eq('active', true);
  const mapped = { ...filters };
  if (mapped.brand !== undefined) { mapped.brand_name = mapped.brand; delete mapped.brand; }
  if (mapped.name !== undefined) { mapped.product_name = mapped.name; delete mapped.name; }
  query = applyFilters(query, 'Product', mapped);
  const descending = typeof sort === 'string' && sort.startsWith('-');
  const sortKey = typeof sort === 'string' ? sort.replace(/^-/, '') : 'created_date';
  query = query.order(sortMap[sortKey] || sortKey, { ascending: !descending }).limit(limit || 100);
  const { data: products, error } = await query;
  if (error) throw error;
  const ids = (products || []).map(p => p.id);
  let variants = [], offers = [];
  if (ids.length) {
    const [variantResult, offerResult] = await Promise.all([
      supabase.from('product_variant').select('*').in('product_master_id', ids).eq('active', true),
      supabase.from('retailer_offer').select('*').in('product_master_id', ids).eq('active', true)
    ]);
    if (variantResult.error) throw variantResult.error;
    if (offerResult.error) throw offerResult.error;
    variants = variantResult.data || [];
    offers = offerResult.data || [];
  }
  return (products || []).map(p => {
    const pv = variants.filter(v => v.product_master_id === p.id);
    const po = offers.filter(o => o.product_master_id === p.id);
    const sellable = po.filter(o => isSellableOffer(o));
    const priced = sellable
      .map(o => ({ ...o, effective_price: o.sale_active && Number(o.sale_price) > 0
        ? Number(o.sale_price)
        : (Number(o.current_price) > 0 ? Number(o.current_price) : Number(o.regular_price)) }))
      .sort((a,b) => a.effective_price - b.effective_price);
    const offer = priced[0] || null;
    const retailVariants = pv.map(v => ({
      ...v,
      size: v.size_label || '',
      color: v.color_name || '',
      stock_quantity: sellable.filter(o => o.product_variant_id === v.id || !o.product_variant_id)
        .reduce((highest, o) => Math.max(highest, Number(o.stock_quantity) || 0), 0)
    }));
    return {
      ...p,
      name: p.product_name,
      brand: p.brand_name,
      images: p.image_urls?.length ? p.image_urls : (p.primary_image_url ? [p.primary_image_url] : []),
      image_url: p.primary_image_url,
      price: offer?.effective_price ?? null,
      vendor_id: offer?.business_id || offer?.retailer_key || null,
      variants: retailVariants,
      offers: po,
      sizes: [...new Set(pv.map(v => v.size_label).filter(Boolean))],
      colors: [...new Set(pv.map(v => v.color_name).filter(Boolean))],
      width_options: [...new Set(pv.map(v => v.width_code).filter(Boolean))],
      // Only confirmed availability is treated as in stock; unknown is not a promise.
      in_stock: sellable.length > 0,
      style_type: p.product_type || p.subcategory || '',
      created_date: p.created_at,
      updated_date: p.updated_at
    };
  });
};

const brandCatalogList = async () => {
  const { data, error } = await supabase.from('product_master').select('brand_name,brand_key,category').eq('active', true).not('brand_name','is',null);
  if (error) throw error;
  const byKey = new Map();
  for (const row of data || []) {
    const key = row.brand_key || row.brand_name?.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key) continue;
    const existing = byKey.get(key) || { brand_key: key, brand_name: row.brand_name, aliases: [], retailer_presence: [], source_urls: [], verified_categories: [], verified_chart_count: 0, sizing_status: 'estimate_only', active: true };
    if (row.category && !existing.verified_categories.includes(row.category)) existing.verified_categories.push(row.category);
    byKey.set(key, existing);
  }
  return { items: [...byKey.values()], next_cursor: null };
};

const entityApi = (entity) => ({
  async filter(filters = {}, sort, limit) {
    if (entity === 'UserProfile') return loadProfiles(filters);
    if (entity === 'Product') return loadProducts(filters, sort, limit || 100);
    const table = directTables[entity];
    if (!table) return [];
    let query = applyFilters(supabase.from(table).select(entity === 'Purchase' ? '*,purchase_items(*)' : '*'), entity, filters);
    if (sort) {
      const desc = sort.startsWith('-');
      const key = sort.replace(/^-/, '');
      query = query.order(sortMap[key] || mapKey(entity, key), { ascending: !desc });
    }
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(row => fromDb(entity, row));
  },
  async list(sortOrOptions, limit) {
    if (entity === 'BrandCatalog') return brandCatalogList();
    if (entity === 'UserProfile') return loadProfiles({});
    if (entity === 'Product') {
      if (sortOrOptions && typeof sortOrOptions === 'object') {
        const items = await loadProducts({}, '-created_date', sortOrOptions.limit || 100);
        return { items, next_cursor: null };
      }
      return loadProducts({}, sortOrOptions || '-created_date', limit || 100);
    }
    const table = directTables[entity];
    if (!table) return sortOrOptions && typeof sortOrOptions === 'object' ? { items: [], next_cursor: null } : [];
    let query = supabase.from(table).select(entity === 'Purchase' ? '*,purchase_items(*)' : '*');
    if (typeof sortOrOptions === 'string') {
      const desc = sortOrOptions.startsWith('-');
      const key = sortOrOptions.replace(/^-/, '');
      query = query.order(sortMap[key] || mapKey(entity, key), { ascending: !desc });
    }
    const requestedLimit = typeof sortOrOptions === 'object' ? sortOrOptions.limit : limit;
    if (requestedLimit) query = query.limit(requestedLimit);
    const { data, error } = await query;
    if (error) throw error;
    const items = (data || []).map(row => fromDb(entity, row));
    return typeof sortOrOptions === 'object' ? { items, next_cursor: null } : items;
  },
  async create(payload) {
    if (entity === 'UserProfile') return saveProfile(null, payload, true);
    if (entity === 'BrandCatalog') throw new Error(entity + ' is derived and read-only.');
    const table = directTables[entity];
    if (!table) throw new Error('Unsupported entity: ' + entity);
    const { data, error } = await supabase.from(table).insert(toDb(entity, payload)).select().single();
    if (error) throw error;
    return fromDb(entity, data);
  },
  async update(id, payload) {
    if (entity === 'UserProfile') return saveProfile(id, payload, false);
    const table = directTables[entity];
    if (!table) throw new Error('Unsupported entity: ' + entity);
    const idColumn = entity === 'UserProfile' ? 'user_id' : 'id';
    const { data, error } = await supabase.from(table).update(toDb(entity, payload)).eq(idColumn, id).select().single();
    if (error) throw error;
    return fromDb(entity, data);
  },
  async delete(id) {
    const table = directTables[entity];
    if (!table) throw new Error('Unsupported entity: ' + entity);
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },
  subscribe(callback) {
    const table = directTables[entity];
    if (!table) return () => {};
    const channel = supabase.channel('legacy-' + table + '-' + crypto.randomUUID())
      .on('postgres_changes', { event: '*', schema: 'public', table }, payload => callback(payload))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }
});

const entities = new Proxy({}, {
  get: (_, entity) => entityApi(String(entity))
});

const invokeFunction = async (name, payload = {}) => {
  if (name === 'retryIntegrationSyncs') {
    return { data: { success: true, skipped: true, message: 'Legacy Base44 integration syncs are retired.' } };
  }
  const { data, error } = await supabase.functions.invoke('concierge-actions', {
    body: { name, payload }
  });
  if (error) throw error;
  if (data?.success === false) throw new Error(data.error || ('Function ' + name + ' failed.'));
  return { data };
};

export const base44 = {
  auth: {
    async me() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) throw error || new Error('Authentication required');
      const user = data.user;
      return {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email
      };
    },
    async logout() {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    redirectToLogin() {}
  },
  entities,
  functions: { invoke: invokeFunction },
  integrations: {
    Core: {
      // Non-sensitive photos (profile and wardrobe). This bucket is intentionally public.
      async UploadFile({ file }) {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth?.user?.id) throw new Error('Sign in before uploading an image.');
        if (!file) throw new Error('Choose an image to upload.');
        validateImageUpload(file, MAX_PUBLIC_IMAGE_BYTES);
        const safeName = String(file.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = auth.user.id + '/' + crypto.randomUUID() + '-' + safeName;
        const upload = await supabase.storage.from('concierge-uploads').upload(path, file, { upsert: false });
        if (upload.error) throw upload.error;
        const { data } = supabase.storage.from('concierge-uploads').getPublicUrl(path);
        return { file_url: data.publicUrl };
      },
      // Sensitive body and measurement scans must never be served from the public bucket.
      async UploadPrivateFile({ file }) {
        // Do not collect sensitive body scans in production until encrypted,
        // independently recoverable object backups are operational.
        if (import.meta.env.VITE_PRIVATE_UPLOADS_ENABLED !== 'true') {
          throw new Error('Private photo uploads are temporarily unavailable until secure image backups are configured.');
        }
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth?.user?.id) throw new Error('Sign in before uploading an image.');
        if (!file) throw new Error('Choose an image to upload.');
        validateImageUpload(file, MAX_PRIVATE_IMAGE_BYTES);
        const safeName = String(file.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = auth.user.id + '/' + crypto.randomUUID() + '-' + safeName;
        const upload = await supabase.storage.from('concierge-sensitive').upload(path, file, { upsert: false });
        if (upload.error) throw upload.error;
        return { file_uri: 'concierge-sensitive/' + path };
      },
      async CreateFileSignedUrl({ file_uri }) {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth?.user?.id) throw new Error('Sign in to view this image.');
        const prefix = 'concierge-sensitive/' + auth.user.id + '/';
        if (typeof file_uri !== 'string' || !file_uri.startsWith(prefix)) {
          throw new Error('This image is not accessible to your account.');
        }
        const path = file_uri.slice('concierge-sensitive/'.length);
        const { data, error } = await supabase.storage.from('concierge-sensitive').createSignedUrl(path, 3600);
        if (error) throw error;
        return { signed_url: data.signedUrl };
      }
    }
  }
};

export { supabase };
