import React from 'react';
import { ShieldCheck, ArrowUp } from 'lucide-react';

const Footer = ({ setActiveSection, brandSettings }) => {
  const WHATSAPP_NUMBER = brandSettings?.whatsappNumber || '+233591259991';
  const brandName = brandSettings?.brandName || "OMAN'S VOGUE";
  const INSTAGRAM_HANDLE = 'Eugeniaa..a';

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveSection('home');
  };

  return (
    <footer className="relative bg-luxury-black border-t border-luxury-rosegold/10 pt-20 pb-8 z-10">
      
      {/* Upper footer grid */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-12 mb-16 text-center md:text-left">
        
        {/* Brand Column */}
        <div className="space-y-4 md:col-span-1">
          <span className="font-serif tracking-widest text-2xl font-black text-gold-gradient block">
            {brandName}
          </span>
          <p className="text-[10px] text-luxury-champagne/50 font-light leading-relaxed">
            Crafting luxury fragrance collections to serve as daily sensory anchors aligning your posture with personal inner growth.
          </p>
          {/* Visual payment indicators */}
          <div className="pt-2">
            <span className="text-[8px] uppercase tracking-widest text-luxury-champagne/40 block mb-2 font-semibold">Accepted Atelier Exchanges</span>
            <div className="flex gap-2 justify-center md:justify-start items-center">
              <span className="px-2.5 py-1 text-[8px] bg-luxury-charcoal text-luxury-champagne border border-white/5 font-mono uppercase font-black tracking-wider">MoMo</span>
              <span className="px-2.5 py-1 text-[8px] bg-luxury-charcoal text-luxury-champagne border border-white/5 font-mono uppercase font-black tracking-wider">Visa</span>
              <span className="px-2.5 py-1 text-[8px] bg-luxury-charcoal text-luxury-champagne border border-white/5 font-mono uppercase font-black tracking-wider">Mastercard</span>
            </div>
          </div>
        </div>

        {/* Collections links */}
        <div className="space-y-4">
          <h4 className="text-[10px] uppercase font-bold tracking-widest text-luxury-rosegold">COLLECTIONS</h4>
          <ul className="space-y-2 text-[11px] text-luxury-champagne/70 font-light">
            <li>
              <button onClick={() => { setActiveSection('women'); document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-white transition-colors">
                Women's Collection (GHS 180)
              </button>
            </li>
            <li>
              <button onClick={() => { setActiveSection('men'); document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-white transition-colors">
                Men's Collection (GHS 150)
              </button>
            </li>
            <li>
              <button onClick={() => { setActiveSection('all-products'); document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-white transition-colors">
                All Products Catalog
              </button>
            </li>
          </ul>
        </div>

        {/* Brand Philosophy links */}
        <div className="space-y-4">
          <h4 className="text-[10px] uppercase font-bold tracking-widest text-luxury-rosegold">THE BRAND</h4>
          <ul className="space-y-2 text-[11px] text-luxury-champagne/70 font-light">
            <li>
              <button onClick={() => { setActiveSection('about'); document.getElementById('about').scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-white transition-colors">
                Heritage Story
              </button>
            </li>
            <li>
              <a href={`https://instagram.com/${INSTAGRAM_HANDLE}`} target="_blank" rel="noreferrer" className="hover:text-white transition-colors block">
                Instagram Concierge Journal
              </a>
            </li>
            <li>
              <button onClick={() => { setActiveSection('contact'); document.getElementById('contact').scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-white transition-colors">
                Collaborations
              </button>
            </li>
          </ul>
        </div>

        {/* Concierge support */}
        <div className="space-y-4">
          <h4 className="text-[10px] uppercase font-bold tracking-widest text-luxury-rosegold">concierge</h4>
          <ul className="space-y-2 text-[11px] text-luxury-champagne/70 font-light">
            <li className="flex items-center justify-center md:justify-start gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
              <span>Live Support Online</span>
            </li>
            <li>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" className="text-white font-mono hover:text-luxury-gold transition-colors">
                Concierge Hotline: {WHATSAPP_NUMBER}
              </a>
            </li>
            <li>
              <span className="text-[10px] text-luxury-champagne/40 block">Daily Dispatch: 8:00 AM - 9:00 PM</span>
            </li>
          </ul>
        </div>

      </div>

      {/* Lower footer segment */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 pt-8 border-t border-luxury-rosegold/5 flex flex-col md:flex-row justify-between items-center gap-4">
        
        <div className="flex items-center gap-1.5 text-[9px] text-luxury-champagne/40 uppercase tracking-wider font-semibold">
          <ShieldCheck size={11} className="text-luxury-gold" />
          <span>{brandName} © 2026. All rights secured.</span>
        </div>

        {/* Scroll back to top button */}
        <button
          onClick={scrollToTop}
          className="p-2 border border-luxury-rosegold/10 text-luxury-champagne hover:text-white hover:border-luxury-rosegold/30 transition-all rounded-full flex items-center justify-center gap-1.5 px-4 text-[9px] uppercase tracking-widest font-bold"
        >
          <ArrowUp size={11} />
          concierge top
        </button>

      </div>

    </footer>
  );
};

export default Footer;
