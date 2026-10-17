-- Permit authenticated retailers to save editable business settings.
-- The public.businesses RLS policy businesses_update_manager continues to
-- require that auth.uid() owns the business or holds manage_business access.
-- Use column-level privileges only: the browser must never control owner,
-- Stripe Connect / subscription, fee, or other privileged billing fields.
GRANT UPDATE (
  name,
  logo_url,
  floor_plan_url,
  address,
  phone,
  email,
  tax_rate,
  setup_complete,
  open_procedures,
  close_procedures,
  linked_customer_app_legacy_id
) ON TABLE public.businesses TO authenticated;
