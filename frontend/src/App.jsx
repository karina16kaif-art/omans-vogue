import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './lib/api';
import Particles from './components/Particles';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Catalog from './components/Catalog';
import About from './components/About';
import Contact from './components/Contact';
import Footer from './components/Footer';
import SeoMeta from './components/SeoMeta';
import { ShopByCollection, ProductShowcases, FulfilmentInfo } from './components/StorefrontSections';
import { cartKey, lineKey, memberships, optionAvailable, optionPrice, visibleCollections } from './lib/catalogue';

const ProductModal = lazy(() => import('./components/ProductModal'));
const CartDrawer = lazy(() => import('./components/CartDrawer'));
const CheckoutModal = lazy(() => import('./components/CheckoutModal'));
const ModalLoading = () => <p role="status" className="fixed bottom-4 left-4 z-50 bg-luxury-charcoal px-4 py-2 text-sm">Loading…</p>;

const AdminDashboard = lazy(() => import('./components/AdminConsole'));
const AdminLogin = lazy(() => import('./components/AdminLogin'));

const DEFAULT_BRAND_SETTINGS = {
  brandName: "OMAN'S VOGUE",
  heroEyebrow: "L'ART DE LA PARFUMERIE",
  heroHeadlinePrefix: 'WELCOME TO',
  heroSubtitle: '“HERE ARE THE PERFECT COLLECTIONS FOR YOUR PERSONAL INNER GROWTH”',
  heroBackgroundImage: '/images/hero_bg.png',
  heroBackgroundWebp: '/images/hero_bg.webp',
  whatsappNumber: '+233591259991',
  pickupLocation: 'Jean Nelson Hostel, University of Ghana, Legon',
  campusDeliveryFee: 10,
  storefront: {}
};

