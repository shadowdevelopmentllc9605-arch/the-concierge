import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, X, Heart, ShoppingBag, Store, Sparkles, Mic, MicOff } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import PullToRefresh from '@/components/PullToRefresh';
import { getCategoryGroup, getEffectiveSizeChart, getFitRecommendationPresentation, recommendFromSizeChart } from '@/lib/fitRecommendation';

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
  const [profile, setProfile] = useState(null);
  const [brandCharts, setBrandCharts] = useState([]);
  const [brandCatalog, setBrandCatalog] = useState([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const specialFilter = urlParams.get('filter') || '';

  const categories = {
    business: ['suits', 'vests', 'dress_shirts', 'pants', 'blouse', 'dress_skirts', 'sports_jackets', 'collar_stays', 'cufflinks', 'tie_bar', 'tie_chain', 'tie_pin', 'pocket_square', 'lapel_pin'],
    casual: ['polos', 'tshirts', 'jackets', 'jeans', 'shorts', 'khakis', 'dresses', 'skirts', 'jumpers', 'swimwear'],
    formal: ['suits', 'vests', 'dress_shirts', 'dresses', 'evening_dresses', 'sports_jackets'],
    evening: ['evening_dresses', 'dresses', 'suits', 'sports_jackets', 'pattern_shirts'],
    outdoor: ['coats', 'parkas', 'outerwear', 'jackets', 'boots', 'hats', 'swimwear'],
    active: ['tshirts', 'shorts', 'pants', 'jackets', 'shoes', 'boots', 'hats'],
    nightlife: ['pattern_shirts', 'graphic_tees', 'sports_jackets', 'evening_dresses'],
    accessories: ['hats', 'glasses', 'earrings', 'necklaces', 'bracelets', 'watches', 'belts', 'socks', 'shoes', 'boots']
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
      if (filters.brand) query.brand = filters.brand;
      if (specialFilter === 'new') query.is_new = true;

      const hasQuery = filters.style || filters.category || filters.brand || specialFilter === 'new';
      const allProducts = hasQuery
        ? await base44.entities.Product.filter(query)
        : await base44.entities.Product.list('-created_date', 50);
      setProducts(allProducts);

      const profiles = await base44.entities.UserProfile.filter({ user_id: currentUser.id });
      setProfile(profiles[0] || null);

      const sizeCharts = await base44.entities.BrandSizeChart.filter({ active: true });
      setBrandCharts(sizeCharts);

      const brands = [];
      let brandCursor = null;
      do {
        const page = await base44.entities.BrandCatalog.list({ limit: 500, cursor: brandCursor });
        brands.push(...(page?.items || []));
        brandCursor = page?.next_cursor || null;
      } while (brandCursor);
      const mergedBrands = new Map();
      for (const brand of brands.filter(item => item.active !== false)) {
        const key = brand.brand_key || brand.brand_name?.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!key) continue;
        const current = mergedBrands.get(key);
        if (!current) {
          mergedBrands.set(key, brand);
          continue;
        }
        const retailerByKey = new Map(
          [...(current.retailer_presence || []), ...(brand.retailer_presence || [])]
            .map(presence => [presence.retailer_key || presence.retailer_name, presence])
        );
        mergedBrands.set(key, {
          ...current,
          ...brand,
          brand_name: current.brand_name || brand.brand_name,
          aliases: [...new Set([...(current.aliases || []), ...(brand.aliases || [])])],
          retailer_presence: [...retailerByKey.values()],
          source_urls: [...new Set([...(current.source_urls || []), ...(brand.source_urls || [])])],
          verified_categories: [...new Set([...(current.verified_categories || []), ...(brand.verified_categories || [])])],
          verified_chart_count: Math.max(current.verified_chart_count || 0, brand.verified_chart_count || 0),
          sizing_status:
            current.sizing_status === 'verified_loaded' || brand.sizing_status === 'verified_loaded'
              ? 'verified_loaded'
              : current.sizing_status === 'partial' || brand.sizing_status === 'partial'
                ? 'partial'
                : 'estimate_only'
        });
      }
      setBrandCatalog([...mergedBrands.values()].sort((a, b) => a.brand_name.localeCompare(b.brand_name)));

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

  const startVoiceSearch = () => {
    const voiceWindow = /** @type {any} */ (window);
    const Recognition = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError('Voice search is not supported by this browser. You can still type your search.');
      return;
    }

    setVoiceError('');
    const recognition = new Recognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setVoiceError('I could not hear that clearly. Try again or type your search.');
    };
    recognition.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript?.trim() || '';
      if (spoken) setSearch(spoken);
    };
    recognition.start();
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
    p.discontinued !== true && (
      !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const getProductRecommendation = (product) => {
    if (!profile) return null;

    const effectiveChart = getEffectiveSizeChart(product, profile, brandCharts);
    const chartMatch = recommendFromSizeChart(
      effectiveChart.entries,
      profile.measurement_values_cm || {},
      {
        shoeSize: profile.measurements?.shoe_size,
        shoeWidth: profile.measurements?.shoe_width,
        braSize: profile.measurements?.bra_size,
        gender: profile.gender,
        category: product.category,
        categoryGroup: getCategoryGroup(product.category),
        measurementConfidence: profile.measurement_confidence,
        measurementConfidenceByField: profile.measurement_confidence_by_field || {},
        validationStatus: profile.measurement_validation_status || 'estimated',
        sizeAdjustmentSteps: product.footwear_fit?.size_adjustment_steps ?? effectiveChart.chart?.size_adjustment_steps ?? 0
      }
    );
    if (chartMatch?.size && !chartMatch.blocked) {
      const presentation = getFitRecommendationPresentation(effectiveChart.source, chartMatch.matchType);
      return {
        size: chartMatch.size,
        width: chartMatch.width || '',
        label: presentation.label,
        detail: presentation.detail,
        verified: presentation.verified,
        source: effectiveChart.source,
        fitConfidence: chartMatch.fitConfidence,
        confidenceScore: chartMatch.confidenceScore,
        missingMeasurements: chartMatch.missingMeasurements || []
      };
    }

    if (chartMatch?.blocked) {
      return {
        size: '',
        width: '',
        label: 'More measurements needed',
        fitConfidence: 'low',
        confidenceScore: chartMatch.confidenceScore,
        missingMeasurements: chartMatch.missingMeasurements || []
      };
    }

    const group = getCategoryGroup(product.category);
    let size = group ? profile.suggested_sizes?.[group] : '';
    if (product.category === 'suits' && profile.suggested_sizes?.suits) {
      const suitBase = profile.suggested_sizes.suits;
      size = product.sizes?.find(value => String(value).startsWith(String(suitBase))) || suitBase;
    }

    if (size && (!product.sizes?.length || product.sizes.includes(size))) {
      const presentation = getFitRecommendationPresentation('profile_estimate');
      return {
        size,
        width: '',
        label: presentation.label,
        detail: presentation.detail,
        verified: presentation.verified,
        source: 'profile_estimate'
      };
    }
    return null;
  };

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
              className="h-12 pl-12 pr-14 rounded-xl bg-[var(--color-surface)] border-0 shadow-sm text-[var(--color-text-primary)]"
            />
            <button
              type="button"
              onClick={startVoiceSearch}
              aria-label={listening ? 'Listening for voice search' : 'Start voice search'}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center"
            >
              {listening ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4 text-[var(--color-text-primary)]" />}
            </button>
          </div>

          {voiceError && <p className="text-xs text-amber-700 mb-2">{voiceError}</p>}

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
                      {['business', 'casual', 'formal', 'evening', 'outdoor', 'active', 'nightlife', 'trendy'].map(style => (
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
                      {[...new Set(Object.values(categories).flat())].map(cat => (
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

                  {/* Brand Filter */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">Brand</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{brandCatalog.length} brands</p>
                    </div>
                    <Input
                      value={brandSearch}
                      onChange={(e) => setBrandSearch(e.target.value)}
                      placeholder="Search all department-store brands"
                      className="h-10 mb-3 rounded-xl bg-[var(--color-background-secondary)] border-0 text-[var(--color-text-primary)]"
                    />
                    <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto pr-1">
                      {brandCatalog
                        .filter(brand => !brandSearch || brand.brand_name?.toLowerCase().includes(brandSearch.toLowerCase()))
                        .map(brand => (
                          <button
                            key={brand.id || brand.brand_key}
                            onClick={() => setFilters(prev => ({ ...prev, brand: prev.brand === brand.brand_name ? '' : brand.brand_name }))}
                            className={`px-3 py-2 rounded-full text-xs transition-colors select-none ${
                              filters.brand === brand.brand_name
                                ? 'bg-[var(--color-text-primary)] text-[var(--color-background)]'
                                : 'bg-[var(--color-background-secondary)] text-[var(--color-text-primary)]'
                            }`}
                            title={
                              brand.sizing_status === 'verified_loaded'
                                ? 'Verified sizing data available'
                                : brand.sizing_status === 'partial'
                                  ? 'Partial sizing data; measurement estimate may be used'
                                  : 'Measurement-based size estimate available'
                            }
                          >
                            {brand.brand_name}
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
            {filters.brand && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, brand: '' }))}
                className="h-9 rounded-full px-4 bg-[var(--color-text-primary)] text-[var(--color-background)] text-sm flex items-center gap-2 shrink-0 select-none"
              >
                {filters.brand}
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
            <Sparkles className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
            <p className="text-[var(--color-text-primary)] font-medium mb-1">No products found</p>
            <p className="text-[var(--color-text-secondary)] text-sm">Try adjusting your filters or search</p>
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
                  </div>
                  {(() => {
                    const recommendation = getProductRecommendation(product);
                    return recommendation ? (
                      <div>
                        <p className="text-xs text-[var(--color-accent)] font-medium">
                          {recommendation.label}: {recommendation.size}{recommendation.width ? ' • ' + recommendation.width : ''}
                        </p>
                        {recommendation.detail && (
                          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{recommendation.detail}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)]">Choose size on product page</p>
                    );
                  })()}
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