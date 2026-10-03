import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function Cart() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const currentUser = await base44.auth.me();
      const cartItems = await base44.entities.CartItem.filter({ user_id: currentUser.id });
      setItems(cartItems);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (item, delta) => {
    const newQuantity = (item.quantity || 1) + delta;
    if (newQuantity < 1) {
      await removeItem(item);
      return;
    }

    try {
      await base44.entities.CartItem.update(item.id, { quantity: newQuantity });
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, quantity: newQuantity } : i
      ));
    } catch (error) {
      console.error(error);
    }
  };

  const removeItem = async (item) => {
    try {
      await base44.entities.CartItem.delete(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (error) {
      console.error(error);
    }
  };

  const subtotal = items.reduce((sum, item) => 
    sum + (item.product_price || 0) * (item.quantity || 1), 0
  );
  const shipping = subtotal > 100 ? 0 : 9.99;
  const total = subtotal + shipping;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-[#1a1a1a] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] pb-48">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#fafafa]/95 backdrop-blur-lg px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-[#1a1a1a]" />
          </button>
          <h1 className="text-2xl font-light text-[#1a1a1a]">Cart</h1>
          <span className="text-[#64748b] text-sm">({items.length} items)</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] px-6">
          <div className="w-20 h-20 rounded-full bg-[#f5f5f0] flex items-center justify-center mb-6">
            <ShoppingBag className="w-8 h-8 text-[#64748b]" />
          </div>
          <h2 className="text-xl font-medium text-[#1a1a1a] mb-2">Your cart is empty</h2>
          <p className="text-[#64748b] text-center mb-8">Start shopping to add items</p>
          <Button
            onClick={() => navigate(createPageUrl('Shop'))}
            className="bg-[#1a1a1a] text-white rounded-xl h-12 px-8"
          >
            Browse Shop
          </Button>
        </div>
      ) : (
        <div className="px-6 pt-4">
          <AnimatePresence>
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 20, opacity: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex gap-4 mb-4 bg-white rounded-2xl p-4 shadow-sm"
              >
                <div className="w-24 h-24 rounded-xl bg-[#e5e5e5] overflow-hidden shrink-0">
                  {item.product_image ? (
                    <img 
                      src={item.product_image}
                      alt={item.product_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#64748b] text-xs">
                      No image
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#1a1a1a] truncate">{item.product_name}</h3>
                  <p className="text-sm text-[#64748b] mt-1">
                    Size: {item.size} {item.color && `• ${item.color}`}
                  </p>
                  <p className="font-semibold text-[#1a1a1a] mt-2">${item.product_price?.toFixed(2)}</p>
                  
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateQuantity(item, -1)}
                        className="w-8 h-8 rounded-full bg-[#f5f5f0] flex items-center justify-center"
                      >
                        <Minus className="w-4 h-4 text-[#1a1a1a]" />
                      </button>
                      <span className="font-medium text-[#1a1a1a] w-6 text-center">
                        {item.quantity || 1}
                      </span>
                      <button
                        onClick={() => updateQuantity(item, 1)}
                        className="w-8 h-8 rounded-full bg-[#f5f5f0] flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4 text-[#1a1a1a]" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item)}
                      className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Checkout Section */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-6">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-[#64748b]">Subtotal</span>
              <span className="text-[#1a1a1a]">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#64748b]">Estimated shipping</span>
              <span className="text-[#1a1a1a]">
                {shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#64748b]">Tax</span>
              <span className="text-[#64748b]">Calculated at secure checkout</span>
            </div>
            <div className="flex justify-between text-lg font-semibold pt-2 border-t">
              <span className="text-[#1a1a1a]">Estimated total before tax</span>
              <span className="text-[#1a1a1a]">${total.toFixed(2)}</span>
            </div>
          </div>
          <Button
            onClick={() => navigate(createPageUrl('Checkout'))}
            className="w-full h-14 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white rounded-xl font-medium text-base"
          >
            Proceed to Checkout
          </Button>
        </div>
      )}
    </div>
  );
}