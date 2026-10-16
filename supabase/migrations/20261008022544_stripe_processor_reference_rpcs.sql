
create or replace function public.save_order_payment_ref(p_order_id uuid,p_session_id text,p_payment_intent_id text)
returns void language sql security definer set search_path=public,private as $$
 insert into private.order_payment_refs(order_id,stripe_checkout_session_id,stripe_payment_intent_id)
 values(p_order_id,p_session_id,p_payment_intent_id)
 on conflict(order_id) do update set stripe_checkout_session_id=excluded.stripe_checkout_session_id,stripe_payment_intent_id=excluded.stripe_payment_intent_id,updated_at=now()
$$;
create or replace function public.save_payment_method_processor_ref(p_payment_method_id uuid,p_processor_id text)
returns void language sql security definer set search_path=public,private as $$
 insert into private.payment_method_processor_refs(payment_method_id,processor_payment_method_id)
 values(p_payment_method_id,p_processor_id)
 on conflict(payment_method_id) do update set processor_payment_method_id=excluded.processor_payment_method_id,updated_at=now()
$$;
revoke all on function public.save_order_payment_ref(uuid,text,text) from public,anon,authenticated;
revoke all on function public.save_payment_method_processor_ref(uuid,text) from public,anon,authenticated;
grant execute on function public.save_order_payment_ref(uuid,text,text) to service_role;
grant execute on function public.save_payment_method_processor_ref(uuid,text) to service_role;
