CREATE UNIQUE INDEX IF NOT EXISTS purchase_items_purchase_external_line_uidx
ON public.purchase_items (purchase_id, external_line_key);
