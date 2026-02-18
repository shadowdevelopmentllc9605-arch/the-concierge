import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Heart, Trash2, ShoppingBag, Eye, EyeOff, Share2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function Wishlist() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadWishlist();
  }, []);

  const loadWishlist = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      const wishlistItems = await base44.entities.WishlistItem.filter({ user_id: currentUser.id });
      setItems(wishlistItems);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (item) => {
    const removedItem = item;
    const itemIndex = items.findIndex(i => i.id === item.id);
    
    // Optimistic update
    setItems(prev => prev.filter(i => i.id !== item.id));
    
    try {
      await base44.entities.WishlistItem.delete(item.id);
    } catch (error) {
      // Revert on error
      setItems(prev => {
        const newItems = [...prev];
        newItems.splice(itemIndex, 0, removedItem);
        return newItems;
      });
      console.error(error);
    }
  };

  const toggleVisibility = async (item) => {
    try {
      await base44.entities.WishlistItem.update(item.id, { is_public: !item.is_public });
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, is_public: !i.is_public } : i
      ));
    } catch (error) {
      console.error(error);
    }
  };

  const addToCart = async (item) => {
    const removedItem = item;
    const itemIndex = items.findIndex(i => i.id === item.id);
    
    // Optimistic update - remove from wishlist immediately
    setItems(prev => prev.filter(i => i.id !== item.id));
    
    try {
      await base44.entities.CartItem.create({
        user_id: user.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_image: item.product_image,
        product_price: item.product_price,
        size: 'M',
        quantity: 1
      });
      await base44.entities.WishlistItem.delete(item.id);
    } catch (error) {
      // Revert on error
      setItems(prev => {
        const newItems = [...prev];
        newItems.splice(itemIndex, 0, removedItem);
        return newItems;
      });
      console.error(error);
    }
  };

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
    <div className="min-h-screen bg-[#fafafa] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#fafafa]/95 backdrop-blur-lg px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-[#1a1a1a]" />
            </button>
            <div>
              <h1 className="text-2xl font-light text-[#1a1a1a]">Wishlist</h1>
              <p className="text-sm text-[#64748b]">{items.length} items saved</p>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
            <Share2 className="w-5 h-5 text-[#1a1a1a]" />
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] px-6">
          <div className="w-20 h-20 rounded-full bg-[#f5f5f0] flex items-center justify-center mb-6">
            <Heart className="w-8 h-8 text-[#64748b]" />
          </div>
          <h2 className="text-xl font-medium text-[#1a1a1a] mb-2">Your wishlist is empty</h2>
          <p className="text-[#64748b] text-center mb-8">Save items you love for later</p>
          <Button
            onClick={() => navigate(createPageUrl('Shop'))}
            className="bg-[#1a1a1a] text-white rounded-xl h-12 px-8"
          >
            Start Shopping
          </Button>
        </div>
      ) : (
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <AnimatePresence>
              {items.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm"
                >
                  <button
                    onClick={() => navigate(createPageUrl(`ProductDetail?id=${item.product_id}`))}
                    className="w-full"
                  >
                    <div className="relative aspect-square bg-[#e5e5e5]">
                      {item.product_image ? (
                        <img 
                          src={item.product_image}
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#64748b]">
                          No image
                        </div>
                      )}
                      {/* Visibility Badge */}
                      <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                        item.is_public 
                          ? 'bg-[#c9a962] text-[#1a1a1a]' 
                          : 'bg-white/80 text-[#64748b]'
                      }`}>
                        {item.is_public ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {item.is_public ? 'Public' : 'Private'}
                      </div>
                    </div>
                  </button>
                  
                  <div className="p-3">
                    <h3 className="font-medium text-[#1a1a1a] text-sm truncate">{item.product_name}</h3>
                    <p className="font-semibold text-[#1a1a1a] mt-1">${item.product_price?.toFixed(2)}</p>
                    
                    <div className="flex items-center justify-between mt-3">
                      <button
                        onClick={() => toggleVisibility(item)}
                        className="flex items-center gap-2"
                      >
                        <Switch 
                          checked={item.is_public}
                          className="scale-75"
                        />
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => addToCart(item)}
                          className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center"
                        >
                          <ShoppingBag className="w-4 h-4 text-white" />
                        </button>
                        <button
                          onClick={() => removeItem(item)}
                          className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}