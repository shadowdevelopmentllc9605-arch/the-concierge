import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, ShoppingBag, Sparkles, Check, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function ProductDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [user, setUser] = useState(null);
  const [suggestedSize, setSuggestedSize] = useState('');

  useEffect(() => {
    loadData();
  }, [productId]);

  const loadData = async () => {
    if (!productId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const products = await base44.entities.Product.filter({ id: productId });
      if (products.length > 0) {
        setProduct(products[0]);
        if (products[0].colors?.length > 0) {
          setSelectedColor(products[0].colors[0]);
        }
      }

      // Get user profile for suggested size
      const profiles = await base44.entities.UserProfile.filter({ user_id: currentUser.id });
      if (profiles.length > 0 && profiles[0].suggested_sizes) {
        const category = products[0]?.category;
        if (['suits', 'vests', 'dress_shirts', 'blouse', 'tshirts', 'polos', 'jackets', 'pattern_shirts', 'graphic_tees'].includes(category)) {
          setSuggestedSize(profiles[0].suggested_sizes.tops);
        } else if (['pants', 'jeans', 'shorts', 'khakis'].includes(category)) {
          setSuggestedSize(profiles[0].suggested_sizes.bottoms);
        } else if (['dresses', 'dress_skirts', 'skirts', 'evening_dresses'].includes(category)) {
          setSuggestedSize(profiles[0].suggested_sizes.dresses);
        }
      }

      // Check wishlist
      const wishlistItems = await base44.entities.WishlistItem.filter({
        user_id: currentUser.id,
        product_id: productId
      });
      setIsWishlisted(wishlistItems.length > 0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWishlist = async () => {
    const wasWishlisted = isWishlisted;
    
    // Optimistic update
    setIsWishlisted(!wasWishlisted);
    
    try {
      if (wasWishlisted) {
        const items = await base44.entities.WishlistItem.filter({
          user_id: user.id,
          product_id: productId
        });
        if (items.length > 0) {
          await base44.entities.WishlistItem.delete(items[0].id);
        }
      } else {
        await base44.entities.WishlistItem.create({
          user_id: user.id,
          product_id: product.id,
          product_name: product.name,
          product_image: product.images?.[0],
          product_price: product.price,
          vendor_id: product.vendor_id,
          is_public: false
        });
      }
    } catch (error) {
      // Revert on error
      setIsWishlisted(wasWishlisted);
      console.error(error);
    }
  };

  const addToCart = async () => {
    const requiresSize = (product?.sizes?.length || 0) > 0;
    if (requiresSize && !selectedSize) return;

    setAddingToCart(true);
    try {
      const existingItems = await base44.entities.CartItem.filter({
        user_id: user.id,
        product_id: product.id
      });
      const matchingItem = existingItems.find(item =>
        (item.size || '') === (selectedSize || '') &&
        (item.color || '') === (selectedColor || '')
      );

      if (matchingItem) {
        await base44.entities.CartItem.update(matchingItem.id, {
          quantity: (matchingItem.quantity || 1) + 1
        });
      } else {
        await base44.entities.CartItem.create({
          user_id: user.id,
          product_id: product.id,
          product_name: product.name,
          product_image: product.images?.[0],
          product_price: product.price,
          size: selectedSize || '',
          color: selectedColor || '',
          quantity: 1
        });
      }

      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch (error) {
      console.error(error);
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-[var(--color-text-primary)] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <p className="text-[var(--color-text-secondary)]">Product not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-32">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 px-4 py-4 flex items-center justify-between safe-area-top">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="w-10 h-10 rounded-full bg-[var(--color-surface)] shadow-lg flex items-center justify-center select-none"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--color-text-primary)]" />
        </button>
        <button
          onClick={toggleWishlist}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-colors select-none ${
            isWishlisted ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface)]'
          }`}
        >
          <Heart className={`w-5 h-5 ${isWishlisted ? 'text-[var(--color-text-primary)] fill-current' : 'text-[var(--color-text-primary)]'}`} />
        </button>
      </div>

      {/* Product Image */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="aspect-square bg-[var(--color-placeholder)]"
      >
        {product.images?.[0] ? (
          <img 
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--color-text-secondary)]">
            No image
          </div>
        )}
      </motion.div>

      {/* Product Info */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="px-6 pt-6"
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-1">{product.brand}</p>
            <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">{product.name}</h1>
          </div>
          <p className="text-2xl font-semibold text-[var(--color-text-primary)]">${product.price?.toFixed(2)}</p>
        </div>

        {product.description && (
          <p className="text-[var(--color-text-secondary)] text-sm mt-4 leading-relaxed">{product.description}</p>
        )}

        {/* Try On Button */}
        <button
          onClick={() => navigate(createPageUrl(`TryOn?product=${product.id}`))}
          className="w-full mt-6 h-12 bg-[var(--color-background-secondary)] rounded-xl flex items-center justify-center gap-2 text-[var(--color-text-primary)] font-medium select-none"
        >
          <Sparkles className="w-5 h-5 text-[var(--color-accent)]" />
          Virtual Try-On
        </button>

        {/* Size Selection */}
        {product.sizes?.length > 0 && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Select Size</p>
              {suggestedSize && (
                <span className="text-xs text-[var(--color-accent)] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Recommended: {suggestedSize}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map(size => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`h-12 min-w-[48px] px-4 rounded-xl border-2 font-medium text-sm transition-colors select-none ${
                    selectedSize === size
                      ? 'border-[var(--color-text-primary)] bg-[var(--color-text-primary)] text-[var(--color-background)]'
                      : size === suggestedSize
                        ? 'border-[var(--color-accent)] text-[var(--color-text-primary)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-primary)]'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Color Selection */}
        {product.colors?.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Color</p>
            <div className="flex gap-3">
              {product.colors.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  aria-label={`Select color ${color}`}
                  title={color}
                  className={`w-10 h-10 rounded-full border-2 transition-all select-none ${
                    selectedColor === color ? 'border-[var(--color-text-primary)] scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color.toLowerCase() }}
                />
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)] to-transparent safe-area-bottom">
        <Button
          onClick={addToCart}
          disabled={((product.sizes?.length || 0) > 0 && !selectedSize) || addingToCart}
          className={`w-full h-14 rounded-xl font-medium text-base transition-colors select-none ${
            addedToCart
              ? 'bg-green-500 hover:bg-green-500'
              : 'bg-[var(--color-text-primary)] hover:bg-[var(--color-text-primary)]/90'
          }`}
        >
          {addingToCart ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : addedToCart ? (
            <>
              <Check className="w-5 h-5 mr-2" />
              Added to Cart
            </>
          ) : (
            <>
              <ShoppingBag className="w-5 h-5 mr-2" />
              Add to Cart
            </>
          )}
        </Button>
      </div>
    </div>
  );
}