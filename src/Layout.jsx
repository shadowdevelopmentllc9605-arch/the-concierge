import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Home, Search, Heart, ShoppingBag, User, Store } from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState(null);

  const hideNav = ['Onboarding', 'InStoreMode', 'TryOn'].includes(currentPageName);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      const cartItems = await base44.entities.CartItem.filter({ user_id: currentUser.id });
      setCartCount(cartItems.length);
    } catch (error) {
      // User not logged in
    }
  };

  const navItems = [
    { icon: Home, label: 'Home', path: 'Home' },
    { icon: Search, label: 'Shop', path: 'Shop' },
    { icon: Store, label: 'In-Store', path: 'InStoreMode' },
    { icon: Heart, label: 'Wishlist', path: 'Wishlist' },
    { icon: User, label: 'Profile', path: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {children}
      
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#f0f0f0] px-4 pb-6 pt-2 z-50">
          <div className="flex justify-around items-center max-w-md mx-auto">
            {navItems.map((item) => {
              const isActive = currentPageName === item.path;
              return (
                <Link
                  key={item.path}
                  to={createPageUrl(item.path)}
                  className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-colors ${
                    isActive ? 'text-[#1a1a1a]' : 'text-[#94a3b8]'
                  }`}
                >
                  <div className="relative">
                    <item.icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                    {item.path === 'Cart' && cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#c9a962] text-[#1a1a1a] text-[10px] rounded-full flex items-center justify-center font-medium">
                        {cartCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs ${isActive ? 'font-medium' : ''}`}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}