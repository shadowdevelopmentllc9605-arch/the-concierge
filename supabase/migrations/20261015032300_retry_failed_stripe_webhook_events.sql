CREATE OR REPLACE FUNCTION public.claim_stripe_webhook_event(
  p_event_id text, p_event_type text, p_payload jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'private' AS $function$
DECLARE claimed_id text;
BEGIN
  INSERT INTO private.stripe_webhook_events
    (stripe_event_id, event_type, payload, processing_status)
  VALUES (p_event_id, p_event_type, p_payload, 'received')
  ON CONFLICT (stripe_event_id) DO UPDATE
    SET processing_status = 'received',
        payload = EXCLUDED.payload,
        error_message = NULL,
        processed_at = NULL
  WHERE private.stripe_webhook_events.processing_status = 'failed'
  RETURNING stripe_event_id INTO claimed_id;
  RETURN claimed_id IS NOT NULL;
END;
$function$;
