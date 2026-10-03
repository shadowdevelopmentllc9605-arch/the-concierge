import { createClientFromRequest } from "npm:@base44/sdk";

const PRO_APP_ID = "69a25fa908ebd18cd4723d7c";

async function getSyncToken(base44: any) {
  const configs = await base44.asServiceRole.entities.IntegrationConfig.filter({ key: "cross_app_sync", enabled: true });
  return configs[0]?.token || null;
}

async function postToPro(base44: any, action: string, payload: any) {
  const token = await getSyncToken(base44);
  if (!token) return { connected: false, reason: "integration_not_configured" };

  const response = await fetch(`https://base44.app/api/apps/${PRO_APP_ID}/functions/receiveCustomerEvent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-concierge-sync-secret": token,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Concierge Pro sync failed (${response.status})`);
  return { connected: true, ...data };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const action = body?.action;

    if (action === "checkin") {
      const { vendorId, locationId } = body;
      if (!vendorId) return Response.json({ error: "vendorId is required" }, { status: 400 });

      const vendors = await base44.asServiceRole.entities.Vendor.filter({ id: vendorId });
      const vendor = vendors[0];
      if (!vendor) return Response.json({ error: "Store not found" }, { status: 404 });

      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.id });
      const profile = profiles[0] || {};
      const wishlist = await base44.asServiceRole.entities.WishlistItem.filter({ user_id: user.id, vendor_id: vendorId });
      const history = await base44.asServiceRole.entities.Purchase.filter({ user_id: user.id, vendor_id: vendorId });

      const existing = await base44.asServiceRole.entities.StoreCheckin.filter({ user_id: user.id, vendor_id: vendorId });
      for (const old of existing.filter((item: any) => item.status !== "completed")) {
        await base44.asServiceRole.entities.StoreCheckin.update(old.id, { status: "completed" });
      }

      const checkin = await base44.asServiceRole.entities.StoreCheckin.create({
        user_id: user.id,
        user_name: user.full_name || user.email,
        user_picture: profile.profile_picture || "",
        vendor_id: vendorId,
        pro_business_id: vendor.linked_pro_business_id || "",
        location_id: locationId || "",
        status: "browsing",
        wishlist_items: wishlist.map((item: any) => item.id),
      });

      let proSync = { connected: false, reason: "vendor_not_linked" };
      if (vendor.linked_pro_business_id) {
        proSync = await postToPro(base44, "checkin", {
          businessId: vendor.linked_pro_business_id,
          locationId: locationId || "",
          externalCheckinId: checkin.id,
          customer: {
            user_id: user.id,
            name: user.full_name || user.email,
            email: user.email,
            photo_url: profile.profile_picture || "",
            birthday: profile.birthday || null,
            preferences: {
              style_preferences: profile.style_preferences || [],
              sizes: profile.suggested_sizes || {},
            },
            wishlist: wishlist.map((item: any) => ({
              id: item.id,
              product_id: item.product_id,
              product_name: item.product_name,
            })),
            history: history.map((purchase: any) => ({
              id: purchase.id,
              product_id: purchase.product_id,
              product_name: purchase.product_name,
              product_price: purchase.product_price,
              size: purchase.size,
              color: purchase.color,
              status: purchase.status,
              created_date: purchase.created_date,
            })),
          },
        });
      }

      return Response.json({ checkin, proSync });
    }

    if (action === "tryOnRequest") {
      const { checkinId, wishlistItemIds = [] } = body;
      const records = await base44.asServiceRole.entities.StoreCheckin.filter({ id: checkinId, user_id: user.id });
      const checkin = records[0];
      if (!checkin) return Response.json({ error: "Check-in not found" }, { status: 404 });

      const wishlistRows = [];
      for (const wishlistId of wishlistItemIds) {
        const matches = await base44.asServiceRole.entities.WishlistItem.filter({ id: wishlistId, user_id: user.id });
        if (matches[0] && matches[0].vendor_id === checkin.vendor_id) wishlistRows.push(matches[0]);
      }

      await base44.asServiceRole.entities.StoreCheckin.update(checkin.id, {
        status: "assisted",
        wishlist_items: wishlistRows.map((item: any) => item.id),
      });

      let proSync = { connected: false };
      if (checkin.pro_business_id) {
        proSync = await postToPro(base44, "tryOnRequest", {
          businessId: checkin.pro_business_id,
          customerId: user.id,
          productIds: wishlistRows.map((item: any) => item.product_id),
        });
      }
      return Response.json({ success: true, proSync });
    }

    if (action === "checkout") {
      const { checkinId } = body;
      if (!checkinId) return Response.json({ error: "checkinId is required" }, { status: 400 });

      const records = await base44.asServiceRole.entities.StoreCheckin.filter({ id: checkinId, user_id: user.id });
      const checkin = records[0];
      if (!checkin) return Response.json({ error: "Check-in not found" }, { status: 404 });

      await base44.asServiceRole.entities.StoreCheckin.update(checkin.id, { status: "completed" });

      let proSync = { connected: false };
      if (checkin.pro_business_id) {
        proSync = await postToPro(base44, "checkout", {
          businessId: checkin.pro_business_id,
          externalCheckinId: checkin.id,
          customerId: user.id,
        });
      }

      return Response.json({ success: true, proSync });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("storeVisit", error);
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
