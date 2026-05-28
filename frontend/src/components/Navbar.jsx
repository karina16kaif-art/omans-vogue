import React, { useState, useEffect } from 'react';
import { ShoppingBag, Menu, X, ShieldAlert } from 'lucide-react';

const Navbar = ({ activeSection, setActiveSection, cartCount, onOpenCart }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 30) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'women', label: "Women's Collection" },
    { id: 'men', label: "Men's Collection" },
    { id: 'all-products', label: 'All Products' },
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' },
  ];

  const handleNavClick = (sectionId) => {
    setActiveSection(sectionId);
    setMobileMenuOpen(false);
    
    // Smooth scroll down to appropriate content blocks if needed
    const targetElement = document.getElementById(sectionId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav 
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 px-6 md:px-12 py-4 ${
        isScrolled 
          ? 'bg-luxury-black/85 backdrop-blur-md border-b border-luxury-rosegold/10 shadow-lg py-3' 
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          onClick={() => handleNavClick('home')}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <span className="text-2xl md:text-3xl font-serif font-black tracking-widest text-gold-gradient group-hover:scale-105 transition-transform duration-300">
            OMAN'S VOGUE
          </span>
        </div>

        {/* Desktop Navigation Links */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => handleNavClick(link.id)}
              className={`relative font-sans text-xs uppercase tracking-widest font-semibold transition-all duration-300 py-1 hover:text-white ${
                activeSection === link.id 
                  ? 'text-luxury-rosegold font-bold' 
                  : 'text-luxury-champagne/80'
              }`}
            >
              {link.label}
              {activeSection === link.id && (
                <span className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-luxury-gold to-luxury-rosegold animate-pulse"></span>
              )}
            </button>
          ))}
        </div>

        {/* Action Panel: Cart */}
        <div className="flex items-center gap-4">
          {/* Cart Trigger Button */}
          <button 
            onClick={onOpenCart}
            className="relative p-2.5 rounded-full border border-luxury-rosegold/10 hover:border-luxury-rosegold/30 hover:bg-luxury-charcoal/50 text-luxury-champagne hover:text-white transition-all duration-300 group"
          >
            <ShoppingBag size={18} className="group-hover:scale-110 transition-transform" />
            
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 border border-luxury-black animate-pulse shadow-md shadow-luxury-wine/50">
                {cartCount}
              </span>
            )}
          </button>

          {/* Mobile Menu Toggle Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-full border border-luxury-rosegold/10 text-luxury-champagne hover:text-white transition-all duration-300"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation Panel */}
      <div 
        className={`fixed inset-y-0 right-0 w-80 bg-luxury-black/98 backdrop-blur-xl border-l border-luxury-rosegold/10 z-40 transform transition-transform duration-500 ease-out shadow-2xl p-8 flex flex-col justify-between ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="mt-16 flex flex-col gap-6">
          <div className="pb-4 border-b border-luxury-rosegold/10">
            <span className="font-serif tracking-widest text-lg font-bold text-gold-gradient">NAVIGATE</span>
          </div>
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => handleNavClick(link.id)}
              className={`font-sans text-sm uppercase tracking-widest text-left py-2 font-medium transition-all ${
                activeSection === link.id 
                  ? 'text-luxury-rosegold pl-4 border-l border-luxury-rosegold font-bold' 
                  : 'text-luxury-champagne/70 pl-0 hover:text-white hover:pl-2'
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="border-t border-luxury-rosegold/10 pt-6">
          <p className="text-[10px] text-luxury-champagne/40 uppercase tracking-widest text-center">
            OMAN'S VOGUE © 2026
          </p>
        </div>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 lg:hidden"
        />
      )}
    </nav>
  );
};

export default Navbar;
