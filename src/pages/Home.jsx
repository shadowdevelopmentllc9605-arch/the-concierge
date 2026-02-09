import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Sparkles, TrendingUp, Heart, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';

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
    <div className="min-h-screen bg-[#fafafa]">
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
            className="text-[#c9a962] text-sm tracking-[0.3em] uppercase mb-2"
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
      <div className="px-6 -mt-8 relative z-30">
        <div className="grid grid-cols-4 gap-3">
          {categories.map((cat, idx) => (
            <motion.button
              key={cat.name}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 + idx * 0.1 }}
              onClick={() => navigate(createPageUrl(cat.path))}
              className="bg-white rounded-2xl p-4 shadow-lg shadow-black/5 flex flex-col items-center gap-2 hover:shadow-xl transition-shadow"
            >
              <cat.icon className="w-5 h-5 text-[#1a1a1a]" />
              <span className="text-xs text-[#1a1a1a] font-medium">{cat.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Shop by Style */}
      <div className="px-6 mt-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-light text-[#1a1a1a] tracking-tight">Shop by Style</h2>
          <button 
            onClick={() => navigate(createPageUrl('Shop'))}
            className="text-sm text-[#64748b] hover:text-[#1a1a1a] transition-colors"
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
              className="relative aspect-[3/4] rounded-2xl overflow-hidden group"
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

      {/* Virtual Try-On CTA */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="px-6 mt-12 mb-24"
      >
        <button 
          onClick={() => navigate(createPageUrl('TryOn'))}
          className="w-full bg-[#1a1a1a] text-white rounded-2xl p-6 flex items-center justify-between group"
        >
          <div className="text-left">
            <p className="text-[#c9a962] text-xs tracking-[0.2em] uppercase mb-1">Experience</p>
            <p className="text-xl font-light">Virtual Try-On</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
            <Sparkles className="w-5 h-5 text-[#c9a962]" />
          </div>
        </button>
      </motion.div>
    </div>
  );
}