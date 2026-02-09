import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { 
  User, ShoppingBag, CreditCard, Heart, Users, Settings, 
  HelpCircle, MessageCircle, LogOut, ChevronRight, Edit2, Star 
} from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      const profiles = await base44.entities.UserProfile.filter({ user_id: currentUser.id });
      if (profiles.length > 0) {
        setProfile(profiles[0]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  const menuItems = [
    {
      section: 'Shopping',
      items: [
        { icon: ShoppingBag, label: 'My Closet', description: 'Previous purchases', path: 'Closet' },
        { icon: Heart, label: 'Wishlist', description: 'Saved items', path: 'Wishlist' },
        { icon: CreditCard, label: 'Payment Methods', description: 'Manage cards', path: 'PaymentMethods' },
        { icon: Star, label: 'Reviews & Feedback', description: 'Rate your purchases', path: 'Feedback' },
      ]
    },
    {
      section: 'Social',
      items: [
        { icon: Users, label: 'Friends', description: 'Manage connections', path: 'Friends' },
      ]
    },
    {
      section: 'Support',
      items: [
        { icon: HelpCircle, label: 'FAQ', description: 'Common questions', path: 'FAQ' },
        { icon: MessageCircle, label: 'Customer Service', description: 'Get help', path: 'Support' },
      ]
    }
  ];

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
      {/* Profile Header */}
      <div className="bg-[#1a1a1a] pt-12 pb-20 px-6">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-4"
        >
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-white/10 overflow-hidden">
              {profile?.profile_picture ? (
                <img 
                  src={profile.profile_picture}
                  alt={user?.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-8 h-8 text-white/40" />
                </div>
              )}
            </div>
            <button 
              onClick={() => navigate(createPageUrl('EditProfile'))}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#c9a962] flex items-center justify-center"
            >
              <Edit2 className="w-4 h-4 text-[#1a1a1a]" />
            </button>
          </div>
          <div>
            <h1 className="text-2xl font-medium text-white">{user?.full_name || 'Guest'}</h1>
            <p className="text-white/60 text-sm">{user?.email}</p>
          </div>
        </motion.div>
      </div>

      {/* Quick Stats */}
      <div className="px-6 -mt-10">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6 grid grid-cols-3 gap-4"
        >
          {profile?.suggested_sizes && (
            <>
              <div className="text-center">
                <p className="text-2xl font-semibold text-[#1a1a1a]">{profile.suggested_sizes.tops || '-'}</p>
                <p className="text-xs text-[#64748b] mt-1">Top Size</p>
              </div>
              <div className="text-center border-x border-[#f5f5f0]">
                <p className="text-2xl font-semibold text-[#1a1a1a]">{profile.suggested_sizes.bottoms || '-'}</p>
                <p className="text-xs text-[#64748b] mt-1">Bottom Size</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-[#1a1a1a]">{profile.suggested_sizes.dresses || '-'}</p>
                <p className="text-xs text-[#64748b] mt-1">Dress Size</p>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Style Preferences */}
      {profile?.style_preferences?.length > 0 && (
        <div className="px-6 mt-6">
          <p className="text-xs text-[#64748b] uppercase tracking-wider mb-3">Your Style</p>
          <div className="flex flex-wrap gap-2">
            {profile.style_preferences.map(style => (
              <span 
                key={style}
                className="px-4 py-2 bg-[#f5f5f0] rounded-full text-sm text-[#1a1a1a] capitalize"
              >
                {style}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Menu Sections */}
      <div className="px-6 mt-8 space-y-6">
        {menuItems.map((section, idx) => (
          <motion.div
            key={section.section}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 + idx * 0.1 }}
          >
            <p className="text-xs text-[#64748b] uppercase tracking-wider mb-3">{section.section}</p>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {section.items.map((item, itemIdx) => (
                <button
                  key={item.label}
                  onClick={() => navigate(createPageUrl(item.path))}
                  className={`w-full flex items-center justify-between p-4 hover:bg-[#fafafa] transition-colors ${
                    itemIdx !== section.items.length - 1 ? 'border-b border-[#f5f5f0]' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#f5f5f0] flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-[#1a1a1a]" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-[#1a1a1a]">{item.label}</p>
                      <p className="text-xs text-[#64748b]">{item.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#64748b]" />
                </button>
              ))}
            </div>
          </motion.div>
        ))}

        {/* Logout */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full h-14 rounded-2xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Log Out
          </Button>
        </motion.div>
      </div>
    </div>
  );
}