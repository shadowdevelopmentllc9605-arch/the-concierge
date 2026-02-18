import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Home, Search, Heart, ShoppingBag, User, Store } from 'lucide-react';

// Tab root pages
const TAB_ROOTS = {
  Home: 'Home',
  Shop: 'Shop',
  InStoreMode: 'InStoreMode',
  Wishlist: 'Wishlist',
  Profile: 'Profile'
};

// Pages that belong to each tab
const TAB_CHILDREN = {
  Home: ['Home'],
  Shop: ['Shop', 'ProductDetail', 'TryOn', 'Cart'],
  InStoreMode: ['InStoreMode'],
  Wishlist: ['Wishlist'],
  Profile: ['Profile', 'Closet', 'EditProfile', 'PaymentMethods', 'Friends', 'Feedback', 'FAQ', 'Support']
};

function getTabForPage(pageName) {
  for (const [tab, pages] of Object.entries(TAB_CHILDREN)) {
    if (pages.includes(pageName)) return tab;
  }
  return null;
}

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState(null);
  const [tabHistory, setTabHistory] = useState({
    Home: ['/Home'],
    Shop: ['/Shop'],
    InStoreMode: ['/InStoreMode'],
    Wishlist: ['/Wishlist'],
    Profile: ['/Profile']
  });
  const [activeTab, setActiveTab] = useState('Home');

  const hideNav = ['Onboarding', 'InStoreMode', 'TryOn'].includes(currentPageName);

  useEffect(() => {
    loadUserData();
  }, []);

  // Track navigation and update tab history
  useEffect(() => {
    const currentTab = getTabForPage(currentPageName);
    if (currentTab) {
      setActiveTab(currentTab);
      setTabHistory(prev => {
        const currentHistory = prev[currentTab] || [];
        const currentPath = location.pathname + location.search;
        
        // Don't add duplicate entries
        if (currentHistory[currentHistory.length - 1] !== currentPath) {
          return {
            ...prev,
            [currentTab]: [...currentHistory, currentPath]
          };
        }
        return prev;
      });
    }
  }, [currentPageName, location]);

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

  const handleTabPress = useCallback((tabPath) => {
    const currentTab = getTabForPage(currentPageName);
    const isCurrentTab = currentTab === tabPath;
    
    if (isCurrentTab) {
      // If already on this tab, reset to root
      const rootPath = createPageUrl(TAB_ROOTS[tabPath]);
      setTabHistory(prev => ({
        ...prev,
        [tabPath]: [rootPath]
      }));
      navigate(rootPath);
    } else {
      // Switch to the tab's last visited page or root
      const history = tabHistory[tabPath] || [];
      const targetPath = history.length > 0 ? history[history.length - 1] : createPageUrl(TAB_ROOTS[tabPath]);
      navigate(targetPath);
    }
  }, [currentPageName, tabHistory, navigate]);

  const navItems = [
    { icon: Home, label: 'Home', path: 'Home' },
    { icon: Search, label: 'Shop', path: 'Shop' },
    { icon: Store, label: 'In-Store', path: 'InStoreMode' },
    { icon: Heart, label: 'Wishlist', path: 'Wishlist' },
    { icon: User, label: 'Profile', path: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {children}
      
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-[var(--color-surface)] border-t border-[var(--color-border-light)] px-4 pt-2 z-50" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
          <div className="flex justify-around items-center max-w-md mx-auto">
            {navItems.map((item) => {
              const currentTab = getTabForPage(currentPageName);
              const isActive = currentTab === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleTabPress(item.path)}
                  className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-colors select-none ${
                    isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  <div className="relative">
                    <item.icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                    {item.path === 'Cart' && cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--color-accent)] text-[var(--color-text-primary)] text-[10px] rounded-full flex items-center justify-center font-medium">
                        {cartCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs ${isActive ? 'font-medium' : ''}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}