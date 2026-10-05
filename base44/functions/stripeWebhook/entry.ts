import { createClientFromRequest } from "npm:@base44/sdk";
import Stripe from "npm:stripe@23.0.0";
import { secrets } from "base44:runtime";

const PRO_APP_ID = "69a25fa908ebd18cd4723d7c";

async function getSyncToken(base44: any) {
  const rows = await base44.asServiceRole.entities.IntegrationConfig.filter({
    key: "cross_app_sync",
    enabled: true,
  });
  return rows[0]?.token || null;
}

async function decrementCustomerCatalogStock(base44: any, item: any, stockEventKey: string) {
  const rows = await base44.asServiceRole.entities.Product.filter({ id: item.product_id });
  const product = rows[0];
  if (!product) return;

  const processed = Array.isArray(product.processed_stock_events)
    ? product.processed_stock_events
    : [];
  if (processed.includes(stockEventKey)) return;

  const quantity = Math.max(1, Number(item.quantity || 1));
  const nextProcessed = [...processed, stockEventKey].slice(-250);

  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const variants = product.variants.map((variant: any) => {
      if (
        String(variant.size || "") === String(item.size || "") &&
        String(variant.color || "") === String(item.color || "")
      ) {
        return {
          ...variant,
          stock_quantity: Math.max(0, Number(variant.stock_quantity || 0) - quantity),
        };
      }
      return variant;
    });
    const stock = variants.reduce((sum: number, variant: any) =>
      sum + Math.max(0, Number(variant.stock_quantity || 0)), 0);
    await base44.asServiceRole.entities.Product.update(product.id, {
      variants,
      stock_quantity: stock,
      in_stock: stock > 0,
      processed_stock_events: nextProcessed,
    });
  } else if (product.linked_pro_inventory_id) {
    const stock = Math.max(0, Number(product.stock_quantity || 0) - quantity);
    await base44.asServiceRole.entities.Product.update(product.id, {
      stock_quantity: stock,
      in_stock: stock > 0,
      processed_stock_events: nextProcessed,
    });
  }
}

