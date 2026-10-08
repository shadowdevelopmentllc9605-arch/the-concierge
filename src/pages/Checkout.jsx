import { authClient } from '@/api/authClient';
import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { sharedBackendBridge } from '@/lib/sharedBackendBridge';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, CreditCard, ShieldCheck, ShoppingBag, Loader2, CheckCircle2, AlertTriangle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Checkout() {
  const navigate = useNavigate();
  const sessionId = new URLSearchParams(window.location.search).get('session_id');

  const [cart, setCart] = useState([]);
  const [savedCards, setSavedCards] = useState([]);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [saveAddress, setSaveAddress] = useState(false);
  const [error, setError] = useState('');

  const loadOrder = async (userId) => {
    if (!sessionId) return null;
    const rows = await base44.entities.Order.filter({
      user_id: userId,
      checkout_session_id: sessionId,
    });
    const found = rows[0] || null;
    setOrder(found);
    return found;
  };

  useEffect(() => {
    let cancelled = false;
    let poll;

    const load = async () => {
      try {
        const user = await authClient.me();
        if (sessionId) {
          const found = await loadOrder(user.id);
          if (!cancelled && found?.payment_status === 'pending') {
            poll = setInterval(async () => {
              const refreshed = await loadOrder(user.id);
              if (refreshed?.payment_status !== 'pending' && poll) clearInterval(poll);
            }, 2000);
          }
        } else {
          const [cartRows, cardRows, addressRows] = await Promise.all([
            base44.entities.CartItem.filter({ user_id: user.id }),
            base44.entities.PaymentMethod.filter({ user_id: user.id }),
            base44.entities.ShippingAddress.filter({ user_id: user.id }),
          ]);
          if (!cancelled) {
            setCart(cartRows);
            setSavedCards(cardRows);
            setSavedAddresses(addressRows);
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError?.message || 'Checkout could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
    };
  }, [sessionId]);

  const subtotal = useMemo(() =>
    cart.reduce((sum, item) => sum + Number(item.product_price || 0) * Number(item.quantity || 1), 0),
    [cart]
  );
  const estimatedShipping = subtotal > 100 ? 0 : 9.99;

  const startCheckout = async () => {
    setProcessing(true);
    setError('');
    try {
      const result = await sharedBackendBridge.startOnlineCheckout({
        saveCard,
        saveShippingAddress: saveAddress,
      });
      if (!result?.success || !result?.url) {
        throw new Error(result?.error || 'Secure checkout could not be started.');
      }
      window.location.assign(result.url);
    } catch (checkoutError) {
      setError(
        checkoutError?.response?.data?.error ||
        checkoutError?.message ||
        'Secure checkout could not be started.'
      );
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (sessionId) {
    const paid = order?.payment_status === 'paid';
    const failed = order && ['failed', 'refunded'].includes(order.payment_status);
    return (
      <div className="min-h-screen bg-[var(--color-background)] px-6 py-8">
        <div className="max-w-lg mx-auto">
          <div className="bg-[var(--color-surface)] rounded-3xl shadow-sm p-7 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${
              paid ? 'bg-emerald-100' : failed ? 'bg-red-100' : 'bg-amber-100'
            }`}>
              {paid ? <CheckCircle2 className="w-8 h-8 text-emerald-700" /> :
                failed ? <AlertTriangle className="w-8 h-8 text-red-700" /> :
                <Loader2 className="w-8 h-8 text-amber-700 animate-spin" />}
            </div>

            <h1 className="text-2xl font-semibold mb-3">
              {paid ? 'Payment confirmed' : failed ? 'Order not completed' : 'Confirming your payment'}
            </h1>
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              {paid
                ? 'Stripe confirmed the payment. Your purchase history and closet have been updated and the order is processing.'
                : failed
                  ? order?.payment_status === 'refunded'
                    ? 'This order has been refunded.'
                    : 'Stripe did not confirm this payment. Your card has not been marked paid in The Concierge.'
                  : 'The Concierge is waiting for Stripe’s signed webhook before marking this order paid. This usually takes only a moment.'}
            </p>

            {order && (
              <div className="mt-6 rounded-2xl bg-[var(--color-background-secondary)] p-4 text-left">
                <div className="flex justify-between text-sm"><span>Order</span><span>#{String(order.id).slice(-8)}</span></div>
                <div className="flex justify-between text-sm mt-2"><span>Status</span><span className="capitalize">{order.payment_status}</span></div>
                <div className="flex justify-between font-semibold mt-2"><span>Total</span><span>${Number(order.total || 0).toFixed(2)}</span></div>
              </div>
            )}

            <div className="mt-7 space-y-3">
              <Button className="w-full h-14" onClick={() => navigate(createPageUrl(paid ? 'Closet' : 'Home'))}>
                {paid ? 'View My Closet' : 'Back to Home'}
              </Button>
              {!paid && !failed && (
                <Button variant="outline" className="w-full h-14" onClick={() => window.location.reload()}>
                  Refresh Status
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] px-6 py-8 pb-24">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => navigate(createPageUrl('Cart'))}
          aria-label="Back to cart"
          className="w-10 h-10 rounded-full bg-[var(--color-surface)] shadow-sm flex items-center justify-center mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="bg-[var(--color-surface)] rounded-3xl shadow-sm p-7">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-5">
            <ShieldCheck className="w-7 h-7 text-emerald-700" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Secure checkout</h1>
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
            Payment and shipping information are collected on Stripe’s hosted checkout. The Concierge does not store your full card number.
          </p>

          {cart.length === 0 ? (
            <div className="mt-7 text-center">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-muted)]" />
              <p>Your cart is empty.</p>
              <Button className="mt-4" onClick={() => navigate(createPageUrl('Shop'))}>Return to Shop</Button>
            </div>
          ) : (
            <>
              <div className="mt-6 rounded-2xl bg-[var(--color-background-secondary)] p-4 space-y-2">
                <div className="flex justify-between text-sm"><span>Items</span><span>{cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0)}</span></div>
                <div className="flex justify-between text-sm"><span>Estimated subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span>Estimated shipping</span><span>{estimatedShipping === 0 ? 'Free' : `$${estimatedShipping.toFixed(2)}`}</span></div>
                <div className="flex justify-between text-xs text-[var(--color-text-secondary)] pt-2 border-t border-[var(--color-border-light)]">
                  <span>Tax</span><span>Calculated securely at Stripe checkout</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <label className="flex gap-3 items-start cursor-pointer">
                  <input type="checkbox" checked={saveCard} onChange={e => setSaveCard(e.target.checked)} className="mt-1" />
                  <div>
                    <p className="text-sm font-medium">Save this card for future checkout</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">Stripe stores the reusable payment credential; The Concierge keeps only display metadata such as brand and last four digits.</p>
                  </div>
                </label>
                <label className="flex gap-3 items-start cursor-pointer">
                  <input type="checkbox" checked={saveAddress} onChange={e => setSaveAddress(e.target.checked)} className="mt-1" />
                  <div>
                    <p className="text-sm font-medium">Save shipping address</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">The address collected by Stripe will be saved to your Concierge profile after payment succeeds.</p>
                  </div>
                </label>
              </div>

              {(savedCards.length > 0 || savedAddresses.length > 0) && (
                <button
                  className="mt-5 w-full rounded-xl border border-[var(--color-border)] p-3 text-left text-sm"
                  onClick={() => navigate(createPageUrl('PaymentMethods'))}
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    {savedCards.length} saved card{savedCards.length === 1 ? '' : 's'}
                    <span>•</span>
                    <MapPin className="w-4 h-4" />
                    {savedAddresses.length} saved address{savedAddresses.length === 1 ? '' : 'es'}
                  </div>
                </button>
              )}

              {error && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {error}
                </div>
              )}

              <Button
                onClick={startCheckout}
                disabled={processing}
                className="w-full h-14 mt-7 bg-[var(--color-text-primary)] text-[var(--color-background)] rounded-xl"
              >
                {processing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CreditCard className="w-5 h-5 mr-2" />}
                Continue to Stripe
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
