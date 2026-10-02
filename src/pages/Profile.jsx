import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { 
  User, ShoppingBag, CreditCard, Heart, Users, 
  HelpCircle, MessageCircle, LogOut, ChevronRight, Star, Trash2 
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import DeleteAccountDialog from '@/components/DeleteAccountDialog';
import MeasurementsEditor from '@/components/profile/MeasurementsEditor';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  const handleDeleteAccount = async () => {
    try {
      const [
        closetItems,
        wishlistItems,
        cartItems,
        purchases,
        checkins,
        paymentMethods,
        productReviews,
        aiFeedback,
        shoppingExperiences,
        outgoingFriends,
        incomingFriends
      ] = await Promise.all([
        base44.entities.ClosetItem.filter({ user_id: user.id }),
        base44.entities.WishlistItem.filter({ user_id: user.id }),
        base44.entities.CartItem.filter({ user_id: user.id }),
        base44.entities.Purchase.filter({ user_id: user.id }),
        base44.entities.StoreCheckin.filter({ user_id: user.id }),
        base44.entities.PaymentMethod.filter({ user_id: user.id }),
        base44.entities.ProductReview.filter({ user_id: user.id }),
        base44.entities.AIFeedback.filter({ user_id: user.id }),
        base44.entities.ShoppingExperience.filter({ user_id: user.id }),
        base44.entities.Friend.filter({ user_id: user.id }),
        base44.entities.Friend.filter({ friend_user_id: user.id })
      ]);

      const friendRecords = Array.from(
        new Map([...outgoingFriends, ...incomingFriends].map(record => [record.id, record])).values()
      );

      await Promise.all([
        ...closetItems.map(record => base44.entities.ClosetItem.delete(record.id)),
        ...wishlistItems.map(record => base44.entities.WishlistItem.delete(record.id)),
        ...cartItems.map(record => base44.entities.CartItem.delete(record.id)),
        ...purchases.map(record => base44.entities.Purchase.delete(record.id)),
        ...checkins.map(record => base44.entities.StoreCheckin.delete(record.id)),
        ...paymentMethods.map(record => base44.entities.PaymentMethod.delete(record.id)),
        ...productReviews.map(record => base44.entities.ProductReview.delete(record.id)),
        ...aiFeedback.map(record => base44.entities.AIFeedback.delete(record.id)),
        ...shoppingExperiences.map(record => base44.entities.ShoppingExperience.delete(record.id)),
        ...friendRecords.map(record => base44.entities.Friend.delete(record.id))
      ]);

      if (profile?.id) {
        await base44.entities.UserProfile.delete(profile.id);
      }

      base44.auth.logout();
    } catch (error) {
      console.error(error);
    }
  };

  const menuItems = [
    {
      section: 'Shopping',
      items: [
        { icon: ShoppingBag, label: 'My Closet', description: 'Previous purchases', path: 'Closet' },
        { icon: Heart, label: 'Wishlist', description: 'Saved items', path: 'Wishlist' },
        { icon: CreditCard, label: 'Payment Methods', description: 'Available after secure payments are connected', path: null },
        { icon: Star, label: 'Reviews & Feedback', description: 'Rate your purchases', path: 'Feedback' },
      ]
    },
    {
      section: 'Social',
      items: [
        { icon: Users, label: 'Friends', description: 'Temporarily unavailable while privacy controls are added', path: null },
      ]
    },
    {
      section: 'Support',
      items: [
        { icon: HelpCircle, label: 'FAQ', description: 'Help articles are being prepared', path: null },
        { icon: MessageCircle, label: 'Customer Service', description: 'Send feedback or request help', path: 'Feedback' },
      ]
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-[#1a1a1a] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-24">
      {/* Profile Header */}
      <div className="bg-[var(--color-header-bg)] pt-12 pb-20 px-6">
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
          className="bg-[var(--color-surface)] rounded-2xl shadow-lg p-6 grid grid-cols-3 gap-4"
        >
          {profile?.suggested_sizes && (
            <>
              <div className="text-center">
                <p className="text-2xl font-semibold text-[var(--color-text-primary)]">{profile.suggested_sizes.tops || '-'}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">Top Size</p>
              </div>
              <div className="text-center border-x border-[var(--color-border-light)]">
                <p className="text-2xl font-semibold text-[var(--color-text-primary)]">{profile.suggested_sizes.bottoms || '-'}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">Bottom Size</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-[var(--color-text-primary)]">{profile.suggested_sizes.dresses || '-'}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">Dress Size</p>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Style Preferences */}
      {profile?.style_preferences?.length > 0 && (
        <div className="px-6 mt-6">
          <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Your Style</p>
          <div className="flex flex-wrap gap-2">
            {profile.style_preferences.map(style => (
              <span 
                key={style}
                className="px-4 py-2 bg-[var(--color-background-secondary)] rounded-full text-sm text-[var(--color-text-primary)] capitalize"
              >
                {style}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Measurements */}
      <div className="px-6 mt-6">
        <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Measurements</p>
        <MeasurementsEditor
          profile={profile}
          onSaved={(updatedProfile) => setProfile(updatedProfile)}
        />
      </div>

      {/* Menu Sections */}
      <div className="px-6 mt-8 space-y-6">
        {menuItems.map((section, idx) => (
          <motion.div
            key={section.section}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 + idx * 0.1 }}
          >
            <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">{section.section}</p>
            <div className="bg-[var(--color-surface)] rounded-2xl overflow-hidden shadow-sm">
              {section.items.map((item, itemIdx) => (
                <button
                  key={item.label}
                  onClick={() => item.path && navigate(createPageUrl(item.path))}
                  disabled={!item.path}
                  className={`w-full flex items-center justify-between p-4 hover:bg-[var(--color-surface-hover)] transition-colors select-none ${
                    (itemIdx !== section.items.length - 1 ? 'border-b border-[var(--color-border-light)] ' : '') + (!item.path ? 'opacity-60 cursor-not-allowed' : '')
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-[var(--color-text-primary)]" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-[var(--color-text-primary)]">{item.label}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{item.description}</p>
                    </div>
                  </div>
                  {item.path ? (
                    <ChevronRight className="w-5 h-5 text-[var(--color-text-secondary)]" />
                  ) : (
                    <span className="text-xs text-[var(--color-text-secondary)]">Coming soon</span>
                  )}
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
          className="space-y-3"
        >
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full h-14 rounded-2xl border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] select-none"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Log Out
          </Button>
          <Button
            onClick={() => setShowDeleteDialog(true)}
            variant="outline"
            className="w-full h-14 rounded-2xl border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 select-none"
          >
            <Trash2 className="w-5 h-5 mr-2" />
            Delete Account
          </Button>
        </motion.div>
      </div>

      <DeleteAccountDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteAccount}
        userEmail={user?.email}
      />
    </div>
  );
}