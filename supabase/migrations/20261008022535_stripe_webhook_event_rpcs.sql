
create or replace function public.claim_stripe_webhook_event(p_event_id text,p_event_type text,p_payload jsonb)
returns boolean language plpgsql security definer set search_path=public,private as $$
begin
 insert into private.stripe_webhook_events(stripe_event_id,event_type,payload,processing_status)
 values(p_event_id,p_event_type,p_payload,'received')
 on conflict (stripe_event_id) do nothing;
 return found;
end $$;
create or replace function public.finish_stripe_webhook_event(p_event_id text,p_status text,p_error text default null)
returns void language sql security definer set search_path=public,private as $$
 update private.stripe_webhook_events set processing_status=p_status,error_message=p_error,processed_at=now() where stripe_event_id=p_event_id
$$;
revoke all on function public.claim_stripe_webhook_event(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.finish_stripe_webhook_event(text,text,text) from public,anon,authenticated;
grant execute on function public.claim_stripe_webhook_event(text,text,jsonb) to service_role;
grant execute on function public.finish_stripe_webhook_event(text,text,text) to service_role;
