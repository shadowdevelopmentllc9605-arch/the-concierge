-- Phase One retailer handoff: post paid online orders exactly once.
-- Retailer-offer quantities are reduced only where a connected store supplies
-- a tracked quantity. Third-party/unknown quantities (NULL) are not guessed.
-- All line debits and the parent sync status run in ONE SQL transaction.
CREATE TABLE IF NOT EXISTS private.online_order_offer_debits (
  order_item_id uuid PRIMARY KEY REFERENCES public.order_items(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  retailer_offer_id uuid NOT NULL REFERENCES public.retailer_offer(id) ON DELETE RESTRICT,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  quantity_ordered integer NOT NULL CHECK (quantity_ordered > 0),
  quantity_decremented integer NOT NULL CHECK (quantity_decremented >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS online_order_offer_debits_order_idx ON private.online_order_offer_debits(order_id);
ALTER TABLE private.online_order_offer_debits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.online_order_offer_debits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON private.online_order_offer_debits TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_paid_online_order_stock_and_sync(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_line public.order_items%ROWTYPE;
  v_offer public.retailer_offer%ROWTYPE;
  v_existing private.online_order_offer_debits%ROWTYPE;
  v_purchase_id uuid;
  v_offer_count integer;
  v_line_count integer := 0;
  v_applied_count integer := 0;
  v_quantity_decremented integer;
BEGIN
  -- Replays are serialized by locking the order itself. Concurrent orders
  -- selling the same offer serialize on the offer row.
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Only paid, non-refunded orders can finalize inventory';
  END IF;
  IF v_order.payment_provider <> 'stripe' OR v_order.checkout_session_id IS NULL THEN
    RAISE EXCEPTION 'Order does not have verified Stripe checkout evidence';
  END IF;

  FOR v_line IN
    SELECT * FROM public.order_items WHERE order_id = p_order_id ORDER BY id
  LOOP
    v_line_count := v_line_count + 1;
    IF v_line.business_id IS NULL OR v_line.quantity < 1 THEN
      RAISE EXCEPTION 'Paid order has an invalid retailer line';
    END IF;

    -- Purchases must already be written by the signed Stripe webhook.
    SELECT p.id INTO v_purchase_id
      FROM public.purchases p
     WHERE p.order_id = p_order_id
       AND p.business_id = v_line.business_id
       AND p.status = 'completed'
     LIMIT 1;
    IF v_purchase_id IS NULL THEN
      RAISE EXCEPTION 'Retailer purchase missing for paid order %', p_order_id;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.purchase_items pi
      WHERE pi.purchase_id = v_purchase_id
        AND pi.external_line_key = p_order_id::text || ':' || v_line.id::text
        AND pi.quantity = v_line.quantity
        AND pi.product_master_id IS NOT DISTINCT FROM v_line.product_master_id
        AND pi.product_variant_id IS NOT DISTINCT FROM v_line.product_variant_id
    ) THEN
      RAISE EXCEPTION 'Retailer purchase line missing for order item %', v_line.id;
    END IF;

    SELECT * INTO v_existing FROM private.online_order_offer_debits
      WHERE order_item_id = v_line.id;
    IF FOUND THEN
      IF v_existing.order_id <> p_order_id
         OR v_existing.business_id <> v_line.business_id
         OR v_existing.quantity_ordered <> v_line.quantity THEN
        RAISE EXCEPTION 'Existing stock debit differs from order';
      END IF;
      CONTINUE; -- already applied: NEVER decrement again
    END IF;

    -- Only the unique verified, store-linked offer for this exact SKU can
    -- be decremented. Reject ambiguous retailer/variant matches.
    v_offer_count := 0;
    FOR v_offer IN
      SELECT ro.* FROM public.retailer_offer ro
      WHERE ro.business_id = v_line.business_id::text
        AND ro.product_master_id = v_line.product_master_id
        AND ro.active = true
        AND (ro.product_variant_id = v_line.product_variant_id
             OR (ro.offer_scope = 'style' AND ro.product_variant_id IS NULL))
      ORDER BY ro.id FOR UPDATE
    LOOP
      v_offer_count := v_offer_count + 1;
    END LOOP;
    IF v_offer_count <> 1 THEN
      RAISE EXCEPTION 'Cannot identify exactly one retailer offer for order item %', v_line.id;
    END IF;

    -- If the store didn't report a numeric quantity, record that no
    -- inventory quantity was adjusted. Never manufacture a stock number.
    v_quantity_decremented := 0;
    IF v_offer.stock_quantity IS NOT NULL THEN
      IF v_offer.stock_quantity < v_line.quantity THEN
        RAISE EXCEPTION 'Insufficient tracked stock to reconcile order item %', v_line.id;
      END IF;
      UPDATE public.retailer_offer
      SET stock_quantity = stock_quantity - v_line.quantity,
          availability = CASE
            WHEN stock_quantity = v_line.quantity THEN 'out_of_stock'
            ELSE availability END,
          updated_at = now()
      WHERE id = v_offer.id AND stock_quantity >= v_line.quantity;
      IF NOT FOUND THEN RAISE EXCEPTION 'Inventory changed during fulfillment'; END IF;
      v_quantity_decremented := v_line.quantity;
    END IF;
    INSERT INTO private.online_order_offer_debits
      (order_item_id, order_id, retailer_offer_id, business_id,
       quantity_ordered, quantity_decremented)
    VALUES (v_line.id, p_order_id, v_offer.id, v_line.business_id,
            v_line.quantity, v_quantity_decremented);
    v_applied_count := v_applied_count + 1;
  END LOOP;

  IF v_line_count = 0 THEN RAISE EXCEPTION 'Paid order has no items'; END IF;
  UPDATE public.orders
  SET pro_sync_status = 'completed', sync_error = NULL, updated_at = now()
  WHERE id = p_order_id AND payment_status = 'paid';
  IF NOT FOUND THEN RAISE EXCEPTION 'Paid order changed during reconciliation'; END IF;
  RETURN jsonb_build_object('success', true, 'order_id', p_order_id,
    'line_count', v_line_count, 'newly_applied', v_applied_count);
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_paid_online_order_stock_and_sync(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_paid_online_order_stock_and_sync(uuid)
  TO service_role;
