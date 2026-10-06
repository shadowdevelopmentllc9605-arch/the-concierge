import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Heart, ShoppingBag, Sparkles } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { getCategoryGroup, getEffectiveSizeChart, getFitRecommendationPresentation, recommendFromSizeChart } from '@/lib/fitRecommendation';
import { resolveFileUrl } from '@/lib/privateFiles';

export default function TryOn() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const initialProductId = urlParams.get('id') || urlParams.get('product');

  const [products, setProducts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wishlist, setWishlist] = useState([]);
  const [user, setUser] = useState(null);
  const [bodyScanUrl, setBodyScanUrl] = useState('');
  const [brandCharts, setBrandCharts] = useState([]);

  // Body scans are private files — render through a short-lived signed URL.
  useEffect(() => {
    let cancelled = false;
    if (userProfile?.body_scan_front) {
      resolveFileUrl(userProfile.body_scan_front)
        .then(url => { if (!cancelled) setBodyScanUrl(url); })
        .catch(console.error);
    } else {
      setBodyScanUrl('');
    }
    return () => { cancelled = true; };
  }, [userProfile?.body_scan_front]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Load user profile for body scan
      const profiles = await base44.entities.UserProfile.filter({ user_id: currentUser.id });
      if (profiles.length > 0) {
        setUserProfile(profiles[0]);
      }

      // Load products and verified brand charts
      const [allProducts, sizeCharts] = await Promise.all([
        base44.entities.Product.list('-created_date', 50),
        base44.entities.BrandSizeChart.filter({ active: true })
      ]);
      setProducts(allProducts);
      setBrandCharts(sizeCharts);

      // If initial product specified, find its index
      if (initialProductId) {
        const idx = allProducts.findIndex(p => p.id === initialProductId);
        if (idx >= 0) setCurrentIndex(idx);
      }

      // Load wishlist
      const wishlistItems = await base44.entities.WishlistItem.filter({ user_id: currentUser.id });
      setWishlist(wishlistItems.map(w => w.product_id));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const currentProduct = products[currentIndex];

  const goNext = () => {
    if (products.length === 0) return;
    setCurrentIndex(prev => (prev + 1) % products.length);
  };

  const goPrev = () => {
    if (products.length === 0) return;
    setCurrentIndex(prev => (prev - 1 + products.length) % products.length);
  };

  const toggleWishlist = async () => {
    if (!currentProduct) return;
    try {
      if (wishlist.includes(currentProduct.id)) {
        const items = await base44.entities.WishlistItem.filter({
          user_id: user.id,
          product_id: currentProduct.id
        });
        if (items.length > 0) {
          await base44.entities.WishlistItem.delete(items[0].id);
        }
        setWishlist(prev => prev.filter(id => id !== currentProduct.id));
      } else {
        await base44.entities.WishlistItem.create({
          user_id: user.id,
          product_id: currentProduct.id,
          product_name: currentProduct.name,
          product_image: currentProduct.images?.[0],
          product_price: currentProduct.price,
          vendor_id: currentProduct.vendor_id,
          is_public: false
        });
        setWishlist(prev => [...prev, currentProduct.id]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCartAction = () => {
    if (!currentProduct) return;
    navigate(createPageUrl('ProductDetail?id=' + currentProduct.id));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-[#c9a962] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center px-6 text-center">
        <Sparkles className="w-10 h-10 text-[#c9a962] mb-4" />
        <h1 className="text-white text-xl font-medium mb-2">No products available to try on</h1>
        <p className="text-white/60 mb-6">Check the shop again after products have been added.</p>
        <Button onClick={() => navigate(createPageUrl('Shop'))}>Back to Shop</Button>
      </div>
    );
  }

  const effectiveChart = getEffectiveSizeChart(currentProduct, userProfile, brandCharts);
  const chartMatch = recommendFromSizeChart(
    effectiveChart.entries,
    userProfile?.measurement_values_cm || {},
    {
      shoeSize: userProfile?.measurements?.shoe_size,
      shoeWidth: userProfile?.measurements?.shoe_width,
      braSize: userProfile?.measurements?.bra_size,
      gender: userProfile?.gender,
      category: currentProduct?.category,
      categoryGroup: getCategoryGroup(currentProduct?.category),
      measurementConfidence: userProfile?.measurement_confidence,
      measurementConfidenceByField: userProfile?.measurement_confidence_by_field || {},
      validationStatus: userProfile?.measurement_validation_status || 'estimated',
      sizeAdjustmentSteps: currentProduct?.footwear_fit?.size_adjustment_steps ?? effectiveChart.chart?.size_adjustment_steps ?? 0
    }
  );
  const categoryGroup = getCategoryGroup(currentProduct?.category);
  let recommendedSize = chartMatch?.blocked
    ? ''
    : (chartMatch?.size || (categoryGroup ? userProfile?.suggested_sizes?.[categoryGroup] : ''));
  const recommendedWidth = chartMatch?.blocked ? '' : (chartMatch?.width || '');
  if (currentProduct?.category === 'suits' && !chartMatch?.size && !chartMatch?.blocked && userProfile?.suggested_sizes?.suits) {
    const suitBase = userProfile.suggested_sizes.suits;
    recommendedSize = currentProduct.sizes?.find(value => String(value).startsWith(String(suitBase))) || suitBase;
  }
  if (recommendedSize && currentProduct?.sizes?.length && !currentProduct.sizes.includes(recommendedSize)) {
    recommendedSize = '';
  }
  const recommendationSource = chartMatch?.size && !chartMatch.blocked
    ? effectiveChart.source
    : recommendedSize
      ? 'profile_estimate'
      : '';
  const recommendationPresentation = recommendedSize
    ? getFitRecommendationPresentation(recommendationSource, chartMatch?.matchType || '')
    : { label: '', detail: '', verified: false };

  return (
    <div className="min-h-screen bg-[#1a1a1a] relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 px-4 py-4 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-full">
          <Sparkles className="w-4 h-4 text-[#c9a962]" />
          <span className="text-white text-sm">Virtual Try-On</span>
        </div>
        <button
          onClick={() => navigate(createPageUrl('Cart'))}
          aria-label="Open cart"
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"
        >
          <ShoppingBag className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Main Try-On Area */}
      <div className="h-screen relative">
        {/* User silhouette/photo background */}
        <div className="absolute inset-0 flex items-center justify-center">
          {bodyScanUrl ? (
            <img 
              src={bodyScanUrl}
              alt="Your body scan"
              className="h-full w-auto object-contain opacity-50"
            />
          ) : (
            <div className="text-white/20 text-9xl">🧍</div>
          )}
        </div>

        {/* Product overlay */}
        <AnimatePresence mode="wait">
          {currentProduct && (
            <motion.div
              key={currentProduct.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              {currentProduct.tryOn_image ? (
                <img 
                  src={currentProduct.tryOn_image}
                  alt={currentProduct.name}
                  className="h-2/3 w-auto object-contain drop-shadow-2xl"
                />
              ) : (
                <div className="max-w-xs bg-black/50 border border-white/10 rounded-2xl p-6 text-center">
                  <Sparkles className="w-8 h-8 text-[#c9a962] mx-auto mb-3" />
                  <p className="text-white font-medium">Virtual try-on asset unavailable</p>
                  <p className="text-white/60 text-sm mt-2">This retailer has not uploaded a try-on asset for this product yet.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation arrows */}
        <div className="absolute inset-y-0 left-0 flex items-center pl-2">
          <button
            onClick={goPrev}
            className="w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          <button
            onClick={goNext}
            className="w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Product Info Panel */}
      {currentProduct && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent p-6 pt-20"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-white/60 text-sm">{currentProduct.brand}</p>
              <h2 className="text-white text-xl font-medium">{currentProduct.name}</h2>
              <p className="text-[#c9a962] text-lg font-semibold mt-1">${currentProduct.price?.toFixed(2)}</p>
            </div>
            <button
              onClick={toggleWishlist}
              aria-label={wishlist.includes(currentProduct.id) ? "Remove from wishlist" : "Add to wishlist"}
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                wishlist.includes(currentProduct.id)
                  ? 'bg-[#c9a962]'
                  : 'bg-white/10'
              }`}
            >
              <Heart className={`w-5 h-5 ${
                wishlist.includes(currentProduct.id)
                  ? 'text-[#1a1a1a] fill-current'
                  : 'text-white'
              }`} />
            </button>
          </div>

          {/* Size recommendation */}
          {userProfile?.suggested_sizes && (
            <div className="flex items-center gap-2 mb-4 text-sm">
              <Sparkles className="w-4 h-4 text-[#c9a962]" />
              <div>
                <div>
                  <span className="text-white/60">{recommendationPresentation.label ? `${recommendationPresentation.label}: ` : 'Size: '}</span>
                  <span className="text-white font-medium">{recommendedSize ? recommendedSize + (recommendedWidth ? ' • ' + recommendedWidth : '') : 'Select on product page'}</span>
                </div>
                {recommendedSize && recommendationPresentation.detail && (
                  <p className="text-white/50 text-xs mt-0.5">{recommendationPresentation.detail}</p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={() => navigate(createPageUrl(`ProductDetail?id=${currentProduct.id}`))}
              variant="outline"
              className="flex-1 h-14 rounded-xl border-white/20 text-white hover:bg-white/10"
            >
              View Details
            </Button>
            <Button
              onClick={handleCartAction}
              className="flex-1 h-14 rounded-xl bg-[#c9a962] hover:bg-[#b8944d] text-[#1a1a1a]"
            >
              <ShoppingBag className="w-5 h-5 mr-2" />
              {(currentProduct.sizes?.length || 0) > 0 ? 'Choose Options' : 'View Product'}
            </Button>
          </div>

          {/* Progress indicator */}
          <div className="flex justify-center gap-1 mt-4">
            {products.slice(0, Math.min(10, products.length)).map((_, idx) => (
              <div 
                key={idx}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === currentIndex % 10 ? 'bg-[#c9a962]' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}