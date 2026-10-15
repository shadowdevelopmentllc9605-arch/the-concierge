import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@23.0.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const LIVE_STANDARD="price_1UN1i45ty13mCGMMULwHuQhz", LIVE_FOUNDING="price_1UN1i65ty13mCGMMBjRkViha";
const TEST_STANDARD="price_1UMzzk5kebGL5ByX1hXf55vL", TEST_FOUNDING="price_1UMzzl5kebGL5ByXLQyUeJPv";
const safeOrigin=(req:Request)=>{try{
 const u=new URL(req.headers.get("origin")||"");
 const configured=(Deno.env.get("CONCIERGE_ALLOWED_ORIGINS")||"").split(",").map(s=>s.trim()).filter(Boolean);
 const production=["https://the-concierge-lake.vercel.app","https://the-concierge-shadow-development-llc.vercel.app","https://concierge-pro-nine.vercel.app","https://concierge-pro-shadow-development-llc.vercel.app"];
 const allowed=[...production,...configured];
 return u.protocol==="https:"&&allowed.includes(u.origin)?u.origin:null;
}catch{return null}};
const stripePrices=(key:string)=>({standard:Deno.env.get("CONCIERGE_PRO_STANDARD_PRICE_ID")||(key.startsWith("sk_test_")?TEST_STANDARD:LIVE_STANDARD),founding:Deno.env.get("CONCIERGE_PRO_FOUNDING_PRICE_ID")||(key.startsWith("sk_test_")?TEST_FOUNDING:LIVE_FOUNDING)});

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return reply({success:false,error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const auth=req.headers.get("Authorization")||"";
 const client=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const admin=createClient(url,service,{auth:{persistSession:false}});
 const {data:{user},error:userError}=await client.auth.getUser();
 if(userError||!user) return reply({success:false,error:"Authentication required"},401);
 const body=await req.json().catch(()=>({})), name=String(body?.name||""), payload=body?.payload||{};
 const ownedBusiness=async()=>{const r=await admin.from("businesses").select("*").eq("owner_user_id",user.id).limit(1);if(r.error)throw r.error;return r.data?.[0]||null};
 try{
  if(name==="retryIntegrationSyncs") return reply({success:true,skipped:true,message:"Legacy integration syncs are retired."});
  if(name==="claimVendorMembership"){const b=await ownedBusiness();if(b)return reply({success:true,businessId:b.id,role:"manager"});const e=await admin.from("employees").select("business_id,role,permissions,status").eq("user_id",user.id).neq("status","inactive").limit(1);if(e.error)throw e.error;return reply({success:true,businessId:e.data?.[0]?.business_id||null,role:e.data?.[0]?.role||null,permissions:e.data?.[0]?.permissions||{}})}

  if(name==="manageFriend"){
   const action=String(payload.action||"");
   if(action==="send"){
    const email=String(payload.email||"").trim().toLowerCase();
    if(!email||email===String(user.email||"").toLowerCase()) return reply({success:false,error:"Enter another Concierge user's email."},400);
    const users=await admin.auth.admin.listUsers({page:1,perPage:1000}); if(users.error)throw users.error;
    const target=users.data.users.find((u:any)=>String(u.email||"").toLowerCase()===email);
    if(target){
     const ex=await admin.from("friends").select("id").or(`and(user_id.eq.${user.id},friend_user_id.eq.${target.id}),and(user_id.eq.${target.id},friend_user_id.eq.${user.id})`).limit(1); if(ex.error)throw ex.error;
     if(!ex.data?.length){const p=await admin.from("profiles").select("display_name,profile_picture_url").eq("user_id",user.id).maybeSingle();if(p.error)throw p.error;const ins=await admin.from("friends").insert({user_id:user.id,friend_user_id:target.id,friend_name:"",friend_picture:"",requester_name:p.data?.display_name||user.email||"",requester_picture:p.data?.profile_picture_url||"",status:"pending"});if(ins.error)throw ins.error}
    }
    return reply({success:true});
   }
   if(action==="accept"){const rec=await admin.from("friends").select("*").eq("id",payload.friendId).eq("friend_user_id",user.id).maybeSingle();if(rec.error||!rec.data)return reply({success:false,error:"Friend request not found."},404);const p=await admin.from("profiles").select("display_name,profile_picture_url").eq("user_id",user.id).maybeSingle();if(p.error)throw p.error;const u=await admin.from("friends").update({status:"accepted",friend_name:p.data?.display_name||user.email||"",friend_picture:p.data?.profile_picture_url||""}).eq("id",rec.data.id);if(u.error)throw u.error;return reply({success:true})}
   if(action==="remove"){const rec=await admin.from("friends").select("*").eq("id",payload.friendId).maybeSingle();if(rec.error||!rec.data||![rec.data.user_id,rec.data.friend_user_id].includes(user.id))return reply({success:false,error:"Friend connection not found."},404);const d=await admin.from("friends").delete().eq("id",rec.data.id);if(d.error)throw d.error;return reply({success:true})}
   return reply({success:false,error:"Unsupported friend action"},400);
  }
  if(name==="friendWishlist"){
   const friendId=String(payload.friendUserId||""); if(!friendId)return reply({success:false,error:"friendUserId is required"},400);
   const f=await admin.from("friends").select("id").eq("status","accepted").or(`and(user_id.eq.${user.id},friend_user_id.eq.${friendId}),and(user_id.eq.${friendId},friend_user_id.eq.${user.id})`).limit(1);if(f.error)throw f.error;if(!f.data?.length)return reply({success:false,error:"Accepted friendship required"},403);
   const p=await admin.from("profiles").select("wishlist_visibility").eq("user_id",friendId).maybeSingle();if(p.error)throw p.error;if(p.data?.wishlist_visibility!=="public")return reply({success:true,items:[],private:true});
   const w=await admin.from("wishlist_items").select("*").eq("user_id",friendId).eq("is_public",true);if(w.error)throw w.error;return reply({success:true,items:w.data||[],private:false});
  }

  if(name==="createConnectOnboarding"){
   const business=await ownedBusiness();if(!business)return reply({success:false,error:"Business not found"},404);
   const key=Deno.env.get("STRIPE_SECRET_KEY");if(!key)return reply({success:false,error:"Stripe Connect is not configured",code:"stripe_not_configured"},409);
   const origin=safeOrigin(req);if(!origin)return reply({success:false,error:"Valid app origin required"},400);const stripe=new Stripe(key);let accountId=business.stripe_connected_account_id||"";
   if(!accountId){const account=await stripe.accounts.create({country:"US",email:business.email||user.email||undefined,controller:{stripe_dashboard:{type:"express"},fees:{payer:"application"},losses:{payments:"application"}},capabilities:{transfers:{requested:true}},metadata:{concierge_pro_business_id:business.id,concierge_connect_model:"marketplace_destination_charges"}} as any);accountId=account.id;const u=await admin.from("businesses").update({stripe_connected_account_id:accountId,platform_fee_percent:4}).eq("id",business.id);if(u.error)throw u.error}
   const link=await stripe.accountLinks.create({account:accountId,refresh_url:`${origin}/BusinessSetup?stripe=refresh`,return_url:`${origin}/BusinessSetup?stripe=return`,type:"account_onboarding"});return reply({success:true,url:link.url,accountId,connectModel:"marketplace_destination_charges",platformFeePercent:4});
  }
  if(name==="createVendorBillingCheckout"){
   const business=await ownedBusiness();if(!business)return reply({success:false,error:"Business not found"},404);const key=Deno.env.get("STRIPE_SECRET_KEY");if(!key)return reply({success:false,error:"Stripe Billing is not configured",code:"billing_not_configured"},409);const origin=safeOrigin(req);if(!origin)return reply({success:false,error:"Valid app origin required"},400);
   if(["active","trialing","past_due","unpaid"].includes(String(business.stripe_subscription_status||"")))return reply({success:false,error:"This business already has a Stripe subscription.",code:"subscription_exists",subscriptionStatus:business.stripe_subscription_status},409);
   let plan=payload.plan==="standard"?"standard":"founding";if(plan==="founding"&&business.billing_plan!=="founding"){const c=await admin.from("businesses").select("id",{count:"exact",head:true}).eq("billing_plan","founding");if((c.count||0)>=20)plan="standard"}
   const loc=await admin.from("business_locations").select("id",{count:"exact",head:true}).eq("business_id",business.id).eq("active",true);const qty=Math.max(1,loc.count||0), prices=stripePrices(key), priceId=plan==="founding"?prices.founding:prices.standard, stripe=new Stripe(key);let customer=business.stripe_customer_id||"";
   if(!customer){const c=await stripe.customers.create({email:business.email||user.email||undefined,name:business.name,metadata:{concierge_pro_business_id:business.id}});customer=c.id;const u=await admin.from("businesses").update({stripe_customer_id:customer}).eq("id",business.id);if(u.error)throw u.error}
   const s=await stripe.checkout.sessions.create({mode:"subscription",customer,line_items:[{price:priceId,quantity:qty}],automatic_tax:{enabled:true},customer_update:{address:"auto",name:"auto"},subscription_data:{metadata:{concierge_pro_business_id:business.id,concierge_pro_plan:plan,concierge_pro_location_quantity:String(qty),concierge_platform_fee_percent:"4"}},metadata:{concierge_pro_business_id:business.id,concierge_pro_plan:plan,concierge_pro_location_quantity:String(qty)},success_url:`${origin}/BusinessSetup?billing=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/BusinessSetup?billing=cancel`});return reply({success:true,url:s.url,sessionId:s.id,plan,monthlyPerLocation:plan==="founding"?99:149,locationQuantity:qty,platformFeePercent:4,foundingLimit:20});
  }
  if(name==="refreshStripeBusinessStatus"){
   const business=await ownedBusiness();if(!business)return reply({success:false,error:"Business not found"},404);const key=Deno.env.get("STRIPE_SECRET_KEY");if(!key)return reply({success:false,error:"Stripe is not configured",code:"stripe_not_configured"},409);const stripe=new Stripe(key), update:any={platform_fee_percent:4};
   if(business.stripe_connected_account_id){const a:any=await stripe.accounts.retrieve(business.stripe_connected_account_id);update.stripe_onboarding_complete=!!a.details_submitted;update.stripe_charges_enabled=!!a.charges_enabled;update.stripe_payouts_enabled=!!a.payouts_enabled;update.stripe_transfers_enabled=a.capabilities?.transfers==="active"||!!a.payouts_enabled}else Object.assign(update,{stripe_onboarding_complete:false,stripe_charges_enabled:false,stripe_payouts_enabled:false,stripe_transfers_enabled:false});
   if(business.stripe_customer_id){const ss=await stripe.subscriptions.list({customer:business.stripe_customer_id,status:"all",limit:20});const s:any=ss.data.find((x:any)=>x.metadata?.concierge_pro_business_id===business.id&&!["canceled","incomplete_expired"].includes(x.status))||ss.data.find((x:any)=>!["canceled","incomplete_expired"].includes(x.status))||ss.data[0];if(s){const qty=Math.max(1,Number(s.metadata?.concierge_pro_location_quantity||s.items?.data?.[0]?.quantity||1));Object.assign(update,{stripe_subscription_id:s.id,stripe_subscription_status:s.status,billing_plan:s.metadata?.concierge_pro_plan||business.billing_plan||"standard",billing_price_id:s.items?.data?.[0]?.price?.id||"",billing_location_quantity:qty,stripe_subscription_cancel_at_period_end:!!s.cancel_at_period_end});const pe=Number(s.current_period_end||s.items?.data?.[0]?.current_period_end||0);if(pe)update.stripe_subscription_current_period_end=new Date(pe*1000).toISOString()}else update.stripe_subscription_status=""}
   const u=await admin.from("businesses").update(update).eq("id",business.id).select().single();if(u.error)throw u.error;return reply({success:true,connected:!!u.data.stripe_connected_account_id,subscriptionActive:["active","trialing"].includes(String(u.data.stripe_subscription_status||"")),...update});
  }


  if(name==="saveEmployee"||name==="removeEmployee"){
    const business=await ownedBusiness();if(!business)return reply({success:false,error:"Business owner access required"},403);
    if(name==="removeEmployee"){
      const id=String(payload.employeeId||"");const existing=await admin.from("employees").select("*").eq("id",id).eq("business_id",business.id).maybeSingle();
      if(existing.error)throw existing.error;if(!existing.data)return reply({success:false,error:"Employee not found"},404);
      if(existing.data.user_id===user.id)return reply({success:false,error:"Cannot remove your own account"},400);
      const upd=await admin.from("employees").update({status:"inactive",permissions:{}}).eq("id",id);if(upd.error)throw upd.error;
      await admin.from("business_memberships").update({status:"inactive",permissions:{}}).eq("business_id",business.id).eq("user_id",existing.data.user_id||"00000000-0000-0000-0000-000000000000");
      return reply({success:true});
    }
    const e=payload.employee||{},email=String(e.email||"").trim().toLowerCase(),name=String(e.name||"").trim();
    if(!email||!name)return reply({success:false,error:"Name and email required"},400);
    const role=["manager","sales_associate","cashier"].includes(e.role)?e.role:"sales_associate";
    const record:any={business_id:business.id,name,email,role,status:e.status==="inactive"?"inactive":"active",permissions:e.permissions||{},photo_url:e.photo_url||null,location_id:e.location_id||null};
    let q=admin.from("employees").select("*").eq("business_id",business.id);
    q=e.id?q.eq("id",e.id):q.eq("email",email);
    const prior=await q.limit(1).maybeSingle();if(prior.error)throw prior.error;
    const saved=prior.data?await admin.from("employees").update(record).eq("id",prior.data.id).select().single():await admin.from("employees").insert(record).select().single();if(saved.error)throw saved.error;
    if(saved.data.user_id){const m=await admin.from("business_memberships").upsert({business_id:business.id,user_id:saved.data.user_id,role,permissions:record.permissions,status:record.status},{onConflict:"business_id,user_id"});if(m.error)throw m.error}
    return reply({success:true,employee:saved.data});
  }
  if(name==="sendCampaign"){
    const business=await ownedBusiness();if(!business)return reply({success:false,error:"Business owner access required"},403);
    const campaign=payload.campaign||{};if(!campaign.title||!campaign.message)return reply({success:false,error:"Title and message required"},400);
    const customers=await admin.from("store_customers").select("*").eq("business_id",business.id);if(customers.error)throw customers.error;
    const today=new Date();const selected=(customers.data||[]).filter((x:any)=>campaign.target==="in_store"?x.in_store:campaign.target==="vip"?Number(x.total_spent||0)>=1000:campaign.target==="birthday"?(x.birthday&&new Date(x.birthday).getUTCMonth()===today.getUTCMonth()&&new Date(x.birthday).getUTCDate()===today.getUTCDate()):Array.isArray(campaign.customerIds)&&campaign.customerIds.length?campaign.customerIds.includes(x.id):true);
    const ids=[...new Set(selected.map((x:any)=>x.shopper_user_id).filter(Boolean))];
    const created=await admin.from("notification_campaigns").insert({business_id:business.id,title:campaign.title,message:campaign.message,type:campaign.type||"general",coupon_code:campaign.coupon_code||null,discount_percent:Number(campaign.discount_percent||0),valid_until:campaign.valid_until||null,status:ids.length?"sent":"draft",send_to_all:!campaign.customerIds?.length,sent_at:ids.length?new Date().toISOString():null,delivery_error:ids.length?null:"No linked shoppers"}).select().single();if(created.error)throw created.error;
    if(ids.length){const rows=ids.map((id:string)=>({user_id:id,business_id:business.id,title:campaign.title,message:campaign.message,type:campaign.type||"general",coupon_code:campaign.coupon_code||null,valid_until:campaign.valid_until||null,external_event_key:`campaign:${created.data.id}:${id}`}));const ins=await admin.from("app_notifications").insert(rows);if(ins.error)throw ins.error}
    return reply({success:ids.length>0,notificationId:created.data.id,selectedCustomers:selected.length,delivered:ids.length});
  }
  if(name==="syncVendorCatalog"){
    const business=await ownedBusiness();if(!business)return reply({success:false,error:"Business owner access required"},403);
    const items=await admin.from("inventory_items").select("id").eq("business_id",business.id);if(items.error)throw items.error;
    return reply({success:true,vendorId:business.id,syncedItems:items.data?.length||0,deactivatedItems:0,message:"Both apps use the shared Supabase catalog; no cross-app copy is required."});
  }
  if(name==="recordSale"){
    const owned=await ownedBusiness();
    const emp=await admin.from("employees").select("business_id,role,permissions").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
    if(emp.error)throw emp.error;
    const businessId=owned?.id||emp.data?.business_id;
    if(!businessId)return reply({success:false,error:"Checkout access denied"},403);
    if(payload.paymentMethod&&payload.paymentMethod!=="cash")return reply({success:false,error:"Only cash sales are supported; no payment was charged"},409);
    const result=await admin.rpc("record_cash_sale",{p_actor:user.id,p_business:businessId,p_customer:payload.customerId,p_items:payload.items,p_key:payload.idempotencyKey,p_discount:payload.discountPercent||0,p_location:payload.locationId||null});
    if(result.error)throw result.error;
    return reply(result.data);
  }
  if(name==="analyzeClothingItem"){
    const fileUrl=String(payload.file_url||"");
    const apiKey=Deno.env.get("OPENAI_API_KEY");
    if(!apiKey)return reply({success:false,error:"Image analysis provider has not been configured",code:"vision_provider_not_configured"},503);
    const bucket="concierge-uploads";
    let path="";
    try{const u=new URL(fileUrl);const prefix="/storage/v1/object/public/"+bucket+"/";const privatePrefix="/storage/v1/object/sign/"+bucket+"/";if(u.origin!==new URL(url).origin)throw Error();if(u.pathname.startsWith(prefix))path=decodeURIComponent(u.pathname.slice(prefix.length));else if(u.pathname.startsWith(privatePrefix))path=decodeURIComponent(u.pathname.slice(privatePrefix.length));else throw Error()}catch{return reply({success:false,error:"Only uploaded Concierge images are accepted"},403)}
    if(!path.startsWith(user.id+"/")||path.includes("..")||path.length>400)return reply({success:false,error:"Image ownership verification failed"},403);
    const obj=await admin.storage.from(bucket).download(path);if(obj.error||!obj.data)return reply({success:false,error:"Image not found"},404);
    const blob=obj.data;if(!["image/jpeg","image/png","image/webp"].includes(blob.type)||blob.size>8*1024*1024)return reply({success:false,error:"Unsupported image or file too large"},400);
    const bytes=new Uint8Array(await blob.arrayBuffer());let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const encoded=btoa(binary);
    const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({model:Deno.env.get("CONCIERGE_VISION_MODEL")||"gpt-4.1-mini",temperature:0,max_tokens:300,response_format:{type:"json_object"},messages:[{role:"system",content:"Identify only visible clothing details. Respond as JSON with string fields item_type,color,style_category,description. Do not identify people."},{role:"user",content:[{type:"text",text:"Describe this clothing item."},{type:"image_url",image_url:{url:"data:"+blob.type+";base64,"+encoded}}]}]})});
    if(!response.ok)return reply({success:false,error:"Image analysis temporarily unavailable",code:"vision_request_failed"},502);
    const result=await response.json();let parsed:any={};try{parsed=JSON.parse(result.choices?.[0]?.message?.content||"{}")}catch{return reply({success:false,error:"Invalid image analysis response"},502)}
    return reply({success:true,item_type:String(parsed.item_type||""),color:String(parsed.color||""),style_category:String(parsed.style_category||""),description:String(parsed.description||"")});
  }
  if(name==="deleteMyData"||name==="deleteVendorBusiness")return reply({success:false,error:"Account and business deletion require a verified data-erasure workflow; nothing was deleted.",code:"deletion_workflow_pending"},409);
  if(name==="createStripeCheckout"){
   const key=Deno.env.get("STRIPE_SECRET_KEY");
   if(!key)return reply({success:false,error:"Stripe is not configured"},503);
   const isTestKey=key.startsWith("sk_test_");
   // A production payment must not run before a controlled sandbox test and tax approval.
   if(!isTestKey&&(Deno.env.get("CONCIERGE_LIVE_CHECKOUT_ENABLED")!=="true"||Deno.env.get("CONCIERGE_TAX_CONFIGURED")!=="true"))
     return reply({success:false,error:"Online payment is not yet enabled for this pilot.",code:"checkout_not_approved"},409);
   const origin=safeOrigin(req);
   if(!origin)return reply({success:false,error:"Unapproved checkout origin"},403);
   const cart=await admin.from("cart_items").select("*").eq("user_id",user.id);
   if(cart.error)throw cart.error;
   if(!cart.data?.length)return reply({success:false,error:"Your cart is empty."},400);
   if(cart.data.length>50)return reply({success:false,error:"Cart is too large."},400);
   const productIds=[...new Set(cart.data.map((i:any)=>i.product_master_id).filter(Boolean))];
   if(productIds.length===0||cart.data.some((i:any)=>!i.product_master_id))
     return reply({success:false,error:"All cart items must have a verified catalog product."},409);
   const [offers,products,variants]=await Promise.all([
     admin.from("retailer_offer").select("id,product_master_id,product_variant_id,offer_scope,business_id,currency,current_price,sale_price,regular_price,sale_active,availability,stock_quantity,available_online,fulfillment,stale_after,active").in("product_master_id",productIds).not("business_id","is",null).eq("active",true),
     admin.from("product_master").select("id,product_name,active").in("id",productIds),
     admin.from("product_variant").select("id,product_master_id,active").in("product_master_id",productIds)
   ]);
   if(offers.error)throw offers.error;if(products.error)throw products.error;if(variants.error)throw variants.error;
   const byProduct=new Map((products.data||[]).map((i:any)=>[i.id,i]));
   const byVariant=new Map((variants.data||[]).map((i:any)=>[i.id,i]));
   const priceByItem=new Map();
   const chosenBusinesses=new Set<string>();
   const now=Date.now();
   for(const item of cart.data){
     const qty=Number(item.quantity);
     if(!Number.isInteger(qty)||qty<1||qty>25)
       return reply({success:false,error:"Invalid cart quantity."},400);
     const product:any=byProduct.get(item.product_master_id);
     if(!product?.active)return reply({success:false,error:"A cart item is not available."},409);
     if(item.product_variant_id){
       const variant:any=byVariant.get(item.product_variant_id);
       if(!variant?.active||variant.product_master_id!==item.product_master_id)
         return reply({success:false,error:"A selected size or color is no longer valid."},409);
     }
     const eligible=(offers.data||[]).filter((o:any)=>{
       if(o.product_master_id!==item.product_master_id)return false;
       if(o.product_variant_id&&o.product_variant_id!==item.product_variant_id)return false;
       if(o.offer_scope==="variant"&&!o.product_variant_id)return false;
       return o.currency==="USD"||String(o.currency||"usd").toLowerCase()==="usd";
     }).filter((o:any)=>o.available_online===true&&["shipping","shipping_and_pickup"].includes(o.fulfillment)&&["in_stock","limited"].includes(o.availability)&&o.stale_after&&new Date(o.stale_after).getTime()>now&&(!Number.isInteger(o.stock_quantity)||o.stock_quantity>=qty));
     // An ambiguous retailer or stale offer is never a valid basis for a charge.
     if(eligible.length!==1)return reply({success:false,error:"A cart item's retailer, price, or availability needs verification before checkout."},409);
     const offer=eligible[0];
     const current=offer.sale_active&&Number(offer.sale_price)>0?Number(offer.sale_price):Number(offer.current_price);
     const price=Number.isFinite(current)&&current>0?current:Number(offer.regular_price);
     const cents=Math.round(price*100);
     if(!Number.isSafeInteger(cents)||cents<=0||cents>100000000)
       return reply({success:false,error:"Invalid retailer price."},409);
     if(!Number.isFinite(Number(item.unit_price))||Math.abs(Math.round(Number(item.unit_price)*100)-cents)>0)
       return reply({success:false,error:"An item's price changed. Refresh your cart before paying."},409);
     chosenBusinesses.add(String(offer.business_id));
     priceByItem.set(item.id,{priceCents:cents,quantity:qty,name:product.product_name||"Concierge item"});
   }
   if(chosenBusinesses.size!==1)return reply({success:false,error:"Checkout requires one verified retailer per order."},409);
   const businessId=[...chosenBusinesses][0];
   const b=await admin.from("businesses").select("*").eq("id",businessId).single();
   if(b.error||!b.data)return reply({success:false,error:"Retailer account could not be verified."},409);
   if(!b.data.stripe_connected_account_id||!b.data.stripe_onboarding_complete||!b.data.stripe_charges_enabled||!["active","trialing"].includes(String(b.data.stripe_subscription_status||"")))
     return reply({success:false,error:"This retailer is not yet ready for payments."},409);
   const subtotalCents=cart.data.reduce((sum:number,i:any)=>sum+priceByItem.get(i.id).priceCents*priceByItem.get(i.id).quantity,0);
   if(!Number.isSafeInteger(subtotalCents)||subtotalCents<=0)return reply({success:false,error:"Invalid cart total."},400);
   const shippingCents=subtotalCents>10000?0:999;
   const feePct=Number(b.data.platform_fee_percent);
   if(!Number.isFinite(feePct)||feePct<0||feePct>100)
     return reply({success:false,error:"Retailer commission settings require review."},409);
   const feeCents=Math.round(subtotalCents*feePct/100);
   const subtotal=subtotalCents/100,shipping=shippingCents/100;
   const order=await admin.from("orders").insert({
     user_id:user.id,subtotal,shipping_amount:shipping,tax_amount:0,discount_amount:0,
     total:(subtotalCents+shippingCents)/100,concierge_attributed:true,attribution_source:"concierge_online",
     platform_fee_percent:feePct,platform_fee_amount:feeCents/100,platform_fee_status:"pending",
     currency:"usd",payment_status:"pending",fulfillment_status:"pending_payment",payment_provider:"stripe",
     save_card:!!payload.saveCard,save_shipping_address:!!payload.saveShippingAddress
   }).select().single();
   if(order.error)throw order.error;
   const lines=cart.data.map((i:any)=>({
     order_id:order.data.id,shopper_user_id:user.id,business_id:businessId,
     product_master_id:i.product_master_id,product_variant_id:i.product_variant_id,
     legacy_cart_item_id:i.legacy_base44_id,legacy_product_id:i.legacy_product_id,
     product_name:priceByItem.get(i.id).name,product_image_url:i.product_image_url,
     unit_price:priceByItem.get(i.id).priceCents/100,quantity:priceByItem.get(i.id).quantity,
     size_label:i.size_label,color_name:i.color_name,width_code:i.width_code,vendor_name:b.data.name
   }));
   const li=await admin.from("order_items").insert(lines);if(li.error)throw li.error;
   const stripe=new Stripe(key);
   const session=await stripe.checkout.sessions.create({
     mode:"payment",customer_email:user.email||undefined,
     line_items:cart.data.map((i:any)=>({
       quantity:priceByItem.get(i.id).quantity,
       price_data:{currency:"usd",unit_amount:priceByItem.get(i.id).priceCents,
         product_data:{name:priceByItem.get(i.id).name}}
     })),
     shipping_address_collection:{allowed_countries:["US"]},
     shipping_options:[{shipping_rate_data:{type:"fixed_amount",
       fixed_amount:{amount:shippingCents,currency:"usd"},display_name:"Standard shipping"}}],
     automatic_tax:{enabled:true},
     payment_intent_data:{application_fee_amount:feeCents,
       transfer_data:{destination:b.data.stripe_connected_account_id},
       metadata:{concierge_order_id:order.data.id}},
     metadata:{concierge_order_id:order.data.id,concierge_user_id:user.id,concierge_business_id:businessId},
     success_url:`${origin}/Checkout?session_id={CHECKOUT_SESSION_ID}`,
     cancel_url:`${origin}/Checkout`
   });
   const u=await admin.from("orders").update({checkout_session_id:session.id}).eq("id",order.data.id);if(u.error)throw u.error;
   return reply({success:true,url:session.url,sessionId:session.id,orderId:order.data.id});
  }
  if(name==="removeSavedPaymentMethod"){const d=await admin.from("payment_methods").delete().eq("id",payload.paymentMethodId).eq("user_id",user.id);if(d.error)throw d.error;return reply({success:true})}
  if(name==="assignCustomer"){const e=await admin.from("employees").select("id,business_id").eq("id",payload.employeeId).eq("user_id",user.id).maybeSingle();if(e.error||!e.data)return reply({success:false,error:"Employee access denied"},403);const u=await admin.from("store_customers").update({assigned_employee_id:payload.employeeId}).eq("id",payload.customerId).eq("business_id",e.data.business_id);if(u.error)throw u.error;return reply({success:true})}
  return reply({success:false,error:"Action not migrated: "+name},404);
 }catch(e){return reply({success:false,error:e instanceof Error?e.message:"Server action failed"},500)}
});