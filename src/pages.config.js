/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Cart from './pages/Cart';
import Closet from './pages/Closet';
import Checkout from './pages/Checkout';
import Feedback from './pages/Feedback';
import Home from './pages/Home';
import InStoreMode from './pages/InStoreMode';
import Onboarding from './pages/Onboarding';
import ProductDetail from './pages/ProductDetail';
import Profile from './pages/Profile';
import Shop from './pages/Shop';
import TryOn from './pages/TryOn';
import Wishlist from './pages/Wishlist';
import Friends from './pages/Friends';
import Notifications from './pages/Notifications';
import FAQ from './pages/FAQ';
import Support from './pages/Support';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Cart": Cart,
    "Closet": Closet,
    "Checkout": Checkout,
    "Feedback": Feedback,
    "Home": Home,
    "InStoreMode": InStoreMode,
    "Onboarding": Onboarding,
    "ProductDetail": ProductDetail,
    "Profile": Profile,
    "Shop": Shop,
    "TryOn": TryOn,
    "Wishlist": Wishlist,
    "Friends": Friends,
    "Notifications": Notifications,
    "FAQ": FAQ,
    "Support": Support,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};