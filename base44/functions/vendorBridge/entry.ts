import { createClientFromRequest } from "npm:@base44/sdk";

// Escapes untrusted text before it is interpolated into HTML email bodies.
function escapeHtml(value: any): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function authorize(base44: any, req: Request) {
  const configs = await base44.asServiceRole.entities.IntegrationConfig.filter({ key: "cross_app_sync", enabled: true });
  const expected = configs[0]?.token;
  const provided = req.headers.get("x-concierge-sync-secret");
  if (!expected || !provided) return false;
  // Constant-time comparison to avoid timing side channels on the shared secret.
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(provided);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a[i] || 0) ^ (b[i] || 0);
  }
  return diff === 0;
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
      id: l.id,
      name: l.name,
      address: l.address,
      lat: l.lat,
      lng: l.lng,
    })),
    linked_pro_business_id: business.id,
    setup_completed: Boolean(business.setup_complete),
    stripe_connected_account_id: business.stripe_connected_account_id || "",
    stripe_onboarding_complete: Boolean(business.stripe_onboarding_complete),
    stripe_charges_enabled: Boolean(business.stripe_charges_enabled),
    stripe_payouts_enabled: Boolean(business.stripe_payouts_enabled),
    stripe_transfers_enabled: Boolean(business.stripe_transfers_enabled),
    stripe_subscription_status: business.stripe_subscription_status || "",
    billing_plan: business.billing_plan || "standard",
    platform_fee_percent: Number(business.platform_fee_percent || 4),
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
    const eventKey = body?.eventKey || "";

    if (action === "updateVendorPayments") {
      const business = body.business || {};
      if (!business.id) return Response.json({ error: "Business ID is required" }, { status: 400 });
      const vendors = await base44.asServiceRole.entities.Vendor.filter({ linked_pro_business_id: business.id });
      if (!vendors[0]) {
        return Response.json({ success: true, updated: false, reason: "vendor_not_synced_yet" });
      }
      await base44.asServiceRole.entities.Vendor.update(vendors[0].id, {
        stripe_connected_account_id: business.stripe_connected_account_id || "",
        stripe_onboarding_complete: Boolean(business.stripe_onboarding_complete),
        stripe_charges_enabled: Boolean(business.stripe_charges_enabled),
        stripe_payouts_enabled: Boolean(business.stripe_payouts_enabled),
        stripe_transfers_enabled: Boolean(business.stripe_transfers_enabled),
        stripe_subscription_status: business.stripe_subscription_status || "",
        billing_plan: business.billing_plan || "standard",
        platform_fee_percent: Number(business.platform_fee_percent || 4),
      });
      return Response.json({ success: true, updated: true, vendorId: vendors[0].id });
    }

    if (action === "syncCatalog") {
      const vendor = await upsertVendor(base44, body.business, body.locations || []);
      const mappings: any[] = [];
      const now = new Date();
      const nowIso = now.toISOString();
      const staleAfter = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const normalizeKey = (value: any) =>
        String(value || "")
          .trim()
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[\\u0300-\\u036f]/g, "")
          .replace(/&/g, " and ")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

      const normalizeId = (value: any) =>
        String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

      for (const item of body.items || []) {
        const legacyExisting = await base44.asServiceRole.entities.Product.filter({
          linked_pro_inventory_id: item.id,
        });

        const brandName = item.brand || "Unknown Brand";
        const brandKey = normalizeKey(brandName) || "unknown-brand";
        const styleIdentity =
          normalizeId(item.style_number) ||
          normalizeId(item.mpn) ||
          normalizeId(item.gtin) ||
          normalizeKey(item.name) ||
          normalizeId(item.sku) ||
          "unknown-style";
        const canonicalKey = `${brandKey}:${styleIdentity}`;

        const existingMasters = await base44.asServiceRole.entities.ProductMaster.filter({
          canonical_key: canonicalKey,
        });

        let master: any;
        if (existingMasters[0]) {
          await base44.asServiceRole.entities.ProductMaster.update(existingMasters[0].id, {
            last_seen_at: nowIso,
            status: "active",
            active: true,
          });
          master = { ...existingMasters[0], last_seen_at: nowIso, status: "active", active: true };
        } else {
          master = await base44.asServiceRole.entities.ProductMaster.create({
            canonical_key: canonicalKey,
            brand_name: brandName,
            brand_key: brandKey,
            product_name: item.name || "Unnamed product",
            style_number: item.style_number || "",
            mpn: item.mpn || "",
            primary_gtin: item.gtin || "",
            category: item.category || "",
            product_type: item.category || "",
            official_description: item.description || "",
            fit_cut: item.garment_fit?.fit_cut || "unknown",
            footwear_type: item.footwear_type || "all",
            primary_image_url: item.images?.[0] || "",
            image_urls: item.images || [],
            status: "active",
            first_seen_at: nowIso,
            last_seen_at: nowIso,
            canonical_confidence: 0.8,
            dedup_status: "canonical",
            identifier_fingerprint: canonicalKey,
            legacy_product_ids: [],
            source_record_count: 0,
            active: true,
          });
        }

        const canonicalVariantIds: string[] = [];
        const retailerOfferIds: string[] = [];
        const rawVariants = Array.isArray(item.variants) ? item.variants : [];

        for (const rawVariant of rawVariants) {
          const globalId =
            normalizeId(rawVariant.gtin) ||
            normalizeId(rawVariant.upc) ||
            normalizeId(rawVariant.ean) ||
            normalizeId(rawVariant.mpn);

          const variantAttributes = [
            normalizeKey(rawVariant.size),
            normalizeKey(rawVariant.color),
            normalizeKey(rawVariant.width_code),
            normalizeKey(rawVariant.length_code || rawVariant.inseam),
          ].filter(Boolean);

          const variantKey = globalId
            ? `${master.id}:id:${globalId}`
            : variantAttributes.length
              ? `${master.id}:attr:${variantAttributes.join(":")}`
              : `${master.id}:sku:${normalizeId(rawVariant.sku) || "unspecified"}`;

          const existingVariants = await base44.asServiceRole.entities.ProductVariant.filter({
            variant_key: variantKey,
          });

          const variantData = {
            product_master_id: master.id,
            variant_key: variantKey,
            sku: rawVariant.sku || "",
            gtin: rawVariant.gtin || "",
            upc: rawVariant.upc || "",
            ean: rawVariant.ean || "",
            mpn: rawVariant.mpn || "",
            size_label: rawVariant.size || "",
            size_region: "US",
            color_name: rawVariant.color || "",
            width_code: rawVariant.width_code || "",
            width_label: rawVariant.width_label || "",
            length_code: rawVariant.length_code || rawVariant.inseam || "",
            status: Number(rawVariant.stock_quantity || 0) > 0 ? "active" : "unavailable",
            last_seen_at: nowIso,
            identifier_fingerprint: variantKey,
            active: true,
          };

          let variant: any;
          if (existingVariants[0]) {
            await base44.asServiceRole.entities.ProductVariant.update(existingVariants[0].id, variantData);
            variant = { ...existingVariants[0], ...variantData };
          } else {
            variant = await base44.asServiceRole.entities.ProductVariant.create({
              ...variantData,
              first_seen_at: nowIso,
            });
          }
          canonicalVariantIds.push(variant.id);

          const retailerKey = normalizeKey(body.business?.name || body.business?.id || "retailer");
          const offerKey = `${body.business.id}:${item.location_id || "all"}:${item.id}:${variant.id}`;
          const existingOffers = await base44.asServiceRole.entities.RetailerOffer.filter({
            offer_key: offerKey,
          });
          const stock = Number(rawVariant.stock_quantity || 0);
          const offerData = {
            offer_key: offerKey,
            product_master_id: master.id,
            product_variant_id: variant.id,
            offer_scope: "variant",
            retailer_name: body.business?.name || "Retailer",
            retailer_key: retailerKey,
            business_id: body.business.id,
            location_id: item.location_id || "",
            channel: "local_store",
            retailer_sku: rawVariant.sku || item.sku || "",
            seller_product_id: item.id,
            offer_url: item.retailer_product_url || "",
            currency: "USD",
            regular_price: Number(item.price || 0),
            current_price: Number(item.price || 0),
            sale_active: false,
            availability: stock > 0 ? "in_stock" : "out_of_stock",
            stock_quantity: stock,
            available_in_store: true,
            fulfillment: "store_only",
            last_seen_at: nowIso,
            price_checked_at: nowIso,
            availability_checked_at: nowIso,
            stale_after: staleAfter,
            freshness_status: "fresh",
            source_confidence: 0.95,
            active: true,
          };

          let offer: any;
          if (existingOffers[0]) {
            await base44.asServiceRole.entities.RetailerOffer.update(existingOffers[0].id, offerData);
            offer = { ...existingOffers[0], ...offerData };
          } else {
            offer = await base44.asServiceRole.entities.RetailerOffer.create({
              ...offerData,
              first_seen_at: nowIso,
            });
          }
          retailerOfferIds.push(offer.id);
        }

        if (!rawVariants.length) {
          const retailerKey = normalizeKey(body.business?.name || body.business?.id || "retailer");
          const offerKey = `${body.business.id}:${item.location_id || "all"}:${item.id}:style`;
          const existingOffers = await base44.asServiceRole.entities.RetailerOffer.filter({
            offer_key: offerKey,
          });
          const stock = Number(item.stock_quantity || 0);
          const offerData = {
            offer_key: offerKey,
            product_master_id: master.id,
            product_variant_id: "",
            offer_scope: "style",
            retailer_name: body.business?.name || "Retailer",
            retailer_key: retailerKey,
            business_id: body.business.id,
            location_id: item.location_id || "",
            channel: "local_store",
            retailer_sku: item.sku || "",
            seller_product_id: item.id,
            offer_url: item.retailer_product_url || "",
            currency: "USD",
            regular_price: Number(item.price || 0),
            current_price: Number(item.price || 0),
            sale_active: false,
            availability: stock > 0 ? "in_stock" : "out_of_stock",
            stock_quantity: stock,
            available_in_store: true,
            fulfillment: "store_only",
            last_seen_at: nowIso,
            price_checked_at: nowIso,
            availability_checked_at: nowIso,
            stale_after: staleAfter,
            freshness_status: "fresh",
            source_confidence: 0.95,
            active: true,
          };

          let offer: any;
          if (existingOffers[0]) {
            await base44.asServiceRole.entities.RetailerOffer.update(existingOffers[0].id, offerData);
            offer = { ...existingOffers[0], ...offerData };
          } else {
            offer = await base44.asServiceRole.entities.RetailerOffer.create({
              ...offerData,
              first_seen_at: nowIso,
            });
          }
          retailerOfferIds.push(offer.id);
        }

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
          size_chart_measurement_basis: item.size_chart_measurement_basis || "body",
          size_chart: item.size_chart || [],
          garment_fit: item.garment_fit || {},
          garment_measurements: item.garment_measurements || [],
          footwear_type: item.footwear_type || "all",
          width_options: item.width_options || [],
          footwear_fit: item.footwear_fit || {},
          variants: item.variants || [],
          stock_quantity: Number(item.stock_quantity || 0),
          vendor_id: vendor.id,
          linked_pro_inventory_id: item.id,
          in_stock:
            Number(item.stock_quantity || 0) > 0 ||
            (item.variants || []).some((v: any) => Number(v.stock_quantity || 0) > 0),
          discontinued: false,
          is_new: Boolean(item.is_new),
          style_number: item.style_number || "",
          mpn: item.mpn || "",
          gtin: item.gtin || "",
          product_master_id: master.id,
          canonical_variant_ids: canonicalVariantIds,
          retailer_offer_ids: retailerOfferIds,
          catalog_migration_status: "linked",
          catalog_migrated_at: nowIso,
        };

        let product: any;
        if (legacyExisting[0]) {
          await base44.asServiceRole.entities.Product.update(legacyExisting[0].id, productData);
          product = { ...legacyExisting[0], ...productData };
        } else {
          product = await base44.asServiceRole.entities.Product.create(productData);
        }

        mappings.push({
          inventoryId: item.id,
          productId: product.id,
          productMasterId: master.id,
          variantIds: canonicalVariantIds,
          offerIds: retailerOfferIds,
        });
      }

      const incomingIds = new Set((body.items || []).map((item: any) => item.id));
      const existingProducts = await base44.asServiceRole.entities.Product.filter({ vendor_id: vendor.id });
      let deactivated = 0;
      for (const product of existingProducts) {
        if (product.linked_pro_inventory_id && !incomingIds.has(product.linked_pro_inventory_id)) {
          await base44.asServiceRole.entities.Product.update(product.id, {
            in_stock: false,
            discontinued: true,
          });
          for (const offerId of product.retailer_offer_ids || []) {
            const offers = await base44.asServiceRole.entities.RetailerOffer.filter({ id: offerId });
            if (offers[0]) {
              await base44.asServiceRole.entities.RetailerOffer.update(offers[0].id, {
                availability: "out_of_stock",
                active: false,
                last_seen_at: nowIso,
                freshness_status: "stale",
              });
            }
          }
          deactivated += 1;
        }
      }

      return Response.json({ success: true, vendorId: vendor.id, mappings, deactivated });
    }

    if (action === "deleteVendor") {
      const { businessId } = body;
      if (!businessId) return Response.json({ error: "businessId is required" }, { status: 400 });

      const vendors = await base44.asServiceRole.entities.Vendor.filter({ linked_pro_business_id: businessId });
      for (const vendor of vendors) {
        const products = await base44.asServiceRole.entities.Product.filter({ vendor_id: vendor.id });
        for (const product of products) {
          const wish = await base44.asServiceRole.entities.WishlistItem.filter({ product_id: product.id });
          for (const item of wish) await base44.asServiceRole.entities.WishlistItem.delete(item.id);
          const cart = await base44.asServiceRole.entities.CartItem.filter({ product_id: product.id });
          for (const item of cart) await base44.asServiceRole.entities.CartItem.delete(item.id);
          await base44.asServiceRole.entities.Product.delete(product.id);
        }
        await base44.asServiceRole.entities.Vendor.delete(vendor.id);
      }
      return Response.json({ success: true, deletedVendors: vendors.length });
    }

    if (action === "completePurchase") {
      const { userId, businessId, businessName, externalPurchaseId, locationId, items = [] } = body;
      if (!userId || !externalPurchaseId) return Response.json({ error: "Missing purchase identity" }, { status: 400 });

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

        const lineKey =
          item.line_key ||
          `${externalPurchaseId}:${item.inventory_item_id || productId}:${item.size || ""}:${item.width_code || ""}:${item.color || ""}`;

        const purchases = await base44.asServiceRole.entities.Purchase.filter({
          user_id: userId,
          external_line_key: lineKey,
        });
        if (!purchases[0]) {
          await base44.asServiceRole.entities.Purchase.create({
            user_id: userId,
            product_id: productId,
            product_name: item.name,
            product_image: item.image || product?.images?.[0] || "",
            product_price: Number(item.price || 0),
            quantity: Number(item.quantity || 1),
            size: item.size || "",
            width_code: item.width_code || "",
            color: item.color || "",
            vendor_id: vendor?.id || "",
            vendor_name: businessName || vendor?.business_name || "",
            location_id: locationId || "",
            external_purchase_id: externalPurchaseId,
            external_line_key: lineKey,
            purchase_type: "in_store",
            status: "completed",
          });
        }

        if (productId) {
          const wish = await base44.asServiceRole.entities.WishlistItem.filter({ user_id: userId, product_id: productId });
          for (const w of wish) await base44.asServiceRole.entities.WishlistItem.delete(w.id);
        }

        const closet = await base44.asServiceRole.entities.ClosetItem.filter({
          user_id: userId,
          external_line_key: lineKey,
        });
        if (!closet[0]) {
          await base44.asServiceRole.entities.ClosetItem.create({
            user_id: userId,
            image: item.image || product?.images?.[0] || "",
            item_type: item.name,
            size: item.size || "",
            width_code: item.width_code || "",
            color: item.color || "",
            style_category: product?.style_type || "other",
            description: item.name,
            source: "purchased",
            external_purchase_id: externalPurchaseId,
            external_line_key: lineKey,
          });
        }
      }

      const notificationKey = eventKey || `purchase:${externalPurchaseId}`;
      const notifications = await base44.asServiceRole.entities.AppNotification.filter({
        user_id: userId,
        external_event_key: notificationKey,
      });
      if (!notifications[0]) {
        await base44.asServiceRole.entities.AppNotification.create({
          user_id: userId,
          title: "Purchase added to your closet",
          message: `Your purchase from ${businessName || "the store"} is now in My Closet.`,
          type: "purchase",
          vendor_id: vendor?.id || "",
          external_event_key: notificationKey,
        });
      }

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
        const notificationKey = `${eventKey || "campaign"}:${userId}`;
        const existing = await base44.asServiceRole.entities.AppNotification.filter({
          user_id: userId,
          external_event_key: notificationKey,
        });

        if (!existing[0]) {
          await base44.asServiceRole.entities.AppNotification.create({
            user_id: userId,
            title,
            message,
            type,
            vendor_id: vendor?.id || "",
            coupon_code: couponCode,
            valid_until: validUntil || undefined,
            external_event_key: notificationKey,
          });

          try {
            const users = await base44.asServiceRole.entities.User.filter({ id: userId });
            const email = users[0]?.email;
            if (email) {
              await base44.asServiceRole.integrations.Core.SendEmail({
                to: email,
                subject: escapeHtml(title),
                html: `<p>${escapeHtml(message)}</p>${couponCode ? `<p><strong>Code: ${escapeHtml(couponCode)}</strong></p>` : ""}`,
              });
            }
          } catch (emailError) {
            console.warn("campaign email failed", emailError);
          }
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