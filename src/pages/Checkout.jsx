import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, CreditCard, ShieldCheck, ShoppingBag } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function Checkout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--color-background)] px-6 py-8">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => navigate(createPageUrl('Cart'))}
          aria-label="Back to cart"
          className="w-10 h-10 rounded-full bg-[var(--color-surface)] shadow-sm flex items-center justify-center mb-8"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--color-text-primary)]" />
        </button>

        <div className="bg-[var(--color-surface)] rounded-3xl shadow-sm p-7">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mb-5">
            <ShieldCheck className="w-7 h-7 text-amber-700" />
          </div>

          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-3">
            Secure checkout is being connected
          </h1>
          <p className="text-[var(--color-text-secondary)] leading-relaxed">
            Your cart is safe, but The Concierge does not have a production payment processor connected yet. We will not collect card details or mark an order paid until a real payment provider confirms the transaction.
          </p>

          <div className="mt-6 rounded-2xl bg-[var(--color-background-secondary)] p-4 flex gap-3">
            <CreditCard className="w-5 h-5 text-[var(--color-text-secondary)] shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--color-text-secondary)]">
              No charge has been attempted. Payment, tax calculation, receipts, refunds, and order status still need the production checkout integration.
            </p>
          </div>

          <div className="mt-7 space-y-3">
            <Button
              onClick={() => navigate(createPageUrl('Cart'))}
              className="w-full h-14 bg-[var(--color-text-primary)] text-[var(--color-background)] rounded-xl"
            >
              <ShoppingBag className="w-5 h-5 mr-2" />
              Return to Cart
            </Button>
            <Button
              onClick={() => navigate(createPageUrl('Shop'))}
              variant="outline"
              className="w-full h-14 rounded-xl"
            >
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