async function deliverQueuedToPro(base44: any, order: any, action: string, payload: any, eventKey: string) {
  const existing = await base44.asServiceRole.entities.IntegrationSyncJob.filter({
    direction: "to_pro",
    event_key: eventKey,
  });
  if (existing[0]?.status === "completed") return { success: true, duplicate: true };

  let job = existing[0] || null;
  const payloadJson = JSON.stringify({ action, eventKey, ...payload });
  if (!job) {
    job = await base44.asServiceRole.entities.IntegrationSyncJob.create({
      owner_user_id: order.user_id,
      business_id: payload?.businessId || "",
      direction: "to_pro",
      action,
      event_key: eventKey,
      payload_json: payloadJson,
      status: "pending",
      attempts: 0,
    });
  }

  const token = await getSyncToken(base44);
  if (!token) {
    await base44.asServiceRole.entities.IntegrationSyncJob.update(job.id, {
      status: "pending",
      last_error: "Cross-app integration is not configured.",
    });
    return { success: false, error: "Cross-app integration is not configured." };
  }

  try {
    const response = await fetch(
      `https://base44.app/api/apps/${PRO_APP_ID}/functions/receiveCustomerEvent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-concierge-sync-secret": token,
        },
        body: payloadJson,
      },
    );
    const result = await response.json().catch(() => ({}));
    const attempts = Number(job.attempts || 0) + 1;
    if (!response.ok) throw new Error(result?.error || "Concierge Pro sync failed.");

    await base44.asServiceRole.entities.IntegrationSyncJob.update(job.id, {
      status: "completed",
      attempts,
      last_error: "",
      last_attempt_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    return { success: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Concierge Pro sync failed";
    await base44.asServiceRole.entities.IntegrationSyncJob.update(job.id, {
      status: "pending",
      attempts: Number(job.attempts || 0) + 1,
      last_error: message,
      last_attempt_at: new Date().toISOString(),
    });
    return { success: false, error: message };
  }
}

async function syncPaidOrderToPro(base44: any, order: any, user: any) {
  const groups = new Map<string, any[]>();
  for (const item of order.items || []) {
    if (!item.pro_business_id) continue;
    const current = groups.get(item.pro_business_id) || [];
    current.push(item);
    groups.set(item.pro_business_id, current);
  }

  if (!groups.size) return [];

  const entries = Array.from(groups.entries());
  const totalSubtotalCents = Math.max(0, Math.round(Number(order.subtotal || 0) * 100));
  const totalsCents = {
    discount: Math.max(0, Math.round(Number(order.discount || 0) * 100)),
    tax: Math.max(0, Math.round(Number(order.tax || 0) * 100)),
    shipping: Math.max(0, Math.round(Number(order.shipping || 0) * 100)),
  };
  const allocated = { discount: 0, tax: 0, shipping: 0 };
  const errors: string[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const [businessId, items] = entries[index];
    const groupSubtotalCents = items.reduce(
      (sum: number, item: any) =>
        sum + Math.max(0, Math.round(Number(item.unit_price || 0) * 100)) * Math.max(1, Number(item.quantity || 1)),
      0,
    );
    const last = index === entries.length - 1;
    const ratio = totalSubtotalCents > 0 ? groupSubtotalCents / totalSubtotalCents : 0;

    const groupCents: any = { subtotal: groupSubtotalCents };
    for (const key of ["discount", "tax", "shipping"] as const) {
      groupCents[key] = last
        ? totalsCents[key] - allocated[key]
        : Math.max(0, Math.round(totalsCents[key] * ratio));
      allocated[key] += groupCents[key];
    }
    groupCents.total =
      groupCents.subtotal - groupCents.discount + groupCents.tax + groupCents.shipping;

    const result = await deliverQueuedToPro(
      base44,
      order,
      "onlinePurchase",
      {
        businessId,
        externalOrderId: order.id,
        customer: {
          user_id: order.user_id,
          name: user?.full_name || user?.email || "Online customer",
          email: user?.email || "",
        },
        orderTotals: {
          subtotal: groupCents.subtotal / 100,
          discount: groupCents.discount / 100,
          tax: groupCents.tax / 100,
          shipping: groupCents.shipping / 100,
          total: groupCents.total / 100,
          currency: order.currency || "usd",
        },
        attribution: {
          attributed: Boolean(order.concierge_attributed),
          source: order.attribution_source || "concierge_online",
          platformFeePercent: Number(order.platform_fee_percent || 4),
          platformFeeAmount: Number(order.platform_fee_amount || 0),
          platformFeeStatus: order.platform_fee_status || "collected",
        },
        items: items.map((item: any) => ({
          product_id: item.product_id,
          line_key: `${order.id}:${item.cart_item_id || [item.product_id, item.size, item.color].join(":")}`,
          name: item.product_name,
          quantity: item.quantity,
          price: item.unit_price,
          size: item.size || "",
          color: item.color || "",
        })),
      },
      `onlinePurchase:${order.id}:${businessId}`,
    );

    if (!result.success) errors.push(result.error || `Concierge Pro sync failed for business ${businessId}`);
  }

  return errors;
}

async function finalizePaidOrder(base44: any, stripe: Stripe, sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent", "payment_intent.payment_method"],
  }) as any;

  const orderId = session.metadata?.concierge_order_id;
  if (!orderId) throw new Error("Stripe session is missing the Concierge order ID.");

  const orders = await base44.asServiceRole.entities.Order.filter({ id: orderId });
  const order = orders[0];
  if (!order) throw new Error("Concierge order was not found.");

  const paymentIntent = session.payment_intent as any;
  const paymentIntentId = typeof paymentIntent === "string"
    ? paymentIntent
    : paymentIntent?.id || "";
  const platformFeeAmount = Number(
    paymentIntent && typeof paymentIntent !== "string"
      ? paymentIntent.application_fee_amount || session.metadata?.concierge_platform_fee_amount_cents || 0
      : session.metadata?.concierge_platform_fee_amount_cents || 0
  ) / 100;
  const platformFeePercent = Number(session.metadata?.concierge_platform_fee_percent || order.platform_fee_percent || 4);

  const shippingDetails =
    session.collected_information?.shipping_details ||
    session.shipping_details ||
    null;
  const address = shippingDetails?.address || {};

  const shippingAddress = shippingDetails ? {
    name: shippingDetails.name || "",
    line1: address.line1 || "",
    line2: address.line2 || "",
    city: address.city || "",
    state: address.state || "",
    postal_code: address.postal_code || "",
    country: address.country || "",
    phone: shippingDetails.phone || session.customer_details?.phone || "",
  } : undefined;

  await base44.asServiceRole.entities.Order.update(order.id, {
    payment_status: "paid",
    fulfillment_status: "processing",
    payment_intent_id: paymentIntentId,
    subtotal: Number(session.amount_subtotal || 0) / 100,
    shipping: Number(session.total_details?.amount_shipping || 0) / 100,
    tax: Number(session.total_details?.amount_tax || 0) / 100,
    discount: Number(session.total_details?.amount_discount || 0) / 100,
    total: Number(session.amount_total || 0) / 100,
    concierge_attributed: true,
    attribution_source: session.metadata?.concierge_attribution_source || "concierge_online",
    platform_fee_percent: platformFeePercent,
    platform_fee_amount: platformFeeAmount,
    platform_fee_status: "collected",
    shipping_address: shippingAddress,
    sync_error: "",
  });

  const users = await base44.asServiceRole.entities.User.filter({ id: order.user_id });
  const user = users[0] || null;

  for (const item of order.items || []) {
    const lineKey = `${order.id}:${item.cart_item_id || [item.product_id, item.size, item.color].join(":")}`;

    const purchases = await base44.asServiceRole.entities.Purchase.filter({
      user_id: order.user_id,
      external_line_key: lineKey,
    });
    if (!purchases[0]) {
      await base44.asServiceRole.entities.Purchase.create({
        user_id: order.user_id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_image: item.product_image || "",
        product_price: Number(item.unit_price || 0),
        size: item.size || "",
        color: item.color || "",
        vendor_id: item.vendor_id || "",
        vendor_name: item.vendor_name || "",
        purchase_type: "online",
        status: "processing",
        external_purchase_id: order.id,
        external_line_key: lineKey,
        quantity: Number(item.quantity || 1),
      });
    }

    const closet = await base44.asServiceRole.entities.ClosetItem.filter({
      user_id: order.user_id,
      external_line_key: lineKey,
    });
    if (!closet[0]) {
      await base44.asServiceRole.entities.ClosetItem.create({
        user_id: order.user_id,
        image: item.product_image || "",
        item_type: item.product_name,
        size: item.size || "",
        color: item.color || "",
        style_category: "other",
        description: item.product_name,
        source: "purchased",
        external_purchase_id: order.id,
        external_line_key: lineKey,
      });
    }

    await decrementCustomerCatalogStock(base44, item, `stock:${lineKey}`);

    if (item.cart_item_id) {
      try {
        await base44.asServiceRole.entities.CartItem.delete(item.cart_item_id);
      } catch {
        // Idempotent webhook delivery: cart item may already be gone.
      }
    }
  }

  if (order.save_shipping_address && shippingAddress?.line1) {
    const matches = await base44.asServiceRole.entities.ShippingAddress.filter({
      user_id: order.user_id,
      line1: shippingAddress.line1,
      postal_code: shippingAddress.postal_code,
    });
    if (!matches[0]) {
      const existingAddresses = await base44.asServiceRole.entities.ShippingAddress.filter({
        user_id: order.user_id,
      });
      await base44.asServiceRole.entities.ShippingAddress.create({
        user_id: order.user_id,
        ...shippingAddress,
        is_default: existingAddresses.length === 0,
      });
    }
  }

  if (order.save_card && paymentIntent && typeof paymentIntent !== "string") {
    const paymentMethod = paymentIntent.payment_method as any;
    if (paymentMethod?.id && paymentMethod?.card) {
      const existing = await base44.asServiceRole.entities.PaymentMethod.filter({
        user_id: order.user_id,
        processor_payment_method_id: paymentMethod.id,
      });
      const data = {
        user_id: order.user_id,
        processor: "stripe",
        processor_payment_method_id: paymentMethod.id,
        card_last_four: paymentMethod.card.last4 || "",
        card_type: paymentMethod.card.brand || "card",
        expiry_month: Number(paymentMethod.card.exp_month || 0),
        expiry_year: Number(paymentMethod.card.exp_year || 0),
        is_default: existing.length === 0,
      };
      if (existing[0]) {
        await base44.asServiceRole.entities.PaymentMethod.update(existing[0].id, data);
      } else {
        await base44.asServiceRole.entities.PaymentMethod.create(data);
      }
    }
  }

  const finalOrder = {
    ...order,
    payment_status: "paid",
    fulfillment_status: "processing",
    payment_intent_id: paymentIntentId,
    subtotal: Number(session.amount_subtotal || 0) / 100,
    shipping: Number(session.total_details?.amount_shipping || 0) / 100,
    tax: Number(session.total_details?.amount_tax || 0) / 100,
    discount: Number(session.total_details?.amount_discount || 0) / 100,
    total: Number(session.amount_total || 0) / 100,
    concierge_attributed: true,
    attribution_source: session.metadata?.concierge_attribution_source || "concierge_online",
    platform_fee_percent: platformFeePercent,
    platform_fee_amount: platformFeeAmount,
    platform_fee_status: "collected",
    shipping_address: shippingAddress,
  };

  const syncErrors = await syncPaidOrderToPro(base44, finalOrder, user);
  await base44.asServiceRole.entities.Order.update(order.id, {
    sync_error: syncErrors.join(" | "),
    pro_sync_status: syncErrors.length ? "partial" : "completed",
  });

  const notificationKey = `order-confirmed:${order.id}`;
  const existingNotifications = await base44.asServiceRole.entities.AppNotification.filter({
    user_id: order.user_id,
    external_event_key: notificationKey,
  });
  if (!existingNotifications[0]) {
    await base44.asServiceRole.entities.AppNotification.create({
      user_id: order.user_id,
      title: "Order confirmed",
      message: `Your order #${String(order.id).slice(-8)} was paid successfully and is now processing.`,
      type: "purchase",
      external_event_key: notificationKey,
    });
  }

  return finalOrder;
}

