/** Normalize legacy cart prices and migrated Supabase unit_price values. */
export function getCartUnitPrice(item) {
  const amount = Number(item?.product_price ?? item?.price ?? item?.unit_price ?? 0);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

export function getCartSubtotal(items = []) {
  return items.reduce((total, item) => {
    const quantity = Number(item?.quantity ?? 1);
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
    return total + getCartUnitPrice(item) * safeQuantity;
  }, 0);
}
