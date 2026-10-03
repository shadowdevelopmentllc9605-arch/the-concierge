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

async function decrementCustomerCatalogStock(base44: any, item: any) {
  const rows = await base44.asServiceRole.entities.Product.filter({ id: item.product_id });
  const product = rows[0];
  if (!product) return;

  const quantity = Math.max(1, Number(item.quantity || 1));
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
    });
  } else if (product.linked_pro_inventory_id) {
    const stock = Math.max(0, Number(product.stock_quantity || 0) - quantity);
    await base44.asServiceRole.entities.Product.update(product.id, {
      stock_quantity: stock,
      in_stock: stock > 0,
    });
  }
}

async function syncPaidOrderToPro(base44: any, order: any, user: any) {
  const token = await getSyncToken(base44);
  const groups = new Map<string, any[]>();

  for (const item of order.items || []) {
    if (!item.pro_business_id) continue;
    const current = groups.get(item.pro_business_id) || [];
    current.push(item);
    groups.set(item.pro_business_id, current);
  }

  if (!groups.size) return [];
  if (!token) return ["Cross-app integration is not configured."];

  const errors: string[] = [];
  for (const [businessId, items] of groups.entries()) {
    try {
      const response = await fetch(
        `https://base44.app/api/apps/${PRO_APP_ID}/functions/receiveCustomerEvent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-concierge-sync-secret": token,
          },
          body: JSON.stringify({
            action: "onlinePurchase",
            businessId,
            externalOrderId: order.id,
            customer: {
              user_id: order.user_id,
              name: user?.full_name || user?.email || "Online customer",
              email: user?.email || "",
            },
            items: items.map((item: any) => ({
              product_id: item.product_id,
              name: item.product_name,
              quantity: item.quantity,
              price: item.unit_price,
              size: item.size || "",
              color: item.color || "",
            })),
          }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        errors.push(result?.error || `Concierge Pro sync failed for business ${businessId}`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Concierge Pro sync failed");
    }
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
  if (order.payment_status === "paid") return order;

  const paymentIntent = session.payment_intent as any;
  const paymentIntentId = typeof paymentIntent === "string"
    ? paymentIntent
    : paymentIntent?.id || "";

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
    total: Number(session.amount_total || 0) / 100,
    shipping_address: shippingAddress,
    sync_error: "",
  });

  const users = await base44.asServiceRole.entities.User.filter({ id: order.user_id });
  const user = users[0] || null;

  const existingPurchases = await base44.asServiceRole.entities.Purchase.filter({
    user_id: order.user_id,
    external_purchase_id: order.id,
  });

  if (!existingPurchases.length) {
    for (const item of order.items || []) {
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
        quantity: Number(item.quantity || 1),
      });

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
      });

      await decrementCustomerCatalogStock(base44, item);
    }

    for (const item of order.items || []) {
      if (!item.cart_item_id) continue;
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

  const syncErrors = await syncPaidOrderToPro(base44, order, user);
  if (syncErrors.length) {
    await base44.asServiceRole.entities.Order.update(order.id, {
      sync_error: syncErrors.join(" | "),
    });
  }

  await base44.asServiceRole.entities.AppNotification.create({
    user_id: order.user_id,
    title: "Order confirmed",
    message: `Your order #${String(order.id).slice(-8)} was paid successfully and is now processing.`,
    type: "purchase",
  });

  return { ...order, payment_status: "paid", fulfillment_status: "processing" };
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
