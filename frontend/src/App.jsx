import React, { useState, useEffect } from 'react';
import { api } from './lib/api';
import Particles from './components/Particles';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Catalog from './components/Catalog';
import ProductModal from './components/ProductModal';
import CartDrawer from './components/CartDrawer';
import CheckoutModal from './components/CheckoutModal';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import About from './components/About';
import Contact from './components/Contact';
import Footer from './components/Footer';

const FALLBACK_PRODUCTS = [
  {
    "id": 1,
    "name": "Covered In Roses",
    "category": "Women",
    "price": 180,
    "inStock": true,
    "description": "An opulent, passionate fragrance that drapes your senses in freshly cut ruby roses, sweet berries, and soft warm amber.",
    "notes": "Red Rose Petals, Sun-Ripened Berries, Velvet Amber",
    "image": "/images/products/women_placeholder.png"
  },
  {
    "id": 2,
    "name": "You’re The One",
    "category": "Women",
    "price": 180,
    "inStock": true,
    "description": "A beautiful, self-assured fragrance. A confident blend of velvet rose, white birch, and a drop of sweet strawberry nectar.",
    "notes": "Velvet Rose, White Birch, Strawberry Nectar",
    "image": "/images/products/women_placeholder.png"
  },
  {
    "id": 3,
    "name": "Champagne Toast",
    "category": "Women",
    "price": 180,
    "inStock": true,
    "description": "A celebratory spritz of bubbly champagne, sparkling berries, and juicy tangerine that evokes pure bliss and confidence.",
    "notes": "Bubbly Champagne, Sparkling Berries, Tangerine",
    "image": "/images/products/women_placeholder.png"
  },
  {
    "id": 4,
    "name": "Strawberry Pound Cake",
    "category": "Women",
    "price": 180,
    "inStock": true,
    "description": "A sweet, comforting treat of golden shortcake, rich whipped cream, and fresh vine-ripened strawberries.",
    "notes": "Fresh Strawberries, Golden Shortcake, Whipped Cream",
    "image": "/images/products/women_placeholder.png"
  },
  {
    "id": 5,
    "name": "Warm Vanilla Sugar",
    "category": "Women",
    "price": 180,
    "inStock": true,
    "description": "An iconic, comforting blend of creamy vanilla, sweet coconut, and white orchid, grounded by fresh sandalwood.",
    "notes": "Intense Vanilla, White Orchid, Sparkling Sugar, Sandalwood",
    "image": "/images/products/women_placeholder.png"
  },
  {
    "id": 6,
    "name": "In The Stars",
    "category": "Women",
    "price": 180,
    "inStock": true,
    "description": "A sparkling blend of starflower, sandalwood musk, sugared tangelo, white agarwood, and warm radiant amber.",
    "notes": "Starflower, Sandalwood Musk, Sugared Tangelo, White Agarwood, Amber",
    "image": "/images/products/women_placeholder.png"
  },
  {
    "id": 7,
    "name": "Vanilla Romance",
    "category": "Women",
    "price": 180,
    "inStock": true,
    "description": "A captivating, seductive vanilla laced with spicy cardamom, rich woods, and midnight jasmine.",
    "notes": "Madagascar Vanilla, Cardamom, Velvet Woods, Midnight Jasmine",
    "image": "/images/products/women_placeholder.png"
  },
  {
    "id": 8,
    "name": "A Thousand Wishes",
    "category": "Women",
    "price": 180,
    "inStock": true,
    "description": "Warm your heart a thousand times over with a festive blend of pink champagne, crystal peonies, and almond crème.",
    "notes": "Pink Champagne, Crystal Peonies, Velvet Amaretto, Almond Crème",
    "image": "/images/products/women_placeholder.png"
  },
  {
    "id": 9,
    "name": "Floral Fantasy",
    "category": "Women",
    "price": 180,
    "inStock": true,
    "description": "An ethereal garden breeze carrying notes of freshly bloomed lilies, dewy cherry blossoms, and sweet morning rainfall.",
    "notes": "Dewy Lilies, Cherry Blossom, Morning Rainfall, Sweet Oakmoss",
    "image": "/images/products/women_placeholder.png"
  },
  {
    "id": 10,
    "name": "Gingham",
    "category": "Women",
    "price": 180,
    "inStock": true,
    "description": "A fresh, vibrant, and happy celebration of bright blue freesia, sweet clementine, and soft violet petals.",
    "notes": "Blue Freesia, Sweet Clementine, Soft Violet Petals",
    "image": "/images/products/women_placeholder.png"
  },
  {
    "id": 11,
    "name": "Pure Wonder",
    "category": "Women",
    "price": 180,
    "inStock": true,
    "description": "Delight in a sense of wonder with this clean, sparkling blend of iced rosé, star jasmine, and warm white amber.",
    "notes": "Iced Rosé, Star Jasmine, Warm White Amber",
    "image": "/images/products/women_placeholder.png"
  },
  {
    "id": 12,
    "name": "Pink Tie Dye",
    "category": "Women",
    "price": 180,
    "inStock": true,
    "description": "A fun, artistic fragrance swirling with sun-kissed pink lady apples, wild cotton flower, and sweet sugar cane.",
    "notes": "Pink Lady Apple, Wild Cotton Flower, Sugared Cane",
    "image": "/images/products/women_placeholder.png"
  },
  {
    "id": 13,
    "name": "Touch Of Gold",
    "category": "Women",
    "price": 180,
    "inStock": true,
    "description": "Pure luxury bottled. Radiate majesty with golden honey, absolute jasmine, and a heavy trail of royal patchouli and musk.",
    "notes": "Golden Honey, Absolute Jasmine, Royal Patchouli, Warm Musk",
    "image": "/images/products/women_placeholder.png"
  },
  {
    "id": 14,
    "name": "First Sight",
    "category": "Men",
    "price": 150,
    "inStock": true,
    "description": "A magnetic and unforgettable first impression of fresh cedarwood, aromatic sage, and crisp mountain air.",
    "notes": "Fresh Cedarwood, Aromatic Sage, Crisp Air, Bergamot",
    "image": "/images/products/men_placeholder.png"
  },
  {
    "id": 15,
    "name": "Graphite",
    "category": "Men",
    "price": 150,
    "inStock": true,
    "description": "A bold, sophisticated blend of dark sage, rich leather, bergamot, and precious cedarwood.",
    "notes": "Dark Sage, Rich Leather, Italian Bergamot, Cedarwood",
    "image": "/images/products/men_placeholder.png"
  },
  {
    "id": 16,
    "name": "Black Tie",
    "category": "Men",
    "price": 150,
    "inStock": true,
    "description": "An elegant, formal fragrance featuring aromatic sage, warm tonka bean, rich sandalwood, and dark incense.",
    "notes": "Aromatic Sage, Dark Tonka Bean, Sandalwood, Incense",
    "image": "/images/products/men_placeholder.png"
  }
];

