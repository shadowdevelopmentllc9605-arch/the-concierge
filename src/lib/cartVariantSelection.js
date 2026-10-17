// Resolve a cart line from a verified, current online offer. Catalog display
// pricing is not sufficient for checkout when a style has multiple variants.
const normalized = (value) => String(value ?? '').trim();
const toCents = (value) => Math.round(Number(value) * 100);

export function isSellableOffer(o, now = Date.now()) {
  if (o?.active !== true || !o.business_id || o.available_online !== true) return false;
  if (!['in_stock', 'limited'].includes(o.availability)) return false;
  if (!['shipping', 'shipping_and_pickup'].includes(o.fulfillment)) return false;
  if (!o.stale_after || new Date(o.stale_after).getTime() <= now) return false;
  if (o.offer_scope === 'variant' && !o.product_variant_id) return false;
  if (o.currency && normalized(o.currency).toLowerCase() !== 'usd') return false;
  if (o.stock_quantity != null && Number(o.stock_quantity) < 1) return false;
  const raw = o.sale_active && Number(o.sale_price) > 0 ? o.sale_price
    : (Number(o.current_price) > 0 ? o.current_price : o.regular_price);
  const cents = toCents(raw);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000;
}

export function getAvailableCartOffers(product, selection = {}, now = Date.now()) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const offers = Array.isArray(product?.offers) ? product.offers : [];
  const size = normalized(selection.size);
  const color = normalized(selection.color);
  const width = normalized(selection.width);
  const matches = variants.filter(v =>
    v.active !== false &&
    normalized(v.size_label ?? v.size) === size &&
    normalized(v.color_name ?? v.color) === color &&
    normalized(v.width_code) === width
  );
  // Never silently lose a size/colour selection, or guess between variants.
  if (variants.length && matches.length !== 1) return [];
  if (!variants.length && (size || color || width)) return [];
  const variantId = matches[0]?.id ?? null;
  return offers.filter(o =>
    isSellableOffer(o, now) &&
    (!o.product_variant_id || o.product_variant_id === variantId)
  ).map(o => ({
    offer: o,
    variantId,
    priceCents: toCents(o.sale_active && Number(o.sale_price) > 0 ? o.sale_price
      : (Number(o.current_price) > 0 ? o.current_price : o.regular_price))
  }));
}

export function buildVerifiedCartLine(product, selection = {}, now = Date.now()) {
  if (!product?.id) throw new Error('Product details are unavailable.');
  const offers = getAvailableCartOffers(product, selection, now);
  if (offers.length !== 1) {
    throw new Error('This size or color does not have exactly one verified online retailer offer. Choose another option or try again later.');
  }
  const { offer, variantId, priceCents } = offers[0];
  if (offer.product_master_id !== product.id) throw new Error('The retailer offer does not match this product.');
  return {
    product_master_id: product.id,
    product_variant_id: variantId,
    product_name: product.product_name || product.name || 'Concierge item',
    product_image_url: product.images?.[0] || product.primary_image_url || null,
    unit_price: priceCents / 100,
    size_label: normalized(selection.size) || null,
    color_name: normalized(selection.color) || null,
    width_code: normalized(selection.width) || null,
    quantity: 1
  };
}
