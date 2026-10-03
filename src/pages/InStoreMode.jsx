import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Store, X, Navigation, Loader2, Heart, 
  ShoppingBag, Shirt, Bell, Check 
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import StoreSelector from '@/components/instore/StoreSelector';
import InStoreWishlist from '@/components/instore/InStoreWishlist';
import TryOnRequest from '@/components/instore/TryOnRequest';
import InStoreCheckout from '@/components/instore/InStoreCheckout';

export default function InStoreMode() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [nearbyStores, setNearbyStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [checkedIn, setCheckedIn] = useState(null);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [tryOnRequested, setTryOnRequested] = useState(false);
  const [assignedEmployee, setAssignedEmployee] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showStoreSelector, setShowStoreSelector] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (checkedIn) {
      loadWishlistForStore();
      subscribeToCheckin();
    }
  }, [checkedIn]);

  const loadInitialData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const profiles = await base44.entities.UserProfile.filter({ user_id: currentUser.id });
      if (profiles.length > 0) {
        setUserProfile(profiles[0]);
      }

      // Check for existing check-in
      const existingCheckins = await base44.entities.StoreCheckin.filter({
        user_id: currentUser.id,
        status: { $in: ['browsing', 'assisted', 'fitting_room'] }
      });

      if (existingCheckins.length > 0) {
        setCheckedIn(existingCheckins[0]);
        const vendors = await base44.entities.Vendor.filter({ id: existingCheckins[0].vendor_id });
        if (vendors.length > 0) setSelectedStore(vendors[0]);
        if (existingCheckins[0].assigned_employee_name) {
          setAssignedEmployee({ name: existingCheckins[0].assigned_employee_name });
        }
      }

      // Load vendors/stores
      const vendors = await base44.entities.Vendor.list();
      setNearbyStores(vendors);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const detectLocation = async () => {
    setDetectingLocation(true);
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            // Find nearby stores based on location
            const vendors = await base44.entities.Vendor.list();
            const nearby = vendors.filter(v => {
              if (!v.locations?.length) return false;
              return v.locations.some(loc => {
                if (!Number.isFinite(Number(loc.lat)) || !Number.isFinite(Number(loc.lng))) return false;
                const distance = getDistance(latitude, longitude, Number(loc.lat), Number(loc.lng));
                return distance < 0.5; // Within 500m
              });
            });
            
            if (nearby.length > 0) {
              setNearbyStores(nearby);
              if (nearby.length === 1) {
                const nearestLocation = nearby[0].locations
                  .filter(loc => Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lng)))
                  .sort((a, b) =>
                    getDistance(latitude, longitude, Number(a.lat), Number(a.lng)) -
                    getDistance(latitude, longitude, Number(b.lat), Number(b.lng))
                  )[0] || null;
                handleStoreSelect(nearby[0], nearestLocation);
              } else {
                setShowStoreSelector(true);
              }
            } else {
              setShowStoreSelector(true);
            }
            setDetectingLocation(false);
          },
          () => {
            setDetectingLocation(false);
            setShowStoreSelector(true);
          }
        );
      } else {
        setShowStoreSelector(true);
        setDetectingLocation(false);
      }
    } catch (error) {
      console.error(error);
      setDetectingLocation(false);
      setShowStoreSelector(true);
    }
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const handleStoreSelect = async (store, location = null) => {
    const resolvedLocation =
      location ||
      (store.locations?.length === 1 ? store.locations[0] : null) ||
      store.locations?.[0] ||
      null;

    setSelectedStore(store);
    setSelectedLocation(resolvedLocation);
    setShowStoreSelector(false);

    try {
      const response = await base44.functions.invoke('storeVisit', {
        action: 'checkin',
        vendorId: store.id,
        locationId: resolvedLocation?.id || resolvedLocation?.location_id || ''
      });
      const result = response?.data || response;
      if (!result?.checkin) throw new Error(result?.error || 'Check-in could not be created.');
      setCheckedIn(result.checkin);
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error || error?.message || 'Check-in could not be created.');
    }
  };

  const loadWishlistForStore = async () => {
    try {
      const items = await base44.entities.WishlistItem.filter({ 
        user_id: user.id,
        vendor_id: selectedStore?.id 
      });
      setWishlistItems(items);
    } catch (error) {
      console.error(error);
    }
  };

  const subscribeToCheckin = () => {
    if (!checkedIn) return;
    
    const unsubscribe = base44.entities.StoreCheckin.subscribe((event) => {
      if (event.data?.id === checkedIn.id) {
        setCheckedIn(event.data);
        if (event.data.assigned_employee_name) {
          setAssignedEmployee({ name: event.data.assigned_employee_name });
        }
      }
    });

    return unsubscribe;
  };

  const requestTryOn = async () => {
    if (selectedItems.length === 0) return;
    
    try {
      const response = await base44.functions.invoke('storeVisit', {
        action: 'tryOnRequest',
        checkinId: checkedIn.id,
        wishlistItemIds: selectedItems.map(i => i.id)
      });
      const result = response?.data || response;
      if (!result?.success) throw new Error(result?.error || 'Try-on request could not be sent.');
      setCheckedIn(prev => prev ? { ...prev, status: 'assisted', wishlist_items: selectedItems.map(i => i.id) } : prev);
      setTryOnRequested(true);
    } catch (error) {
      console.error(error);
    }
  };

  const checkOut = async () => {
    try {
      await base44.functions.invoke('storeVisit', {
        action: 'checkout',
        checkinId: checkedIn.id
      });
      setCheckedIn(null);
      setSelectedStore(null);
      setSelectedLocation(null);
      navigate(createPageUrl('Home'));
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error || error?.message || 'Store checkout could not be completed.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a]" />
      </div>
    );
  }

  // Not checked in yet
  if (!checkedIn) {
    return (
      <div className="min-h-screen bg-[#1a1a1a]">
        <div className="px-6 pt-12 pb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-8"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <div className="w-20 h-20 rounded-2xl bg-[#c9a962]/20 flex items-center justify-center mb-6">
              <Store className="w-10 h-10 text-[#c9a962]" />
            </div>
            <h1 className="text-4xl font-light text-white mb-2">In-Store Mode</h1>
            <p className="text-white/60 mb-10">
              Get personalized assistance and try on your wishlist items
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <Button
              onClick={detectLocation}
              disabled={detectingLocation}
              className="w-full h-16 bg-[#c9a962] hover:bg-[#b8944d] text-[#1a1a1a] rounded-2xl font-medium text-base"
            >
              {detectingLocation ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Navigation className="w-5 h-5 mr-2" />
              )}
              Detect My Location
            </Button>

            <Button
              onClick={() => setShowStoreSelector(true)}
              variant="outline"
              className="w-full h-16 border-white/20 text-white hover:bg-white/10 rounded-2xl font-medium text-base"
            >
              <MapPin className="w-5 h-5 mr-2" />
              Select Store Manually
            </Button>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-12"
          >
            <p className="text-white/40 text-xs uppercase tracking-wider mb-4">How it works</p>
            <div className="space-y-4">
              {[
                { icon: MapPin, text: 'Check in at a store' },
                { icon: Heart, text: 'View your wishlist items available here' },
                { icon: Shirt, text: 'Request items to try on' },
                { icon: ShoppingBag, text: 'Complete your purchase seamlessly' }
              ].map((step, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <step.icon className="w-5 h-5 text-white/60" />
                  </div>
                  <p className="text-white/80">{step.text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <StoreSelector
          open={showStoreSelector}
          onClose={() => setShowStoreSelector(false)}
          stores={nearbyStores}
          onSelect={handleStoreSelect}
        />
      </div>
    );
  }

  // Checked in - show in-store experience
  return (
    <div className="min-h-screen bg-[#fafafa] pb-32">
      {/* Header with store info */}
      <div className="bg-[#1a1a1a] pt-12 pb-6 px-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 rounded-full">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-400 text-sm">Checked In</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/10 overflow-hidden">
            {selectedStore?.business_picture ? (
              <img src={selectedStore.business_picture} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Store className="w-6 h-6 text-white/40" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-medium text-white">{selectedStore?.business_name}</h1>
            <p className="text-white/60 text-sm">
              {selectedLocation?.address || selectedStore?.locations?.[0]?.address || 'In-Store Shopping'}
            </p>
          </div>
        </div>

        {/* Assigned employee notification */}
        <AnimatePresence>
          {assignedEmployee && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="mt-4 bg-[#c9a962]/20 rounded-xl p-4 flex items-center gap-3"
            >
              <Bell className="w-5 h-5 text-[#c9a962]" />
              <div>
                <p className="text-white text-sm font-medium">{assignedEmployee.name} is helping you</p>
                <p className="text-white/60 text-xs">They'll bring your items shortly</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status tabs */}
      <div className="px-6 -mt-3">
        <div className="bg-white rounded-2xl shadow-lg p-2 flex gap-2">
          {[
            { key: 'browsing', label: 'Browsing', icon: Heart },
            { key: 'assisted', label: 'Try-On', icon: Shirt },
            { key: 'fitting_room', label: 'Fitting', icon: Check }
          ].map((tab) => (
            <div
              key={tab.key}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors ${
                checkedIn.status === tab.key 
                  ? 'bg-[#1a1a1a] text-white' 
                  : 'text-[#64748b]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Wishlist items at this store */}
      <InStoreWishlist
        items={wishlistItems}
        selectedItems={selectedItems}
        onToggleSelect={(item) => {
          setSelectedItems(prev => 
            prev.find(i => i.id === item.id)
              ? prev.filter(i => i.id !== item.id)
              : [...prev, item]
          );
        }}
        onViewAll={() => navigate(createPageUrl('Wishlist'))}
      />

      {/* Try-on request component */}
      {!tryOnRequested && selectedItems.length > 0 && (
        <TryOnRequest
          items={selectedItems}
          userProfile={userProfile}
          onRequest={requestTryOn}
          onCancel={() => setSelectedItems([])}
        />
      )}

      {/* Try-on requested status */}
      {tryOnRequested && !assignedEmployee && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mx-6 mt-6 bg-[#f5f5f0] rounded-2xl p-6 text-center"
        >
          <Loader2 className="w-8 h-8 animate-spin text-[#c9a962] mx-auto mb-4" />
          <h3 className="font-medium text-[#1a1a1a] mb-1">Waiting for assistance</h3>
          <p className="text-sm text-[#64748b]">A team member will be with you shortly</p>
        </motion.div>
      )}

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#fafafa] via-[#fafafa] to-transparent">
        <div className="flex gap-3">
          <Button
            onClick={() => navigate(createPageUrl('Shop'))}
            variant="outline"
            className="flex-1 h-14 rounded-xl border-[#e5e5e5]"
          >
            Continue Browsing
          </Button>
          <Button
            onClick={() => setShowCheckout(true)}
            className="flex-1 h-14 rounded-xl bg-[#1a1a1a] hover:bg-[#2a2a2a]"
          >
            <ShoppingBag className="w-5 h-5 mr-2" />
            Checkout
          </Button>
        </div>
      </div>

      {/* Checkout sheet */}
      <InStoreCheckout
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        store={selectedStore}
        user={user}
        onComplete={checkOut}
      />
    </div>
  );
}