export const SOURCE_TYPE_PRIORITY = Object.freeze({
  official_api: 1,
  affiliate_feed: 2,
  merchant_feed: 2,
  csv_xml: 2,
  json_ld: 3,
  sitemap: 4,
  category_page: 5,
  html: 6,
  manual: 7,
  other: 8,
});

export function normalizeCatalogToken(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeIdentifier(value = '') {
  return String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function getSourcePriority(sourceType) {
  return SOURCE_TYPE_PRIORITY[sourceType] ?? SOURCE_TYPE_PRIORITY.other;
}

export function buildCanonicalProductKey(product = {}) {
  const brandKey = normalizeCatalogToken(product.brand_key || product.brandKey || product.brand_name || product.brand || 'unknown-brand');
  const strongestStyleId =
    normalizeIdentifier(product.style_number || product.styleNumber) ||
    normalizeIdentifier(product.mpn) ||
    normalizeIdentifier(product.primary_gtin || product.gtin) ||
    normalizeCatalogToken(product.product_name || product.name || 'unknown-style');

  return `${brandKey}:${strongestStyleId || 'unknown-style'}`;
}

export function buildVariantKey(variant = {}) {
  const master = String(variant.product_master_id || variant.productMasterId || 'unknown-master');
  const globalId =
    normalizeIdentifier(variant.gtin) ||
    normalizeIdentifier(variant.upc) ||
    normalizeIdentifier(variant.ean) ||
    normalizeIdentifier(variant.mpn);

  if (globalId) return `${master}:id:${globalId}`;

  const attributes = [
    normalizeCatalogToken(variant.size_label || variant.size || ''),
    normalizeCatalogToken(variant.color_name || variant.color || ''),
    normalizeCatalogToken(variant.width_code || variant.width || ''),
    normalizeCatalogToken(variant.length_code || variant.length || variant.inseam_label || ''),
  ].filter(Boolean);

  if (attributes.length) return `${master}:attr:${attributes.join(':')}`;

  const sku = normalizeIdentifier(variant.sku);
  return `${master}:sku:${sku || 'unspecified'}`;
}

export function buildOfferKey(offer = {}) {
  const retailer = normalizeCatalogToken(
    offer.retailer_key || offer.retailerKey || offer.business_id || offer.retailer_name || 'unknown-retailer',
  );
  const location = normalizeCatalogToken(offer.location_id || offer.locationId || 'all');
  const sellerId = normalizeIdentifier(
    offer.seller_product_id || offer.sellerProductId || offer.retailer_sku || offer.retailerSku || '',
  );
  const variant = String(offer.product_variant_id || offer.productVariantId || 'style');

  return `${retailer}:${location}:${sellerId || variant}:${variant}`;
}

export function getFreshnessStatus({ checkedAt, staleAfter, now = Date.now() } = {}) {
  const checked = checkedAt ? new Date(checkedAt).getTime() : NaN;
  const stale = staleAfter ? new Date(staleAfter).getTime() : NaN;
  if (!Number.isFinite(stale)) return 'unknown';
  if (now >= stale) return 'stale';
  if (!Number.isFinite(checked) || stale <= checked) return 'fresh';
  const elapsed = now - checked;
  const window = stale - checked;
  return elapsed / window >= 0.75 ? 'aging' : 'fresh';
}

export function compareSourceTrust(a = {}, b = {}) {
  const priorityDelta = getSourcePriority(a.source_type) - getSourcePriority(b.source_type);
  if (priorityDelta !== 0) return priorityDelta;

  const confidenceDelta = Number(b.confidence ?? 0) - Number(a.confidence ?? 0);
  if (confidenceDelta !== 0) return confidenceDelta;

  const aTime = new Date(a.verified_at || a.observed_at || 0).getTime();
  const bTime = new Date(b.verified_at || b.observed_at || 0).getTime();
  return bTime - aTime;
}

export function identifierMatchScore(a = {}, b = {}) {
  const aBrand = normalizeCatalogToken(a.brand_key || a.brand_name || a.brand);
  const bBrand = normalizeCatalogToken(b.brand_key || b.brand_name || b.brand);
  if (aBrand && bBrand && aBrand !== bBrand) return 0;

  const pairs = [
    ['gtin', 1],
    ['primary_gtin', 1],
    ['mpn', 0.98],
    ['style_number', 0.96],
  ];

  for (const [field, score] of pairs) {
    const left = normalizeIdentifier(a[field]);
    const right = normalizeIdentifier(b[field]);
    if (left && right && left === right) return score;
  }

  const aKey = a.canonical_key || buildCanonicalProductKey(a);
  const bKey = b.canonical_key || buildCanonicalProductKey(b);
  if (aKey && bKey && aKey === bKey) return 0.95;

  const aName = normalizeCatalogToken(a.product_name || a.name);
  const bName = normalizeCatalogToken(b.product_name || b.name);
  if (aBrand && aBrand === bBrand && aName && aName === bName) return 0.75;

  return 0;
}

export function shouldAutoMergeProducts(a, b) {
  return identifierMatchScore(a, b) >= 0.95;
}
