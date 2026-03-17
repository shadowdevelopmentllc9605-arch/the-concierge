import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Sparkles, TrendingUp, Heart, ShoppingBag, Ruler, Star, ChevronRight, Store, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import PullToRefresh from '@/components/PullToRefresh';

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      const profiles = await base44.entities.UserProfile.filter({ user_id: currentUser.id });
      
      if (profiles.length === 0 || !profiles[0].onboarding_completed) {
        navigate(createPageUrl('Onboarding'));
        return;
      }
      
      setUserProfile(profiles[0]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const outfitSuggestions = [
    { name: 'Business Look', image: 'https://images.unsplash.com/photo-1521341957697-b93449760f30?w=400&h=400&fit=crop', style: 'business' },
    { name: 'Casual Fit', image: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400&h=400&fit=crop', style: 'casual' },
    { name: 'Date Night', image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=400&fit=crop', style: 'nightlife' },
    { name: 'Weekend Style', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=400&fit=crop', style: 'trendy' },
  ];

  const recommendedItems = [
    { id: 1, name: 'Slim Fit Suit', brand: 'Hugo Boss', price: '349', image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&h=533&fit=crop', fitScore: 96, size: 'M (40R)', fitNote: 'True to size', store: 'Nordstrom' },
    { id: 2, name: 'Oxford Dress Shirt', brand: 'Ralph Lauren', price: '89', image: 'https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?w=400&h=533&fit=crop', fitScore: 94, size: 'M (15.5)', fitNote: 'Runs slim – size up', store: 'Macy\'s' },
    { id: 3, name: 'Classic Chinos', brand: 'J.Crew', price: '79', image: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4357?w=400&h=533&fit=crop', fitScore: 91, size: '32×32', fitNote: 'True to size', store: 'J.Crew' },
    { id: 4, name: 'Chelsea Boots', brand: 'Thursday Boot', price: '199', image: 'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?w=400&h=533&fit=crop', fitScore: 98, size: '10', fitNote: 'Perfect fit', store: 'Online' },
  ];

  const handleRefresh = useCallback(async () => {
    await checkOnboarding();
  }, []);

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

  const categories = [
    { name: 'New Arrivals', icon: Sparkles, path: 'Shop?filter=new' },
    { name: 'Trending', icon: TrendingUp, path: 'Shop?filter=trending' },
    { name: 'Wishlist', icon: Heart, path: 'Wishlist' },
    { name: 'My Closet', icon: ShoppingBag, path: 'Closet' },
  ];

  const styleCategories = [
    { name: 'Business', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop', path: 'Shop?style=business' },
    { name: 'Casual', image: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400&h=500&fit=crop', path: 'Shop?style=casual' },
    { name: 'Nightlife', image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=500&fit=crop', path: 'Shop?style=nightlife' },
    { name: 'Trendy', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=500&fit=crop', path: 'Shop?style=trendy' },
  ];

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen bg-[var(--color-background)]">
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative h-[60vh] overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/60 z-10" />
        <img 
          src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=800&fit=crop"
          alt="Fashion"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 z-20 flex flex-col justify-end p-8">
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-[var(--color-accent)] text-sm tracking-[0.3em] uppercase mb-2"
          >
            Welcome back
          </motion.p>
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-white text-4xl md:text-5xl font-light tracking-tight"
          >
            The Concierge
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-white/70 mt-2 text-lg font-light"
          >
            Welcome back, {user?.full_name?.split(' ')[0] || 'there'}
          </motion.p>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="px-6 mt-6 relative z-30">
        <div className="grid grid-cols-4 gap-3">
          {categories.map((cat, idx) => (
            <motion.button
              key={cat.name}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 + idx * 0.1 }}
              onClick={() => navigate(createPageUrl(cat.path))}
              className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-lg shadow-black/5 flex flex-col items-center gap-2 hover:shadow-xl transition-shadow select-none"
            >
              <cat.icon className="w-5 h-5 text-[var(--color-text-primary)]" />
              <span className="text-xs text-[var(--color-text-primary)] font-medium">{cat.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Recommended For You */}
      <div className="px-6 mt-10">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-light text-[var(--color-text-primary)] tracking-tight">Recommended for You</h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Perfect fit for your body</p>
          </div>
          <button onClick={() => navigate(createPageUrl('Shop'))} className="text-sm text-[var(--color-accent)] select-none flex items-center gap-1">
            See all <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {recommendedItems.map((item, idx) => (
            <motion.button
              key={item.id}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6 + idx * 0.1 }}
              onClick={() => navigate(createPageUrl('Shop'))}
              className="shrink-0 w-44 text-left select-none group"
            >
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-[var(--color-placeholder)] mb-2">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="bg-white/90 backdrop-blur-sm rounded-xl px-2 py-1.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-semibold text-green-700">Fit Score: {item.fitScore}%</span>
                      <Zap className="w-3 h-3 text-[var(--color-accent)]" />
                    </div>
                    <p className="text-[10px] text-gray-600">Rec. Size: {item.size}</p>
                    <p className="text-[10px] text-gray-500">{item.fitNote}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(createPageUrl('TryOn')); }}
                  className="absolute top-2 right-2 bg-[var(--color-text-primary)]/80 backdrop-blur text-[var(--color-background)] text-[10px] px-2 py-1 rounded-full font-medium"
                >
                  Try On
                </button>
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{item.name}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">{item.brand}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">${item.price}</p>
                {item.store && (
                  <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-0.5">
                    <Store className="w-2.5 h-2.5" />{item.store}
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* AI Concierge CTA */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="px-6 mt-8"
      >
        <div className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border-light)]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
            <div>
              <p className="font-medium text-[var(--color-text-primary)] text-sm">Your Style Concierge</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 italic">"What are you shopping for today?"</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['Build an outfit', 'Date night look', 'Work attire', 'Something casual'].map(prompt => (
              <button
                key={prompt}
                onClick={() => navigate(createPageUrl('Shop'))}
                className="text-xs px-3 py-1.5 rounded-full bg-[var(--color-background-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors select-none"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Shop by Style */}
      <div className="px-6 mt-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-light text-[var(--color-text-primary)] tracking-tight">Shop by Style</h2>
          <button 
            onClick={() => navigate(createPageUrl('Shop'))}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors select-none"
          >
            View all
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {styleCategories.map((style, idx) => (
            <motion.button
              key={style.name}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 + idx * 0.1 }}
              onClick={() => navigate(createPageUrl(style.path))}
              className="relative aspect-[3/4] rounded-2xl overflow-hidden group select-none"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
              <img 
                src={style.image}
                alt={style.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <span className="absolute bottom-4 left-4 z-20 text-white font-medium tracking-wide">
                {style.name}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Outfit Builder */}
      <div className="px-6 mt-10">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-light text-[var(--color-text-primary)] tracking-tight">Complete the Look</h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Pair with these items</p>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {outfitSuggestions.map((outfit, idx) => (
            <motion.button
              key={outfit.name}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.0 + idx * 0.1 }}
              onClick={() => navigate(createPageUrl(`Shop?style=${outfit.style}`))}
              className="shrink-0 w-36 select-none group text-left"
            >
              <div className="relative aspect-square rounded-2xl overflow-hidden mb-2">
                <img src={outfit.image} alt={outfit.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <span className="absolute bottom-2 left-2 right-2 text-white text-xs font-medium">{outfit.name}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Virtual Try-On CTA */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="px-6 mt-10 mb-24"
      >
        <button 
          onClick={() => navigate(createPageUrl('TryOn'))}
          className="w-full bg-[var(--color-text-primary)] text-[var(--color-background)] rounded-2xl p-6 flex items-center justify-between group select-none"
        >
          <div className="text-left">
            <p className="text-[var(--color-accent)] text-xs tracking-[0.2em] uppercase mb-1">Experience</p>
            <p className="text-xl font-light">See it on your body</p>
            <p className="text-[var(--color-background)]/60 text-sm font-light">Virtual Try-On</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
            <Sparkles className="w-5 h-5 text-[var(--color-accent)]" />
          </div>
        </button>
      </motion.div>
    </PullToRefresh>
  );
}