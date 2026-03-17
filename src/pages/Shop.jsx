import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, X, Heart, ShoppingBag, ChevronDown, Store } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import PullToRefresh from '@/components/PullToRefresh';

export default function Shop() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    style: urlParams.get('style') || '',
    category: urlParams.get('category') || '',
    brand: urlParams.get('brand') || ''
  });
  const [wishlist, setWishlist] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState(null);

  const categories = {
    business: ['suits', 'vests', 'dress_shirts', 'pants', 'blouse', 'dress_skirts', 'collar_stays', 'cufflinks', 'tie_bar', 'tie_chain', 'tie_pin', 'pocket_square', 'lapel_pin'],
    casual: ['polos', 'tshirts', 'jackets', 'jeans', 'shorts', 'khakis', 'dresses', 'skirts', 'jumpers'],
    nightlife: ['pattern_shirts', 'graphic_tees', 'sports_jackets', 'evening_dresses'],
    accessories: ['hats', 'glasses', 'earrings', 'necklaces', 'bracelets', 'watches', 'belts', 'socks', 'shoes']
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleRefresh = useCallback(async () => {
    await loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Load products
      let query = {};
      if (filters.style) query.style_type = filters.style;
      if (filters.category) query.category = filters.category;
      
      const allProducts = filters.style || filters.category 
        ? await base44.entities.Product.filter(query)
        : await base44.entities.Product.list('-created_date', 50);
      setProducts(allProducts);

      // Load wishlist
      const wishlistItems = await base44.entities.WishlistItem.filter({ user_id: currentUser.id });
      setWishlist(wishlistItems.map(w => w.product_id));

      // Load cart count
      const cartItems = await base44.entities.CartItem.filter({ user_id: currentUser.id });
      setCartCount(cartItems.length);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWishlist = async (product, e) => {
    e.stopPropagation();
    const wasWishlisted = wishlist.includes(product.id);
    
    // Optimistic update
    if (wasWishlisted) {
      setWishlist(prev => prev.filter(id => id !== product.id));
    } else {
      setWishlist(prev => [...prev, product.id]);
    }
    
    try {
      if (wasWishlisted) {
        const items = await base44.entities.WishlistItem.filter({ 
          user_id: user.id, 
          product_id: product.id 
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
      if (wasWishlisted) {
        setWishlist(prev => [...prev, product.id]);
      } else {
        setWishlist(prev => prev.filter(id => id !== product.id));
      }
      console.error(error);
    }
  };

  const filteredProducts = products.filter(p => 
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen bg-[var(--color-background)] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--color-background)]/95 backdrop-blur-lg">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-light text-[var(--color-text-primary)]">Shop</h1>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate(createPageUrl('Wishlist'))}
                className="relative select-none"
              >
                <Heart className="w-6 h-6 text-[var(--color-text-primary)]" />
                {wishlist.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--color-accent)] text-[var(--color-text-primary)] text-[10px] rounded-full flex items-center justify-center font-medium">
                    {wishlist.length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => navigate(createPageUrl('Cart'))}
                className="relative select-none"
              >
                <ShoppingBag className="w-6 h-6 text-[var(--color-text-primary)]" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--color-accent)] text-[var(--color-text-primary)] text-[10px] rounded-full flex items-center justify-center font-medium">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, brands..."
              className="h-12 pl-12 pr-4 rounded-xl bg-[var(--color-surface)] border-0 shadow-sm text-[var(--color-text-primary)]"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-9 rounded-full px-4 border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 select-none">
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl bg-[var(--color-surface)]">
                <SheetHeader>
                  <SheetTitle className="text-[var(--color-text-primary)]">Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  {/* Style Filter */}
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Style</p>
                    <div className="flex flex-wrap gap-2">
                      {['business', 'casual', 'nightlife', 'trendy'].map(style => (
                        <button
                          key={style}
                          onClick={() => setFilters(prev => ({ ...prev, style: prev.style === style ? '' : style }))}
                          className={`px-4 py-2 rounded-full text-sm capitalize transition-colors select-none ${
                            filters.style === style
                              ? 'bg-[var(--color-text-primary)] text-[var(--color-background)]'
                              : 'bg-[var(--color-background-secondary)] text-[var(--color-text-primary)]'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Category</p>
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                      {Object.values(categories).flat().map(cat => (
                        <button
                          key={cat}
                          onClick={() => setFilters(prev => ({ ...prev, category: prev.category === cat ? '' : cat }))}
                          className={`px-4 py-2 rounded-full text-sm capitalize transition-colors select-none ${
                            filters.category === cat
                              ? 'bg-[var(--color-text-primary)] text-[var(--color-background)]'
                              : 'bg-[var(--color-background-secondary)] text-[var(--color-text-primary)]'
                          }`}
                        >
                          {cat.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {filters.style && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, style: '' }))}
                className="h-9 rounded-full px-4 bg-[var(--color-text-primary)] text-[var(--color-background)] text-sm flex items-center gap-2 shrink-0 select-none"
              >
                {filters.style}
                <X className="w-3 h-3" />
              </button>
            )}
            {filters.category && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, category: '' }))}
                className="h-9 rounded-full px-4 bg-[var(--color-text-primary)] text-[var(--color-background)] text-sm flex items-center gap-2 shrink-0 select-none"
              >
                {filters.category.replace(/_/g, ' ')}
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="px-6 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-[var(--color-placeholder)] animate-pulse" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[var(--color-text-secondary)]">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <AnimatePresence>
              {filteredProducts.map((product, idx) => (
                <motion.button
                  key={product.id}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => navigate(createPageUrl(`ProductDetail?id=${product.id}`))}
                  className="text-left group select-none"
                >
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-[var(--color-placeholder)] mb-3">
                    {product.images?.[0] ? (
                      <img 
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--color-text-secondary)]">
                        No image
                      </div>
                    )}
                    <button
                      onClick={(e) => toggleWishlist(product, e)}
                      className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-colors select-none ${
                        wishlist.includes(product.id)
                          ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)]'
                          : 'bg-[var(--color-surface)]/80 backdrop-blur text-[var(--color-text-primary)]'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${wishlist.includes(product.id) ? 'fill-current' : ''}`} />
                    </button>
                    {product.is_new && (
                      <span className="absolute top-3 left-3 px-3 py-1 bg-[var(--color-text-primary)] text-[var(--color-background)] text-xs rounded-full">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{product.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-1">{product.brand}</p>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">${product.price?.toFixed(2)}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Fit: 92%</span>
                  </div>
                  <p className="text-xs text-[var(--color-accent)] font-medium">Rec. Size: M · True to fit</p>
                  {product.vendor_id && (
                    <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 mt-1">
                      <Store className="w-3 h-3" /> Available in-store
                    </p>
                  )}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}