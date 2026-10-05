import { createClientFromRequest } from "npm:@base44/sdk";
import Stripe from "npm:stripe@23.0.0";
import { secrets } from "base44:runtime";

function safeOrigin(req: Request) {
  const value = req.headers.get("origin") || "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function getVariant(product: any, size?: string, color?: string) {
  if (!Array.isArray(product.variants) || product.variants.length === 0) return null;
  return product.variants.find((variant: any) =>
    String(variant.size || "") === String(size || "") &&
    String(variant.color || "") === String(color || "")
  ) || null;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const stripeSecret = secrets.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      return Response.json({
        error: "Online card payments are not configured yet. No charge was attempted.",
        code: "payments_not_configured",
      }, { status: 409 });
    }

    const origin = safeOrigin(req);
    if (!origin) {
      return Response.json({ error: "A valid app origin is required." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const saveCard = Boolean(body?.saveCard);
    const saveShippingAddress = Boolean(body?.saveShippingAddress);

    const cart = await base44.asServiceRole.entities.CartItem.filter({ user_id: user.id });
    if (!cart.length) return Response.json({ error: "Your cart is empty." }, { status: 400 });

    const orderItems: any[] = [];
    const lineItems: any[] = [];
    let subtotalCents = 0;
    let checkoutVendor: any = null;

    for (const cartItem of cart) {
      const products = await base44.asServiceRole.entities.Product.filter({ id: cartItem.product_id });
      const product = products[0];
      if (!product || product.in_stock === false) {
        return Response.json({ error: `${cartItem.product_name || "An item"} is no longer available.` }, { status: 409 });
      }

      const quantity = Math.max(1, Math.floor(Number(cartItem.quantity || 1)));
      const variant = getVariant(product, cartItem.size, cartItem.color);

      if (Array.isArray(product.variants) && product.variants.length > 0) {
        if (!variant) {
          return Response.json({ error: `Choose a valid size/color for ${product.name}.` }, { status: 409 });
        }
        if (quantity > Number(variant.stock_quantity || 0)) {
          return Response.json({ error: `Not enough stock remains for ${product.name} in that size/color.` }, { status: 409 });
        }
      } else if (product.linked_pro_inventory_id && quantity > Number(product.stock_quantity || 0)) {
        return Response.json({ error: `Not enough stock remains for ${product.name}.` }, { status: 409 });
      }

      const unitAmount = Math.max(0, Math.round(Number(product.price || 0) * 100));
      if (!unitAmount) {
        return Response.json({ error: `${product.name} does not have a valid checkout price.` }, { status: 409 });
      }
      subtotalCents += unitAmount * quantity;

      let vendor: any = null;
      if (product.vendor_id) {
        const vendors = await base44.asServiceRole.entities.Vendor.filter({ id: product.vendor_id });
        vendor = vendors[0] || null;
      }

      const retailerSubscriptionActive = ["active", "trialing"].includes(String(vendor?.stripe_subscription_status || ""));
      const retailerCanReceiveFunds = Boolean(vendor?.stripe_transfers_enabled || vendor?.stripe_payouts_enabled);
      if (
        !vendor?.stripe_connected_account_id ||
        !vendor?.stripe_onboarding_complete ||
        !retailerCanReceiveFunds ||
        !retailerSubscriptionActive
      ) {
        return Response.json({
          error: `${vendor?.business_name || product.name} is not ready for Concierge marketplace checkout yet.`,
          code: "vendor_payments_not_ready",
        }, { status: 409 });
      }

      if (!checkoutVendor) checkoutVendor = vendor;
      if (checkoutVendor.id !== vendor.id) {
        return Response.json({
          error: "For launch, each Stripe checkout can contain items from only one retailer. Please check out each retailer separately.",
          code: "multi_vendor_checkout_not_supported",
        }, { status: 409 });
      }

      orderItems.push({
        cart_item_id: cartItem.id,
        product_id: product.id,
        product_name: product.name,
        product_image: product.images?.[0] || "",
        unit_price: unitAmount / 100,
        quantity,
        size: cartItem.size || "",
        color: cartItem.color || "",
        vendor_id: product.vendor_id || "",
        vendor_name: vendor?.business_name || "",
        pro_business_id: vendor?.linked_pro_business_id || "",
      });

      lineItems.push({
        quantity,
        price_data: {
          currency: "usd",
          unit_amount: unitAmount,
          product_data: {
            name: product.name,
            tax_code: "txcd_99999999", // Stripe Tax: General - Tangible Goods fallback for launch inventory.
            description: [product.brand, cartItem.size, cartItem.color].filter(Boolean).join(" · "),
            images: product.images?.[0] ? [product.images[0]] : undefined,
            metadata: {
              product_id: product.id,
              size: cartItem.size || "",
              color: cartItem.color || "",
            },
          },
        },
      });
    }

    const stripe = new Stripe(stripeSecret);
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.id });
    const profile = profiles[0] || null;
    let stripeCustomerId = profile?.stripe_customer_id || "";

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: user.full_name || undefined,
        metadata: { base44_user_id: user.id },
      });
      stripeCustomerId = customer.id;
      if (profile?.id) {
        await base44.asServiceRole.entities.UserProfile.update(profile.id, {
          stripe_customer_id: stripeCustomerId,
        });
      }
    }

    if (!checkoutVendor?.stripe_connected_account_id) {
      return Response.json({ error: "The retailer is not connected to Stripe." }, { status: 409 });
    }

    const shippingCents = subtotalCents > 10000 ? 0 : 999;
    const feeBpsRaw = Number(secrets.get("CONCIERGE_PLATFORM_FEE_BPS") || "400");
    const feeBps = Math.max(0, Math.min(10000, Number.isFinite(feeBpsRaw) ? feeBpsRaw : 400));
    const applicationFeeCents = Math.round(subtotalCents * feeBps / 10000);
    const order = await base44.asServiceRole.entities.Order.create({
      user_id: user.id,
      items: orderItems,
      subtotal: subtotalCents / 100,
      shipping: shippingCents / 100,
      tax: 0,
      total: (subtotalCents + shippingCents) / 100,
      concierge_attributed: true,
      attribution_source: "concierge_online",
      platform_fee_percent: feeBps / 100,
      platform_fee_amount: applicationFeeCents / 100,
      platform_fee_status: "pending",
      currency: "usd",
      payment_status: "pending",
      fulfillment_status: "pending_payment",
      payment_provider: "stripe",
      save_card: saveCard,
      save_shipping_address: saveShippingAddress,
    });

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: stripeCustomerId,
        line_items: lineItems,
        automatic_tax: { enabled: true },
        shipping_address_collection: { allowed_countries: ["US"] },
        shipping_options: [{
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: shippingCents, currency: "usd" },
            display_name: shippingCents === 0 ? "Free shipping" : "Standard shipping",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 3 },
              maximum: { unit: "business_day", value: 7 },
            },
          },
        }],
        customer_update: {
          address: "auto",
          name: "auto",
          shipping: "auto",
        },
        payment_intent_data: {
          ...(saveCard ? { setup_future_usage: "off_session" as const } : {}),
          application_fee_amount: applicationFeeCents,
          transfer_data: {
            destination: checkoutVendor.stripe_connected_account_id,
          },
          metadata: {
            concierge_order_id: order.id,
            base44_user_id: user.id,
            concierge_vendor_id: checkoutVendor.id,
            concierge_pro_business_id: checkoutVendor.linked_pro_business_id || "",
            concierge_attribution_source: "concierge_online",
            concierge_platform_fee_percent: String(feeBps / 100),
            concierge_platform_fee_amount_cents: String(applicationFeeCents),
          },
        },
        metadata: {
          concierge_order_id: order.id,
          base44_user_id: user.id,
          save_card: String(saveCard),
          save_shipping_address: String(saveShippingAddress),
          concierge_attribution_source: "concierge_online",
          concierge_platform_fee_percent: String(feeBps / 100),
          concierge_platform_fee_amount_cents: String(applicationFeeCents),
        },
        success_url: `${origin}/Checkout?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/Cart`,
      });

      await base44.asServiceRole.entities.Order.update(order.id, {
        checkout_session_id: session.id,
      });

      return Response.json({
        success: true,
        orderId: order.id,
        checkoutSessionId: session.id,
        url: session.url,
        platformFeePercent: feeBps / 100,
        platformFeeAmount: applicationFeeCents / 100,
        attributionSource: "concierge_online",
      });
    } catch (stripeError) {
      await base44.asServiceRole.entities.Order.update(order.id, {
        payment_status: "failed",
        fulfillment_status: "cancelled",
      });
      throw stripeError;
    }
  } catch (error) {
    console.error("createStripeCheckout", error);
    return Response.json({
      error: error instanceof Error ? error.message : "Checkout could not be started.",
    }, { status: 500 });
  }
}