const App = () => {
  // Global States
  const [products, setProducts] = useState(FALLBACK_PRODUCTS);
  const [cart, setCart] = useState([]);
  const [activeSection, setActiveSection] = useState('home');
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Interface triggers
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [routePath, setRoutePath] = useState(() => window.location.pathname);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('omans_admin_token') || '');
  const [adminVerified, setAdminVerified] = useState(false);
  const [adminChecking, setAdminChecking] = useState(false);
  const isAdminRoute = routePath === '/admin';

  // Lagging mouse cursor glow coordinates
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [trailPos, setTrailPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const syncRoute = () => setRoutePath(window.location.pathname);
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  const navigateToStorefront = () => {
    window.history.replaceState({}, '', '/');
    setRoutePath('/');
  };

  // Initialize and load products from REST API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await api.get('/api/products');
        if (response.data && response.data.length > 0) {
          setProducts(response.data);
        }
      } catch (err) {
        console.warn('Backend server is down, running on static fallback list.', err);
      }
    };
    fetchProducts();
  }, []);

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

      setAdminChecking(true);
      try {
        const response = await api.get('/api/auth/verify', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
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
  }, [adminToken, isAdminRoute]);

  const saveCart = (updatedCart) => {
    setCart(updatedCart);
    localStorage.setItem('concierge_cart', JSON.stringify(updatedCart));
  };

  // Custom Cursor Glow Position tracking
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Lag ease coordinate updater
  useEffect(() => {
    let animationFrameId;
    const easeCursor = () => {
      setTrailPos(prev => {
        const dx = mousePos.x - prev.x;
        const dy = mousePos.y - prev.y;
        return {
          x: prev.x + dx * 0.1,
          y: prev.y + dy * 0.1
        };
      });
      animationFrameId = requestAnimationFrame(easeCursor);
    };
    easeCursor();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mousePos]);

  // Luxury startup loading window
  useEffect(() => {
    const delay = setTimeout(() => {
      setLoading(false);
    }, 2500);
    return () => clearTimeout(delay);
  }, []);

  // Cart operations
  const handleAddToCart = (product) => {
    const existingIndex = cart.findIndex(item => item.id === product.id && item.category === product.category);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      saveCart(updated);
    } else {
      saveCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const handleUpdateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      handleRemoveItem(productId);
      return;
    }
    const updated = cart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item);
    saveCart(updated);
  };

  const handleRemoveItem = (productId) => {
    const updated = cart.filter(item => item.id !== productId);
    saveCart(updated);
  };

  const handleClearCart = () => {
    saveCart([]);
    setIsCheckoutOpen(false);
    setIsCartOpen(false);
  };

  // Admin database callback triggers
  const handleProductAdded = (newProd) => {
    setProducts(prev => [...prev, newProd]);
  };

  const handleProductUpdated = (updatedProd) => {
    setProducts(prev => prev.map(p => p.id === updatedProd.id ? updatedProd : p));
    if (selectedProduct && selectedProduct.id === updatedProd.id) {
      setSelectedProduct(updatedProd);
    }
  };

  const handleProductDeleted = (id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    if (selectedProduct && selectedProduct.id === id) {
      setSelectedProduct(null);
    }
  };

  const handleAdminLogin = (token) => {
    localStorage.setItem('omans_admin_token', token);
    setAdminToken(token);
    setAdminVerified(true);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('omans_admin_token');
    setAdminToken('');
    setAdminVerified(false);
    navigateToStorefront();
  };

  // Scrolls to Catalog
  const handleExploreScroll = () => {
    const catalog = document.getElementById('catalog');
    if (catalog) {
      catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Floating immediate WhatsApp orders button (fixed back-to-top style helper)
  const handleWhatsAppConsultation = () => {
    const text = encodeURIComponent(
      "Hello Oman's Vogue! I am seeking a live consultation with a fragrance expert."
    );
    window.open(`https://wa.me/+233591259991?text=${text}`, '_blank');
  };

  if (isAdminRoute) {
    return (
      <>
        <div
          className="cursor-glow hidden lg:block"
          style={{ left: `${trailPos.x}px`, top: `${trailPos.y}px` }}
        />
        <div className="min-h-screen bg-luxury-black text-luxury-champagne selection:bg-luxury-rosegold/30 selection:text-white">
          <Particles />
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
          ) : adminVerified && adminToken ? (
            <AdminDashboard
              products={products}
              token={adminToken}
              onLogout={handleAdminLogout}
              onProductAdded={handleProductAdded}
              onProductUpdated={handleProductUpdated}
              onProductDeleted={handleProductDeleted}
            />
          ) : (
            <AdminLogin
              onLoginSuccess={handleAdminLogin}
              onCancel={navigateToStorefront}
            />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {/* 1. SECURE LAGGING CURSOR GLOW */}
      <div 
        className="cursor-glow hidden lg:block" 
        style={{ left: `${trailPos.x}px`, top: `${trailPos.y}px` }} 
      />

      {/* 2. DYNAMIC LUXURY LOADING SCREEN */}
      {loading ? (
        <div className="fixed inset-0 z-[100] bg-luxury-black flex flex-col items-center justify-center space-y-6">
          <div className="text-center space-y-2 animate-pulse">
            <span className="text-[10px] tracking-[0.6em] uppercase font-bold text-luxury-rosegold block mb-1">ATELIER</span>
            <h1 className="font-serif text-3xl sm:text-5xl tracking-[0.25em] text-white uppercase font-black">
              OMAN'S VOGUE
            </h1>
          </div>
          {/* Shimmer loading spinner */}
          <div className="relative w-48 h-[1px] bg-white/10 overflow-hidden">
            <div className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-luxury-gold to-luxury-rosegold animate-infinite translate-x-[-100%]" style={{ animation: 'shimmer 1.5s infinite linear' }} />
          </div>
          <style>{`
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(300%); }
            }
          `}</style>
        </div>
      ) : (
        <div className="min-h-screen bg-luxury-black text-luxury-champagne flex flex-col justify-between selection:bg-luxury-rosegold/30 selection:text-white">
          
          {/* 3. DYNAMIC INTERACTIVE BACKDROP CANVAS PARTICLES */}
          <Particles />

          {/* 4. NAVBAR HEADER */}
          <Navbar 
            activeSection={activeSection} 
            setActiveSection={setActiveSection} 
            cartCount={cart.reduce((acc, item) => acc + item.quantity, 0)}
            onOpenCart={() => setIsCartOpen(true)}
          />

          {/* 5. HERO PANEL */}
          <Hero onExploreClick={handleExploreScroll} />

          {/* 6. MAIN CONTENT ROUTINGS */}
          <main className="flex-grow">
            
            {/* Catalog Grid Section */}
            <Catalog 
              products={products}
              onSelectProduct={setSelectedProduct}
              onAddToCart={handleAddToCart}
              activeSection={activeSection}
              setActiveSection={setActiveSection}
            />

            {/* Stories/Heritage Section */}
            <About />

            {/* Contact Concierge Portal */}
            <Contact />

          </main>

          {/* 7. FOOTER concierges */}
          <Footer setActiveSection={setActiveSection} />

          {/* 8. IMMERSIVE PRODUCT DETAILS POP-UP MODAL */}
          {selectedProduct && (
            <ProductModal 
              product={selectedProduct}
              onClose={() => setSelectedProduct(null)}
              onAddToCart={handleAddToCart}
              isInCart={cart.some(item => item.id === selectedProduct.id && item.category === selectedProduct.category)}
            />
          )}

          {/* 9. SECURE SHOPPING CART SLIDING DRAWER */}
          <CartDrawer 
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            cartItems={cart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onCheckout={() => {
              setIsCartOpen(false);
              setIsCheckoutOpen(true);
            }}
          />

          {/* 10. BILLING SECURE PLACEHOLDER PANEL */}
          <CheckoutModal 
            isOpen={isCheckoutOpen}
            onClose={() => setIsCheckoutOpen(false)}
            cartItems={cart}
            onClearCart={handleClearCart}
          />

          {/* 11. FLOATING WHATSAPP ASSISTANT BUTTON */}
          <button
            onClick={handleWhatsAppConsultation}
            className="fixed bottom-6 right-6 z-40 p-4 bg-green-600 hover:bg-green-500 hover:scale-105 active:scale-95 text-white transition-all rounded-full shadow-lg shadow-green-900/30 flex items-center justify-center animate-bounce hover:animate-none"
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
      )}
    </>
  );
};

export default App;
