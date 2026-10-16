create or replace function public.record_cash_sale(p_actor uuid,p_business uuid,p_customer uuid,p_items jsonb,p_key text,p_discount numeric default 0,p_location uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_purchase public.purchases%rowtype; v_item jsonb; v_inventory public.inventory_items%rowtype; v_variant public.inventory_variants%rowtype; v_quantity integer; v_price numeric; v_subtotal numeric:=0; v_discount numeric; v_tax numeric; v_total numeric; v_lines jsonb:='[]'::jsonb; v_customer public.store_customers%rowtype; v_tax_rate numeric;
begin
 if p_key is null or length(trim(p_key))<8 or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>100 then raise exception 'Invalid sale request';end if;
 if not exists(select 1 from public.businesses where id=p_business and owner_user_id=p_actor)
 and not exists(select 1 from public.employees where business_id=p_business and user_id=p_actor and status='active' and (role='manager' or coalesce((permissions->>'process_checkout')::boolean,false))) then raise exception 'Checkout access denied';end if;
 select * into v_purchase from public.purchases where external_purchase_id=p_key and business_id=p_business;
 if found then return jsonb_build_object('success',true,'duplicate',true,'purchaseId',v_purchase.id,'total',v_purchase.total);end if;
 select * into v_customer from public.store_customers where id=p_customer and business_id=p_business for update;
 if not found then raise exception 'Customer not found';end if;
 if p_location is not null and not exists(select 1 from public.business_locations where id=p_location and business_id=p_business) then raise exception 'Location mismatch';end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_quantity:=(v_item->>'quantity')::integer;
  if v_quantity is null or v_quantity<1 or v_quantity>10000 then raise exception 'Invalid quantity';end if;
  select * into v_inventory from public.inventory_items where id=(v_item->>'inventoryItemId')::uuid and business_id=p_business and active=true for update;
  if not found then raise exception 'Inventory item unavailable';end if;
  if exists(select 1 from public.inventory_variants where inventory_item_id=v_inventory.id and active=true) then
   select * into v_variant from public.inventory_variants where inventory_item_id=v_inventory.id and active=true and coalesce(size_label,'')=coalesce(v_item->>'size','') and coalesce(color_name,'')=coalesce(v_item->>'color','') and coalesce(width_code,'')=coalesce(v_item->>'width_code','') for update;
   if not found or v_variant.stock_quantity<v_quantity then raise exception 'Variant unavailable or insufficient stock';end if;
   update public.inventory_variants set stock_quantity=stock_quantity-v_quantity where id=v_variant.id;
  else
   if v_inventory.stock_quantity<v_quantity then raise exception 'Insufficient stock';end if;
  end if;
  update public.inventory_items set stock_quantity=stock_quantity-v_quantity where id=v_inventory.id;
  v_price:=v_inventory.price;
  v_subtotal:=v_subtotal+v_price*v_quantity;
  v_lines:=v_lines||jsonb_build_array(jsonb_build_object('inventory_item_id',v_inventory.id,'product_master_id',v_inventory.product_master_id,'product_name',v_inventory.name,'quantity',v_quantity,'unit_price',v_price,'size_label',v_item->>'size','color_name',v_item->>'color','width_code',v_item->>'width_code'));
 end loop;
 v_discount:=round(v_subtotal*least(100,greatest(0,coalesce(p_discount,0)))/100,2);
 select coalesce(l.tax_rate,b.tax_rate,0) into v_tax_rate from public.businesses b left join public.business_locations l on l.id=p_location and l.business_id=b.id where b.id=p_business;
 v_tax:=round((v_subtotal-v_discount)*v_tax_rate/100,2);v_total:=v_subtotal-v_discount+v_tax;
 insert into public.purchases(business_id,customer_id,shopper_user_id,location_id,employee_id,purchase_type,subtotal,discount_amount,tax_amount,shipping_amount,total,payment_method,payment_provider,status,external_purchase_id,concierge_attributed,attribution_source,platform_fee_percent,platform_fee_amount,platform_fee_status)
 values(p_business,p_customer,v_customer.shopper_user_id,p_location,(select id from public.employees where user_id=p_actor and business_id=p_business and status='active' limit 1),'in_store',v_subtotal,v_discount,v_tax,0,v_total,'cash','cash','completed',p_key,false,'none',0,0,'not_applicable') returning * into v_purchase;
 insert into public.purchase_items(purchase_id,inventory_item_id,product_master_id,product_name,quantity,unit_price,size_label,color_name,width_code,external_line_key)
 select v_purchase.id,(x->>'inventory_item_id')::uuid,(x->>'product_master_id')::uuid,x->>'product_name',(x->>'quantity')::integer,(x->>'unit_price')::numeric,x->>'size_label',x->>'color_name',x->>'width_code',p_key||':'||ord::text from jsonb_array_elements(v_lines) with ordinality as t(x,ord);
 update public.store_customers set total_spent=coalesce(total_spent,0)+v_total,last_visit=now(),in_store=false where id=p_customer;
 return jsonb_build_object('success',true,'purchaseId',v_purchase.id,'externalPurchaseId',p_key,'subtotal',v_subtotal,'discount',v_discount,'tax',v_tax,'total',v_total);
end $$;
revoke all on function public.record_cash_sale(uuid,uuid,uuid,jsonb,text,numeric,uuid) from public,anon,authenticated;
grant execute on function public.record_cash_sale(uuid,uuid,uuid,jsonb,text,numeric,uuid) to service_role;