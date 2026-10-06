import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, ShoppingBag, Store } from 'lucide-react';

export default function InStoreCheckout({ open, onClose, store, user }) {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) loadCheckoutData();
  }, [open, store?.id, user?.id]);

  const loadCheckoutData = async () => {
    if (!user?.id || !store?.id) {
      setCartItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [items, products] = await Promise.all([
        base44.entities.CartItem.filter({ user_id: user.id }),
        base44.entities.Product.list('-created_date', 100)
      ]);

      const vendorByProductId = new Map(products.map(product => [product.id, product.vendor_id]));
      setCartItems(items.filter(item => vendorByProductId.get(item.product_id) === store.id));
    } catch (error) {
      console.error(error);
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  const subtotal = cartItems.reduce(
    (sum, item) => sum + (item.product_price || 0) * (item.quantity || 1),
    0
  );

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            In-Store Checkout
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a]" />
          </div>
        ) : (
          <div className="space-y-6 overflow-y-auto max-h-[calc(85vh-180px)]">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">In-app payment is not connected yet</p>
                <p className="text-sm text-amber-800 mt-1">
                  The Concierge will not mark a purchase complete or create purchase records until a real payment processor confirms the charge. Please complete payment at the store counter.
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-[#64748b] mb-3">
                Items from {store?.business_name || 'this store'} ({cartItems.length})
              </h3>
              <div className="space-y-3">
                {cartItems.length === 0 ? (
                  <div className="bg-[#f5f5f0] rounded-xl p-6 text-center">
                    <ShoppingBag className="w-8 h-8 text-[#64748b] mx-auto mb-2" />
                    <p className="text-sm text-[#64748b]">No items from this store are in your cart.</p>
                  </div>
                ) : (
                  cartItems.map(item => (
                    <div key={item.id} className="flex gap-3 bg-[#f5f5f0] rounded-xl p-3">
                      <div className="w-16 h-16 rounded-lg bg-white overflow-hidden">
                        {item.product_image ? (
                          <img src={item.product_image} alt={item.product_name || ''} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-6 h-6 text-[#64748b]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-[#1a1a1a] text-sm">{item.product_name}</h4>
                        <p className="text-xs text-[#64748b]">
                          {item.size ? 'Size: ' + item.size : ''}{item.width_code ? ' • Width ' + item.width_code : ''}{(item.size || item.width_code) ? ' • ' : ''}Qty: {item.quantity || 1}
                        </p>
                        <p className="font-semibold text-[#1a1a1a] mt-1">{'$'}{(item.product_price || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-[#f5f5f0] rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#64748b]">Merchandise subtotal</span>
                <span className="text-[#1a1a1a]">{'$'}{subtotal.toFixed(2)}</span>
              </div>
              <p className="text-xs text-[#64748b]">
                Final tax and total are calculated by the store's payment system.
              </p>
            </div>
          </div>
        )}

        {!loading && (
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t">
            <Button
              onClick={onClose}
              className="w-full h-14 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white rounded-xl font-medium text-base"
            >
              Close and Pay at Counter
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}