const App = () => {
  // Global States
  const [products, setProducts] = useState([]);
  const [brandSettings, setBrandSettings] = useState(DEFAULT_BRAND_SETTINGS);
  const [cart, setCart] = useState([]);
  const [activeSection, setActiveSection] = useState('home');
  const [collection, setCollection] = useState('');
  const [bestSellers, setBestSellers] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Interface triggers
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutReceipt, setCheckoutReceipt] = useState(null);
  const [catalogueLoaded, setCatalogueLoaded] = useState(false);
  const [catalogueError, setCatalogueError] = useState('');
  const [adminSettingsState, setAdminSettingsState] = useState('loading');
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const storefrontRequest = useRef(null);
  const [routePath, setRoutePath] = useState(() => window.location.pathname);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('omans_admin_token') || '');
  const [adminVerified, setAdminVerified] = useState(false);
  const [adminChecking, setAdminChecking] = useState(false);
  const verifiedToken = useRef('');
  const isAdminRoute = /^\/admin\/?$/.test(routePath);

  useEffect(() => {
    const syncRoute = () => setRoutePath(window.location.pathname);
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  const navigateToStorefront = useCallback(() => {
    window.history.replaceState({}, '', '/');
    setRoutePath('/');
  }, []);

  const authHeaders = useMemo(
    () => adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
    [adminToken]
  );

  const fetchStorefront = useCallback(async () => {
    if (isAdminRoute || storefrontRequest.current) return;
    const request = new AbortController();
    storefrontRequest.current = request;
    setCatalogueError('');
    try {
      let storefrontData;
      try {
        ({ data: storefrontData } = await api.get('/api/storefront/catalogue', { signal: request.signal }));
      } catch (error) {
        if (error.response?.status !== 404) throw error;
        // Older backends can still serve the published storefront during cutover.
        const [{ data: products }, { data: settings }] = await Promise.all([
          api.get('/api/products', { signal: request.signal }),
          api.get('/api/settings', { signal: request.signal })
        ]);
        storefrontData = { products, settings, bestSellers: [] };
      }
      if (request.signal.aborted) return;
      if (!Array.isArray(storefrontData?.products) || !storefrontData.settings) throw new Error('Invalid catalogue response.');
      const { momoNumber, momoAccountName, ...publicSettings } = storefrontData.settings;
      setBrandSettings({ ...DEFAULT_BRAND_SETTINGS, ...publicSettings });
      setProducts(storefrontData.products);
      setSelectedProduct(current => current ? storefrontData.products.find(product =>
        String(product.id) === String(current.id)) ?? null : null);
      setBestSellers(storefrontData.bestSellers || []);
      setCatalogueLoaded(true);
    } catch {
      if (request.signal.aborted) return;
      setProducts([]);
      setBestSellers([]);
      setSelectedProduct(null);
      setCatalogueError('The catalogue could not be loaded. Try again.');
    } finally {
      if (storefrontRequest.current === request) storefrontRequest.current = null;
    }
  }, [isAdminRoute]);

  useEffect(() => {
    if (isAdminRoute) return;
    fetchStorefront();
    window.addEventListener('focus', fetchStorefront);
    return () => {
      storefrontRequest.current?.abort();
      storefrontRequest.current = null;
      window.removeEventListener('focus', fetchStorefront);
    };
  }, [fetchStorefront, isAdminRoute]);

  const fetchBrandSettings = useCallback(async (signal, resetForm = false) => {
    if (!isAdminRoute || !adminVerified) return;
    setAdminSettingsState(current => current === 'ready' && !resetForm ? current : 'loading');
    try {
      const { data } = await api.get('/api/admin/settings', { headers: authHeaders, signal });
      if (signal?.aborted) return;
      if (!data || typeof data !== 'object') throw new Error('Invalid store settings.');
      setBrandSettings({ ...DEFAULT_BRAND_SETTINGS, ...data });
      setAdminSettingsState('ready');
    } catch {
      if (!signal?.aborted) setAdminSettingsState('error');
    }
  }, [adminVerified, authHeaders, isAdminRoute]);

  useEffect(() => {
    const request = new AbortController();
    fetchBrandSettings(request.signal);
    return () => request.abort();
  }, [fetchBrandSettings]);

  const storefront = brandSettings.storefront || DEFAULT_BRAND_SETTINGS.storefront;
  const currentCollection = visibleCollections(storefront).some(([key]) => key === collection) ? collection : '';

  // Sync Cart to/from local storage
  useEffect(() => {
    if (isAdminRoute) return;

    const cachedCart = localStorage.getItem('concierge_cart');
    if (cachedCart) {
      try {
        setCart(JSON.parse(cachedCart));
      } catch (err) {
        console.error('Failed to parse cached cart details.', err);
      }
    }
  }, [isAdminRoute]);

  useEffect(() => {
    if (!isAdminRoute) return;

    const verifyAdmin = async () => {
      if (!adminToken) {
        setAdminVerified(false);
        return;
      }

      if (verifiedToken.current === adminToken) return;
      setAdminChecking(true);
      try {
        const response = await api.get('/api/auth/verify', { headers: authHeaders });
        if (response.data?.valid) verifiedToken.current = adminToken;
        setAdminVerified(Boolean(response.data?.valid));
      } catch (err) {
        console.warn('Stored admin session is invalid or expired.', err);
        localStorage.removeItem('omans_admin_token');
        setAdminToken('');
        setAdminVerified(false);
      } finally {
        setAdminChecking(false);
      }
    };

    verifyAdmin();
  }, [adminToken, authHeaders, isAdminRoute]);

  // A cart line identifies both the product and the selected variant.
  const updateCart = useCallback((update) => {
    setCart(previous => {
      const next = update(previous);
      localStorage.setItem('concierge_cart', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleAddToCart = useCallback((product, variant) => {
    const option = variant ?? product;
    if (!optionAvailable(product, option) || (product.variants?.length && !variant)) return;
    const variantId = variant?.id ?? null;
    const key = lineKey(product.id, variantId);
    const item = {
      id: product.id, variantId, variantLabel: variant?.label, name: product.name,
      sizeMl: option.sizeMl, image: product.image, price: optionPrice(option), stockQuantity: option.stockQuantity, quantity: 1
    };
    updateCart(previous => {
      const existing = previous.find(entry => cartKey(entry) === key);
      if (!existing) return [...previous, item];
      const quantity = Math.min(existing.quantity + 1, option.stockQuantity ?? 99, 99);
      return previous.map(entry => cartKey(entry) === key ? { ...item, quantity } : entry);
    });
  }, [updateCart]);

  const handleRemoveItem = useCallback((key) => {
    updateCart(previous => previous.filter(item => cartKey(item) !== key));
  }, [updateCart]);

  const handleUpdateQuantity = useCallback((key, newQuantity) => {
    updateCart(previous => newQuantity <= 0
      ? previous.filter(item => cartKey(item) !== key)
      : previous.map(item => cartKey(item) === key
        ? { ...item, quantity: Math.min(newQuantity, item.stockQuantity ?? 99, 99) }
        : item));
  }, [updateCart]);

  const openCheckout = useCallback(() => {
    setCheckoutReceipt(null);
    setCheckoutStarted(true);
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  }, []);

  const handleProductCheckout = useCallback((product, variant) => {
    if (product.variants?.length && !variant) {
      setSelectedProduct(product);
      return;
    }
    if (!optionAvailable(product, variant ?? product)) return;
    const key = lineKey(product.id, variant?.id);
    if (!cart.some(item => cartKey(item) === key)) handleAddToCart(product, variant);
    setSelectedProduct(null);
    openCheckout();
  }, [cart, handleAddToCart, openCheckout]);

  const handleOrderSaved = useCallback((receipt, items) => {
    setCheckoutReceipt(receipt);
    const purchased = new Map(items.map(item => [lineKey(item.productId, item.variantId), item.quantity]));
    updateCart(previous => previous
      .map(item => ({ ...item, quantity: item.quantity - (purchased.get(cartKey(item)) || 0) }))
      .filter(item => item.quantity > 0));
    fetchStorefront();
  }, [updateCart, fetchStorefront]);

  const handleAdminLogin = useCallback((token) => {
    verifiedToken.current = token;
    localStorage.setItem('omans_admin_token', token);
    setAdminToken(token);
    setAdminVerified(true);
  }, []);

  const handleAdminLogout = useCallback(() => {
    verifiedToken.current = '';
    localStorage.removeItem('omans_admin_token');
    setAdminToken('');
    setAdminVerified(false);
    setAdminSettingsState('loading');
    navigateToStorefront();
  }, []);

  const handleBrandSettingsUpdated = useCallback((settings) => {
    setBrandSettings({ ...DEFAULT_BRAND_SETTINGS, ...(settings || {}) });
  }, []);

  // Scrolls to Catalog
  const handleExploreScroll = useCallback(() => {
    const catalog = document.getElementById('catalog');
    if (catalog) {
      catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // WhatsApp concierge chat
  const handleWhatsAppConsultation = useCallback(() => {
    const text = encodeURIComponent(
      `Hello ${brandSettings.brandName}! I am seeking a live consultation with a fragrance expert.`
    );
    window.open(`https://wa.me/${(brandSettings.storefront?.contact?.whatsapp || brandSettings.whatsappNumber).replace(/\D/g, '')}?text=${text}`, '_blank');
  }, [brandSettings.brandName, brandSettings.whatsappNumber, brandSettings.storefront]);

  const cartCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const selectCollection = useCallback((key) => {
    setCollection(key);
    setActiveSection(key || 'all-products');
    handleExploreScroll();
  }, [handleExploreScroll]);

  const handleNavigation = useCallback((section) => {
    if (section === 'all-products') setCollection('');
    if (section === 'women' || section === 'men') setCollection(section);
    setActiveSection(section);
  }, []);

  const relatedProducts = useMemo(() => {
    if (!selectedProduct) return [];
    const groups = memberships(selectedProduct, storefront);
    return products.filter(product => {
      if (String(product.id) === String(selectedProduct.id)) return false;
      return (selectedProduct.brand && selectedProduct.brand === product.brand) ||
        [...memberships(product, storefront)].some(group => groups.has(group));
    }).slice(0, 3);
  }, [selectedProduct, products, storefront]);

  if (isAdminRoute) {
    return (
      <>
        <SeoMeta products={products} brandSettings={brandSettings} isAdminRoute={isAdminRoute} />
        <div className="min-h-screen bg-luxury-black text-luxury-champagne selection:bg-luxury-rosegold/30 selection:text-white">
          {adminChecking ? (
            <div className="relative z-10 min-h-screen flex items-center justify-center">
              <div className="text-center space-y-4">
                <span className="text-[10px] tracking-[0.45em] uppercase font-bold text-luxury-rosegold">
                  Verifying Atelier Access
                </span>
                <div className="w-44 h-[1px] bg-white/10 overflow-hidden mx-auto">
                  <div className="h-full w-1/3 bg-gradient-to-r from-luxury-gold to-luxury-rosegold animate-pulse" />
                </div>
              </div>
            </div>
          ) : (
            <Suspense fallback={
              <div className="relative z-10 min-h-screen flex items-center justify-center">
                <span className="text-[10px] tracking-[0.45em] uppercase font-bold text-luxury-rosegold">
                  Preparing Atelier Console
                </span>
              </div>
            }>
              {adminVerified && adminToken ? (
                <AdminDashboard
                  token={adminToken}
                  onLogout={handleAdminLogout}
                  onAdminTokenUpdated={handleAdminLogin}
                  brandSettings={brandSettings}
                  adminSettingsState={adminSettingsState}
                  onBrandSettingsUpdated={handleBrandSettingsUpdated}
                  onBrandSettingsRefresh={() => fetchBrandSettings(undefined, true)}
                />
              ) : (
                <AdminLogin
                  onLoginSuccess={handleAdminLogin}
                  onCancel={navigateToStorefront}
                />
              )}
            </Suspense>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <SeoMeta products={products} brandSettings={brandSettings} isAdminRoute={isAdminRoute} />
        <div className="min-h-screen bg-luxury-black text-luxury-champagne flex flex-col justify-between selection:bg-luxury-rosegold/30 selection:text-white">
          
          {/* 3. DYNAMIC INTERACTIVE BACKDROP CANVAS PARTICLES */}
          <Particles />

          {/* 4. NAVBAR HEADER */}
          <Navbar 
            activeSection={activeSection} 
            setActiveSection={handleNavigation}
            cartCount={cartCount}
            onOpenCart={() => setIsCartOpen(true)}
            brandSettings={brandSettings}
          />

          {/* 5. HERO PANEL */}
          <Hero onExploreClick={handleExploreScroll} brandSettings={brandSettings} />

          {/* 6. MAIN CONTENT ROUTINGS */}
          <main className="flex-grow">
            
            <ShopByCollection settings={storefront} onSelectCollection={selectCollection} />

            <Catalog 
              products={products}
              pending={!catalogueLoaded && !catalogueError}
              error={catalogueError}
              onReload={fetchStorefront}
              settings={storefront}
              collection={currentCollection}
              onCollectionChange={setCollection}
              onSelectProduct={setSelectedProduct}
              onCheckout={handleProductCheckout}
            />

            <ProductShowcases products={products} settings={storefront} ranks={bestSellers}
              onSelectProduct={setSelectedProduct} onCheckout={handleProductCheckout} />
            <FulfilmentInfo brandSettings={brandSettings} />

            {/* Stories/Heritage Section */}
            <About />

            {/* Contact Concierge Portal */}
            <Contact brandSettings={brandSettings} />

          </main>

          {/* 7. FOOTER concierges */}
          <Footer setActiveSection={handleNavigation} brandSettings={brandSettings} />

          {/* 8. IMMERSIVE PRODUCT DETAILS POP-UP MODAL */}
          <Suspense fallback={<ModalLoading />}>
          {selectedProduct && (
            <ProductModal 
              key={selectedProduct.id}
              product={selectedProduct}
              settings={storefront}
              relatedProducts={relatedProducts}
              onSelectProduct={setSelectedProduct}
              cart={cart}
              onClose={() => setSelectedProduct(null)}
              onAddToCart={handleAddToCart}
              onCheckout={handleProductCheckout}
            />
          )}

          {/* 9. SECURE SHOPPING CART SLIDING DRAWER */}
          {isCartOpen && <CartDrawer
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            cartItems={cart}
            currentProducts={catalogueLoaded && !catalogueError ? products : null}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onCheckout={openCheckout}
            onResumeOrder={checkoutReceipt ? () => {
              setIsCartOpen(false);
              setIsCheckoutOpen(true);
            } : undefined}
          />}

          {/* 10. CHECKOUT */}
          {checkoutStarted && <CheckoutModal
            isOpen={isCheckoutOpen}
            onClose={() => setIsCheckoutOpen(false)}
            cartItems={cart}
            receipt={checkoutReceipt}
            onOrderSaved={handleOrderSaved}
          />}
          </Suspense>

          {/* 11. FLOATING WHATSAPP ASSISTANT BUTTON */}
          <button
            onClick={handleWhatsAppConsultation}
            className="fixed bottom-6 right-6 z-40 p-4 bg-green-600 hover:bg-green-500 hover:scale-105 active:scale-95 text-white transition-all rounded-full shadow-lg shadow-green-900/30 flex items-center justify-center"
            title="Chat with Concierge"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 448 512" 
              className="w-5 h-5 fill-current"
            >
              <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L3 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
            </svg>
          </button>

        </div>
    </>
  );
};

export default App;
