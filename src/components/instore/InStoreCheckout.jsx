import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CreditCard, Check, Loader2, ShoppingBag, Store, Sparkles } from 'lucide-react';

export default function InStoreCheckout({ open, onClose, store, user, onComplete }) {
  const [cartItems, setCartItems] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (open) {
      loadCheckoutData();
    }
  }, [open]);

  const loadCheckoutData = async () => {
    setLoading(true);
    try {
      // Load cart items
      const items = await base44.entities.CartItem.filter({ user_id: user.id });
      setCartItems(items);

      // Load payment methods
      const payments = await base44.entities.PaymentMethod.filter({ user_id: user.id });
      setPaymentMethods(payments);
      if (payments.length > 0) {
        setSelectedPayment(payments.find(p => p.is_default) || payments[0]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const subtotal = cartItems.reduce((sum, item) => 
    sum + (item.product_price || 0) * (item.quantity || 1), 0
  );
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  const handleCheckout = async () => {
    setProcessing(true);
    try {
      // Create purchases for each item
      for (const item of cartItems) {
        await base44.entities.Purchase.create({
          user_id: user.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_image: item.product_image,
          product_price: item.product_price,
          size: item.size,
          color: item.color,
          vendor_id: store?.id,
          vendor_name: store?.business_name,
          purchase_type: 'in_store',
          status: 'completed'
        });

        // Remove from cart
        await base44.entities.CartItem.delete(item.id);

        // Remove from wishlist if exists
        const wishlistItems = await base44.entities.WishlistItem.filter({
          user_id: user.id,
          product_id: item.product_id
        });
        for (const wi of wishlistItems) {
          await base44.entities.WishlistItem.delete(wi.id);
        }
      }

      setCompleted(true);
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            In-Store Checkout
          </SheetTitle>
        </SheetHeader>

        {completed ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center justify-center h-[60vh]"
          >
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-medium text-[#1a1a1a] mb-2">Purchase Complete!</h2>
            <p className="text-[#64748b] text-center">
              Thank you for shopping at {store?.business_name}
            </p>
          </motion.div>
        ) : loading ? (
          <div className="flex items-center justify-center h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a]" />
          </div>
        ) : (
          <div className="space-y-6 overflow-y-auto max-h-[calc(85vh-180px)]">
            {/* Items */}
            <div>
              <h3 className="text-sm font-medium text-[#64748b] mb-3">Items ({cartItems.length})</h3>
              <div className="space-y-3">
                {cartItems.map(item => (
                  <div key={item.id} className="flex gap-3 bg-[#f5f5f0] rounded-xl p-3">
                    <div className="w-16 h-16 rounded-lg bg-white overflow-hidden">
                      {item.product_image ? (
                        <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-6 h-6 text-[#64748b]" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-[#1a1a1a] text-sm">{item.product_name}</h4>
                      <p className="text-xs text-[#64748b]">Size: {item.size} • Qty: {item.quantity || 1}</p>
                      <p className="font-semibold text-[#1a1a1a] mt-1">${item.product_price?.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment method */}
            <div>
              <h3 className="text-sm font-medium text-[#64748b] mb-3">Payment Method</h3>
              {paymentMethods.length === 0 ? (
                <div className="bg-[#f5f5f0] rounded-xl p-4 text-center">
                  <CreditCard className="w-8 h-8 text-[#64748b] mx-auto mb-2" />
                  <p className="text-sm text-[#64748b]">No saved payment methods</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {paymentMethods.map(pm => (
                    <button
                      key={pm.id}
                      onClick={() => setSelectedPayment(pm)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl transition-colors ${
                        selectedPayment?.id === pm.id 
                          ? 'bg-[#1a1a1a] text-white' 
                          : 'bg-[#f5f5f0] text-[#1a1a1a]'
                      }`}
                    >
                      <CreditCard className="w-5 h-5" />
                      <span className="flex-1 text-left">
                        {pm.card_type?.toUpperCase()} •••• {pm.card_last_four}
                      </span>
                      {selectedPayment?.id === pm.id && <Check className="w-5 h-5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-[#f5f5f0] rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#64748b]">Subtotal</span>
                <span className="text-[#1a1a1a]">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#64748b]">Tax</span>
                <span className="text-[#1a1a1a]">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t border-white">
                <span className="text-[#1a1a1a]">Total</span>
                <span className="text-[#1a1a1a]">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* In-store benefit */}
            <div className="flex items-center gap-3 bg-[#c9a962]/10 rounded-xl p-4">
              <Sparkles className="w-5 h-5 text-[#c9a962]" />
              <p className="text-sm text-[#1a1a1a]">
                Items will be bagged and ready for you at the counter
              </p>
            </div>
          </div>
        )}

        {!completed && !loading && (
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t">
            <Button
              onClick={handleCheckout}
              disabled={processing || cartItems.length === 0}
              className="w-full h-14 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white rounded-xl font-medium text-base"
            >
              {processing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Pay ${total.toFixed(2)}</>
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}