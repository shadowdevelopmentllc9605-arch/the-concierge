import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, ShoppingBag, Sparkles, Check, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { getCategoryGroup, getEffectiveSizeChart, normalizeBrandKey, recommendFromSizeChart } from '@/lib/fitRecommendation';

export default function ProductDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedWidth, setSelectedWidth] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [user, setUser] = useState(null);
  const [suggestedSize, setSuggestedSize] = useState('');
  const [suggestedWidth, setSuggestedWidth] = useState('');
  const [footwearFitNote, setFootwearFitNote] = useState('');
  const [recommendationSource, setRecommendationSource] = useState('');

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

      // Get user profile and match measurements against this product's size chart when available.
      const profiles = await base44.entities.UserProfile.filter({ user_id: currentUser.id });
      if (profiles.length > 0 && products[0]) {
        const profile = profiles[0];
        const product = products[0];
        const brandCharts = product.brand
          ? await base44.entities.BrandSizeChart.filter({
              brand_key: normalizeBrandKey(product.brand),
              active: true
            })
          : [];
        const effectiveChart = getEffectiveSizeChart(product, profile, brandCharts);
        if (getCategoryGroup(product.category) === 'footwear') {
          setFootwearFitNote(product.footwear_fit?.fit_notes || effectiveChart.chart?.fit_guidance || '');
        }
        const chartMatch = recommendFromSizeChart(
          effectiveChart.entries,
          profile.measurement_values_cm || {},
          {
            shoeSize: profile.measurements?.shoe_size,
            shoeWidth: profile.measurements?.shoe_width,
            braSize: profile.measurements?.bra_size,
            gender: profile.gender,
            sizeAdjustmentSteps: product.footwear_fit?.size_adjustment_steps ?? effectiveChart.chart?.size_adjustment_steps ?? 0
          }
        );

        if (chartMatch?.size) {
          setSuggestedSize(chartMatch.size);
          setSuggestedWidth(chartMatch.width || '');
          if (chartMatch.width && (!product.width_options?.length || product.width_options.includes(chartMatch.width))) {
            setSelectedWidth(chartMatch.width);
          }
          setRecommendationSource(
            effectiveChart.source === 'brand_size_chart'
              ? (chartMatch.matchType === 'nearest' ? 'brand_size_chart_nearest' : 'brand_size_chart')
              : (chartMatch.matchType === 'nearest' ? 'product_size_chart_nearest' : 'product_size_chart')
          );
        } else {
          const group = getCategoryGroup(product.category);
          let fallback = group ? profile.suggested_sizes?.[group] : '';

          // Suits often store values like 40R while the profile fallback is 40.
          if (product.category === 'suits' && profile.suggested_sizes?.suits) {
            const suitBase = profile.suggested_sizes.suits;
            fallback =
              product.sizes?.find(size => String(size).startsWith(String(suitBase))) ||
              suitBase;
          }

          if (fallback && (!product.sizes?.length || product.sizes.includes(fallback))) {
            setSuggestedSize(fallback);
            setRecommendationSource('profile_estimate');
          }
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
    const cartWidthOptions = Array.from(new Set([
      ...(product?.width_options || []),
      ...((product?.variants || []).map(variant => variant.width_code).filter(Boolean))
    ])).filter(Boolean);
    const requiresWidth = cartWidthOptions.length > 0;
    if (requiresSize && !selectedSize) return;
    if (requiresWidth && !selectedWidth) return;

    setAddingToCart(true);
    try {
      const existingItems = await base44.entities.CartItem.filter({
        user_id: user.id,
        product_id: product.id
      });
      const matchingItem = existingItems.find(item =>
        (item.size || '') === (selectedSize || '') &&
        (item.width_code || '') === (selectedWidth || '') &&
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
          width_code: selectedWidth || '',
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

  if (!product || product.discontinued) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-[var(--color-text-primary)] font-medium">This product is no longer available.</p>
          <button
            onClick={() => navigate(createPageUrl('Shop'))}
            className="mt-4 text-sm text-[var(--color-accent)]"
          >
            Return to Shop
          </button>
        </div>
      </div>
    );
  }

  const hasVariantStock = Array.isArray(product.variants) && product.variants.length > 0;
  const widthOptions = Array.from(new Set([
    ...(product.width_options || []),
    ...((product.variants || []).map(variant => variant.width_code).filter(Boolean))
  ])).filter(Boolean);
  const sizeAvailable = (size) =>
    !hasVariantStock ||
    product.variants.some(variant =>
      variant.size === size &&
      Number(variant.stock_quantity || 0) > 0 &&
      (!selectedWidth || String(variant.width_code || '') === selectedWidth) &&
      (!selectedColor || variant.color === selectedColor)
    );
  const widthAvailable = (width) =>
    !hasVariantStock ||
    product.variants.some(variant =>
      String(variant.width_code || '') === width &&
      Number(variant.stock_quantity || 0) > 0 &&
      (!selectedSize || variant.size === selectedSize) &&
      (!selectedColor || variant.color === selectedColor)
    );
  const colorAvailable = (color) =>
    !hasVariantStock ||
    product.variants.some(variant =>
      variant.color === color &&
      Number(variant.stock_quantity || 0) > 0 &&
      (!selectedSize || variant.size === selectedSize) &&
      (!selectedWidth || String(variant.width_code || '') === selectedWidth)
    );
  const selectionInStock =
    !hasVariantStock ||
    product.variants.some(variant =>
      Number(variant.stock_quantity || 0) > 0 &&
      (!selectedSize || variant.size === selectedSize) &&
      (!selectedWidth || String(variant.width_code || '') === selectedWidth) &&
      (!selectedColor || variant.color === selectedColor)
    );

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
          onClick={() => product.tryOn_image && navigate(createPageUrl(`TryOn?product=${product.id}`))}
          disabled={!product.tryOn_image}
          className="w-full mt-6 h-12 bg-[var(--color-background-secondary)] rounded-xl flex items-center justify-center gap-2 text-[var(--color-text-primary)] font-medium select-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-5 h-5 text-[var(--color-accent)]" />
          {product.tryOn_image ? 'Virtual Try-On' : 'Virtual Try-On Asset Not Available'}
        </button>

        {/* Size Selection */}
        {product.sizes?.length > 0 && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Select Size</p>
              {suggestedSize && (
                <span className="text-xs text-[var(--color-accent)] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {recommendationSource === 'brand_size_chart' ? 'Verified brand match' : recommendationSource === 'brand_size_chart_nearest' ? 'Closest brand match' : recommendationSource === 'product_size_chart_nearest' ? 'Closest product-chart match' : recommendationSource === 'product_size_chart' ? 'Best match' : 'Profile estimate'}: {suggestedSize}{suggestedWidth ? ' • ' + suggestedWidth : ''}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map(size => (
                <button
                  key={size}
                  onClick={() => sizeAvailable(size) && setSelectedSize(size)}
                  disabled={!sizeAvailable(size)}
                  className={`h-12 min-w-[48px] px-4 rounded-xl border-2 font-medium text-sm transition-colors select-none ${
                    !sizeAvailable(size)
                      ? 'border-[var(--color-border)] text-[var(--color-text-muted)] opacity-40 cursor-not-allowed line-through'
                      : selectedSize === size
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

        {widthOptions.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Select Width</p>
              {suggestedWidth && (
                <span className="text-xs text-[var(--color-accent)] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Recommended: {suggestedWidth}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {widthOptions.map(width => (
                <button
                  key={width}
                  onClick={() => widthAvailable(width) && setSelectedWidth(width)}
                  disabled={!widthAvailable(width)}
                  className={
                    'h-11 min-w-[52px] px-4 rounded-xl border-2 font-medium text-sm transition-colors select-none ' +
                    (!widthAvailable(width)
                      ? 'border-[var(--color-border)] text-[var(--color-text-muted)] opacity-40 cursor-not-allowed line-through'
                      : selectedWidth === width
                        ? 'border-[var(--color-text-primary)] bg-[var(--color-text-primary)] text-[var(--color-background)]'
                        : width === suggestedWidth
                          ? 'border-[var(--color-accent)] text-[var(--color-text-primary)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-primary)]')
                  }
                >
                  {width}
                </button>
              ))}
            </div>
          </div>
        )}

        {getCategoryGroup(product.category) === 'footwear' && footwearFitNote && (
          <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
            Fit note: {footwearFitNote}
          </p>
        )}

        {suggestedSize && recommendationSource === 'profile_estimate' && (
          <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
            This is a general size estimate. Verified brand or retailer product charts take priority when available.
          </p>
        )}
        {suggestedSize && recommendationSource.startsWith('brand_size_chart') && (
          <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
            Recommendation uses the verified brand sizing catalog. A retailer-supplied product chart will override it when available.
          </p>
        )}

        {/* Color Selection */}
        {product.colors?.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Color</p>
            <div className="flex gap-3">
              {product.colors.map(color => (
                <button
                  key={color}
                  onClick={() => colorAvailable(color) && setSelectedColor(color)}
                  disabled={!colorAvailable(color)}
                  aria-label={`Select color ${color}`}
                  title={color}
                  className={`w-10 h-10 rounded-full border-2 transition-all select-none ${
                    !colorAvailable(color)
                      ? 'border-transparent opacity-30 cursor-not-allowed'
                      : selectedColor === color ? 'border-[var(--color-text-primary)] scale-110' : 'border-transparent'
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
          disabled={
            ((product.sizes?.length || 0) > 0 && !selectedSize) ||
            (widthOptions.length > 0 && !selectedWidth) ||
            ((product.colors?.length || 0) > 0 && !selectedColor) ||
            !selectionInStock ||
            addingToCart
          }
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