export default async function (req: Request): Promise<Response> {
  try {
    const stripeSecret = secrets.get("STRIPE_SECRET_KEY");
    const webhookSecret = secrets.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeSecret || !webhookSecret) {
      return Response.json({ error: "Stripe webhook is not configured." }, { status: 503 });
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
    }

    const rawBody = await req.text();
    const stripe = new Stripe(stripeSecret);

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (error) {
      console.warn("Stripe webhook signature verification failed", error);
      return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid" || event.type === "checkout.session.async_payment_succeeded") {
        await finalizePaidOrder(base44, stripe, session.id);
      }
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.concierge_order_id;
      if (orderId) {
        const orders = await base44.asServiceRole.entities.Order.filter({ id: orderId });
        if (orders[0] && orders[0].payment_status !== "paid") {
          await base44.asServiceRole.entities.Order.update(orders[0].id, {
            payment_status: "failed",
            fulfillment_status: "cancelled",
          });
        }
      }
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
      if (paymentIntentId) {
        const orders = await base44.asServiceRole.entities.Order.filter({
          payment_intent_id: paymentIntentId,
        });
        if (orders[0]) {
          await base44.asServiceRole.entities.Order.update(orders[0].id, {
            payment_status: "refunded",
            fulfillment_status: "cancelled",
            platform_fee_status: "refunded",
          });
          const purchases = await base44.asServiceRole.entities.Purchase.filter({
            user_id: orders[0].user_id,
            external_purchase_id: orders[0].id,
          });
          for (const purchase of purchases) {
            await base44.asServiceRole.entities.Purchase.update(purchase.id, {
              status: "refunded",
            });
          }
          await base44.asServiceRole.entities.AppNotification.create({
            user_id: orders[0].user_id,
            title: "Order refunded",
            message: `A refund was recorded for order #${String(orders[0].id).slice(-8)}.`,
            type: "purchase",
          });
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("stripeWebhook", error);
    return Response.json({
      error: error instanceof Error ? error.message : "Webhook processing failed.",
    }, { status: 500 });
  }
}
