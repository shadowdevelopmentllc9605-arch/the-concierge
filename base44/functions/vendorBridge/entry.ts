import { createClientFromRequest } from "npm:@base44/sdk";

async function authorize(base44: any, req: Request) {
  const configs = await base44.asServiceRole.entities.IntegrationConfig.filter({ key: "cross_app_sync", enabled: true });
  const expected = configs[0]?.token;
  const provided = req.headers.get("x-concierge-sync-secret");
  return Boolean(expected && provided && expected === provided);
}

async function upsertVendor(base44: any, business: any, locations: any[]) {
  const existing = await base44.asServiceRole.entities.Vendor.filter({ linked_pro_business_id: business.id });
  const data = {
    owner_id: business.owner_user_id || "",
    business_name: business.name,
    business_picture: business.logo_url || "",
    floor_plan_image: locations.find((l: any) => l.is_default)?.floor_plan_url || business.floor_plan_url || "",
    style_categories: business.style_categories || [],
    locations: locations.map((l: any) => ({
      name: l.name,
      address: l.address,
      lat: l.lat,
      lng: l.lng,
    })),
    linked_pro_business_id: business.id,
    setup_completed: Boolean(business.setup_complete),
  };
  if (existing[0]) {
    await base44.asServiceRole.entities.Vendor.update(existing[0].id, data);
    return { ...existing[0], ...data };
  }
  return await base44.asServiceRole.entities.Vendor.create(data);
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await authorize(base44, req))) {
      return Response.json({ error: "Unauthorized integration request" }, { status: 401 });
    }

    const body = await req.json();
    const action = body?.action;

    if (action === "syncCatalog") {
      const vendor = await upsertVendor(base44, body.business, body.locations || []);
      const mappings: any[] = [];

      for (const item of body.items || []) {
        const existing = await base44.asServiceRole.entities.Product.filter({ linked_pro_inventory_id: item.id });
        const productData = {
          name: item.name,
          brand: item.brand || "",
          category: item.category || "tshirts",
          style_type: item.style_type || "casual",
          price: Number(item.price || 0),
          description: item.description || "",
          images: item.images || [],
          tryOn_image: item.tryOn_image || "",
          sizes: item.sizes || [],
          colors: item.colors || [],
          size_chart: item.size_chart || [],
          vendor_id: vendor.id,
          linked_pro_inventory_id: item.id,
          in_stock: Number(item.stock_quantity || 0) > 0 || (item.variants || []).some((v: any) => Number(v.stock_quantity || 0) > 0),
          is_new: Boolean(item.is_new),
        };
        let product;
        if (existing[0]) {
          await base44.asServiceRole.entities.Product.update(existing[0].id, productData);
          product = { ...existing[0], ...productData };
        } else {
          product = await base44.asServiceRole.entities.Product.create(productData);
        }
        mappings.push({ inventoryId: item.id, productId: product.id });
      }

      return Response.json({ success: true, vendorId: vendor.id, mappings });
    }

    if (action === "completePurchase") {
      const { userId, businessId, businessName, externalPurchaseId, locationId, items = [] } = body;
      if (!userId || !externalPurchaseId) return Response.json({ error: "Missing purchase identity" }, { status: 400 });

      const duplicate = await base44.asServiceRole.entities.Purchase.filter({ external_purchase_id: externalPurchaseId, user_id: userId });
      if (duplicate.length > 0) return Response.json({ success: true, duplicate: true });

      const vendors = await base44.asServiceRole.entities.Vendor.filter({ linked_pro_business_id: businessId });
      const vendor = vendors[0];

      for (const item of items) {
        let productId = item.product_id || "";
        let product: any = null;
        if (!productId && item.inventory_item_id) {
          const products = await base44.asServiceRole.entities.Product.filter({ linked_pro_inventory_id: item.inventory_item_id });
          product = products[0] || null;
          productId = product?.id || "";
        } else if (productId) {
          const products = await base44.asServiceRole.entities.Product.filter({ id: productId });
          product = products[0] || null;
        }

        await base44.asServiceRole.entities.Purchase.create({
          user_id: userId,
          product_id: productId,
          product_name: item.name,
          product_image: item.image || product?.images?.[0] || "",
          product_price: Number(item.price || 0),
          quantity: Number(item.quantity || 1),
          size: item.size || "",
          color: item.color || "",
          vendor_id: vendor?.id || "",
          vendor_name: businessName || vendor?.business_name || "",
          location_id: locationId || "",
          external_purchase_id: externalPurchaseId,
          purchase_type: "in_store",
          status: "completed",
        });

        if (productId) {
          const wish = await base44.asServiceRole.entities.WishlistItem.filter({ user_id: userId, product_id: productId });
          for (const w of wish) await base44.asServiceRole.entities.WishlistItem.delete(w.id);
        }

        await base44.asServiceRole.entities.ClosetItem.create({
          user_id: userId,
          image: item.image || product?.images?.[0] || "",
          item_type: item.name,
          size: item.size || "",
          color: item.color || "",
          style_category: product?.style_type || "other",
          description: item.name,
          source: "purchased",
          external_purchase_id: externalPurchaseId,
        });
      }

      await base44.asServiceRole.entities.AppNotification.create({
        user_id: userId,
        title: "Purchase added to your closet",
        message: `Your purchase from ${businessName || "the store"} is now in My Closet.`,
        type: "purchase",
        vendor_id: vendor?.id || "",
      });

      return Response.json({ success: true });
    }

    if (action === "assignment") {
      const { externalCheckinId, employeeId, employeeName } = body;
      const records = await base44.asServiceRole.entities.StoreCheckin.filter({ id: externalCheckinId });
      if (records[0]) {
        await base44.asServiceRole.entities.StoreCheckin.update(records[0].id, {
          assigned_employee_id: employeeId || "",
          assigned_employee_name: employeeName || "",
          status: "assisted",
        });
      }
      return Response.json({ success: true });
    }

    if (action === "sendCampaign") {
      const { userIds = [], title, message, type = "general", couponCode = "", validUntil = "", vendorBusinessId = "" } = body;
      const vendors = await base44.asServiceRole.entities.Vendor.filter({ linked_pro_business_id: vendorBusinessId });
      const vendor = vendors[0];

      let delivered = 0;
      for (const userId of userIds) {
        await base44.asServiceRole.entities.AppNotification.create({
          user_id: userId,
          title,
          message,
          type,
          vendor_id: vendor?.id || "",
          coupon_code: couponCode,
          valid_until: validUntil || undefined,
        });
        try {
          const users = await base44.asServiceRole.entities.User.filter({ id: userId });
          const email = users[0]?.email;
          if (email) {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: email,
              subject: title,
              html: `<p>${message}</p>${couponCode ? `<p><strong>Code: ${couponCode}</strong></p>` : ""}`,
            });
          }
        } catch (emailError) {
          console.warn("campaign email failed", emailError);
        }
        delivered += 1;
      }
      return Response.json({ success: true, delivered });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("vendorBridge", error);
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
