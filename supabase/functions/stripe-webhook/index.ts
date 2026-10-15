import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@23.0.0";
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const key=Deno.env.get("STRIPE_SECRET_KEY"); if(!key)return json({error:"Stripe is not configured"},503);
 const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 const raw=await req.text(), sig=req.headers.get("stripe-signature");if(!sig)return json({error:"Missing Stripe signature"},400);
 const stripe=new Stripe(key);
 const secrets:string[]=[];
 for(const n of ["stripe_webhook_secret","stripe_connect_webhook_secret"]){const r=await admin.rpc("get_runtime_secret",{secret_name:n});if(!r.error&&r.data)secrets.push(String(r.data))}
 let event:any=null;for(const s of secrets){try{event=await stripe.webhooks.constructEventAsync(raw,sig,s);break}catch{}}
 if(!event)return json({error:"Invalid Stripe signature"},400);
 const claim=await admin.rpc("claim_stripe_webhook_event",{p_event_id:event.id,p_event_type:event.type,p_payload:event});if(claim.error)throw claim.error;if(!claim.data)return json({received:true,duplicate:true});
 const finish=async(status:string,error:string|null=null)=>{await admin.rpc("finish_stripe_webhook_event",{p_event_id:event.id,p_status:status,p_error:error})};
 const applySubscription=async(s:any)=>{
   const businessId=s.metadata?.concierge_pro_business_id;let q=admin.from("businesses").select("*");
   q=businessId?q.eq("id",businessId):q.eq("stripe_customer_id",typeof s.customer==="string"?s.customer:s.customer?.id||"");
   const b=await q.limit(1).maybeSingle();if(b.error||!b.data)return;
   const qty=Math.max(1,Number(s.metadata?.concierge_pro_location_quantity||s.items?.data?.[0]?.quantity||1));
   const pe=Number(s.current_period_end||s.items?.data?.[0]?.current_period_end||0),plan=s.metadata?.concierge_pro_plan||b.data.billing_plan||"standard";
   const update:any={stripe_subscription_id:s.id,stripe_subscription_status:s.status,billing_plan:plan,billing_price_id:s.items?.data?.[0]?.price?.id||"",billing_location_quantity:qty,stripe_subscription_cancel_at_period_end:!!s.cancel_at_period_end,platform_fee_percent:4};
   if(pe)update.stripe_subscription_current_period_end=new Date(pe*1000).toISOString();
   if(plan==="founding"){const start=Number(s.start_date||Math.floor(Date.now()/1000));const d=new Date(start*1000);d.setUTCMonth(d.getUTCMonth()+12);update.founding_started_at=new Date(start*1000).toISOString();update.founding_expires_at=d.toISOString()}
   const u=await admin.from("businesses").update(update).eq("id",b.data.id);if(u.error)throw u.error;
 };
 const finalizeOrder=async(session:any)=>{
   const orderId=session.metadata?.concierge_order_id||session.metadata?.order_id;if(!orderId)return;
   const full:any=await stripe.checkout.sessions.retrieve(session.id,{expand:["payment_intent","payment_intent.payment_method"]});if(full.payment_status!=="paid")return;
   const o=await admin.from("orders").select("*").eq("id",orderId).maybeSingle();if(o.error||!o.data)return;if(o.data.payment_status==="refunded")return;
   const pi:any=full.payment_intent,piId=typeof pi==="string"?pi:pi?.id||"";
   const ship=full.collected_information?.shipping_details||full.shipping_details;const address=ship?{name:ship.name||"",line1:ship.address?.line1||"",line2:ship.address?.line2||"",city:ship.address?.city||"",state:ship.address?.state||"",postal_code:ship.address?.postal_code||"",country:ship.address?.country||"",phone:ship.phone||full.customer_details?.phone||""}:o.data.shipping_address;
   // Do not mark an order paid until purchase records, payment references and cart cleanup succeed.
   const ref=await admin.rpc("save_order_payment_ref",{p_order_id:orderId,p_session_id:session.id,p_payment_intent_id:piId});if(ref.error)throw ref.error;
   const items=await admin.from("order_items").select("*").eq("order_id",orderId);if(items.error)throw items.error;
   const groups=new Map<string,any[]>();for(const i of items.data||[]){if(!i.business_id)continue;groups.set(i.business_id,[...(groups.get(i.business_id)||[]),i])}
   for(const [businessId,rows] of groups){
     const ext=`online:${orderId}:${businessId}`;let p=await admin.from("purchases").select("id").eq("external_purchase_id",ext).maybeSingle();if(p.error)throw p.error;
     if(!p.data){const subtotal=rows.reduce((s:number,i:any)=>s+Number(i.unit_price||0)*Number(i.quantity||1),0);const ins=await admin.from("purchases").insert({shopper_user_id:o.data.user_id,business_id:businessId,order_id:orderId,purchase_type:"online",subtotal,tax_amount:0,discount_amount:0,shipping_amount:groups.size===1?Number(o.data.shipping_amount||0):0,total:subtotal+(groups.size===1?Number(o.data.shipping_amount||0):0),payment_method:"stripe",status:"completed",external_purchase_id:ext,synced_to_customer:true,payment_provider:"stripe",concierge_attributed:true,attribution_source:"concierge_online",platform_fee_percent:o.data.platform_fee_percent,platform_fee_amount:o.data.platform_fee_amount,platform_fee_status:"collected"}).select().single();if(ins.error)throw ins.error;p={data:{id:ins.data.id},error:null} as any;
     } // Purchase header exists; a retry can repair missing purchase line items.
     const pis=rows.map((i:any)=>({purchase_id:p.data.id,inventory_item_id:i.inventory_item_id,product_master_id:i.product_master_id,product_variant_id:i.product_variant_id,product_name:i.product_name,quantity:i.quantity,unit_price:i.unit_price,size_label:i.size_label,color_name:i.color_name,width_code:i.width_code,external_line_key:`${orderId}:${i.id}`}));
     const pir=await admin.from("purchase_items").upsert(pis,{onConflict:"purchase_id,external_line_key",ignoreDuplicates:true});if(pir.error)throw pir.error;
   }
   const pm:any=typeof pi==="object"?pi.payment_method:null;
   if(o.data.save_card&&pm&&typeof pm==="object"&&pm.card){const existing=await admin.from("payment_methods").select("id").eq("user_id",o.data.user_id).eq("card_last_four",pm.card.last4).eq("expiry_month",pm.card.exp_month).eq("expiry_year",pm.card.exp_year).limit(1);if(existing.error)throw existing.error;if(!existing.data?.length){const m=await admin.from("payment_methods").insert({user_id:o.data.user_id,card_last_four:pm.card.last4,card_type:pm.card.brand,expiry_month:pm.card.exp_month,expiry_year:pm.card.exp_year,is_default:false,processor:"stripe"}).select().single();if(m.error)throw m.error;await admin.rpc("save_payment_method_processor_ref",{p_payment_method_id:m.data.id,p_processor_id:pm.id})}}
   const clear=await admin.from("cart_items").delete().eq("user_id",o.data.user_id);if(clear.error)throw clear.error;
   const up=await admin.from("orders").update({payment_status:"paid",fulfillment_status:"processing",platform_fee_status:"collected",shipping_address:address,subtotal:Number(full.amount_subtotal||0)/100,total:Number(full.amount_total||0)/100}).eq("id",orderId);if(up.error)throw up.error;
 };
 try{
   if(event.type==="checkout.session.completed"){const s:any=event.data.object;if(s.mode==="subscription"&&s.subscription){const sub=await stripe.subscriptions.retrieve(typeof s.subscription==="string"?s.subscription:s.subscription.id);await applySubscription(sub)}else if(s.payment_status==="paid")await finalizeOrder(s)}
   else if(["customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"].includes(event.type))await applySubscription(event.data.object);
   else if(event.type==="invoice.paid"){const inv:any=event.data.object;const sid=typeof inv.subscription==="string"?inv.subscription:inv.subscription?.id;if(sid){const sub=await stripe.subscriptions.retrieve(sid);await applySubscription(sub)}}
   else if(event.type==="account.updated"){const a:any=event.data.object;const b=await admin.from("businesses").select("id").eq("stripe_connected_account_id",a.id).maybeSingle();if(!b.error&&b.data){const u=await admin.from("businesses").update({stripe_onboarding_complete:!!a.details_submitted,stripe_charges_enabled:!!a.charges_enabled,stripe_payouts_enabled:!!a.payouts_enabled,stripe_transfers_enabled:a.capabilities?.transfers==="active"||!!a.payouts_enabled}).eq("id",b.data.id);if(u.error)throw u.error}}
   else if(event.type==="checkout.session.async_payment_succeeded")await finalizeOrder(event.data.object);
   else if(event.type==="checkout.session.async_payment_failed"||event.type==="checkout.session.expired"){const s:any=event.data.object,oid=s.metadata?.concierge_order_id||s.metadata?.order_id;if(oid)await admin.from("orders").update({payment_status:event.type.endsWith("expired")?"expired":"failed"}).eq("id",oid)}
   else {await finish("ignored");return json({received:true,ignored:true})}
   await finish("processed");return json({received:true});
 }catch(e){await finish("failed",e instanceof Error?e.message:"Webhook processing failed");return json({error:"Webhook processing failed"},500)}
});