// Adapt paid purchase headers and their line items for shopper history.
// This maps existing records only; it never creates or mutates payments.
export function normalizeShopperPurchase(row = {}) {
  const items = Array.isArray(row.purchase_items)
    ? row.purchase_items.map(line => ({
        ...line,
        name: line.product_name || 'Item',
        size: line.size_label || '',
        color: line.color_name || '',
        price: Number(line.unit_price ?? 0),
        quantity: Number(line.quantity ?? 0),
      }))
    : [];
  const result = {
    ...row,
    user_id: row.shopper_user_id,
    items,
  };
  delete result.purchase_items;
  return result;
}
