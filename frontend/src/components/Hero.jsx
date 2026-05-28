import React from 'react';
import { Send, ArrowDown } from 'lucide-react';

const Hero = ({ onExploreClick }) => {
  const WHATSAPP_NUMBER = '+233591259991';
  
  const handleWhatsAppChat = () => {
    const text = encodeURIComponent(
      "Hello Oman's Vogue! I am visiting your virtual luxury store and would like to seek fragrance recommendations for my personal inner growth. Please guide me through your collections!"
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank');
  };

  return (
    <section id="home" className="relative w-screen h-screen overflow-hidden flex items-center justify-center bg-luxury-black">
      
      {/* Cinematic Background Layer */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-luxury-black via-luxury-black/40 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-luxury-black via-transparent to-luxury-black/30 z-10" />
        <img 
          src="/images/hero_bg.png" 
          alt="Cinematic Perfume Spray" 
          className="w-full h-full object-cover object-center scale-105 hero-pan-zoom"
        />
      </div>

      {/* Floating Sparkles and Orbs Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none mix-blend-screen opacity-65">
        <div className="absolute top-[20%] left-[30%] w-[350px] h-[350px] bg-luxury-wine/25 rounded-full filter blur-[120px] animate-pulse" />
        <div className="absolute bottom-[20%] right-[25%] w-[400px] h-[400px] bg-luxury-rosegold/15 rounded-full filter blur-[140px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Front-Facing Content Wrapper */}
      <div className="relative z-20 max-w-5xl mx-auto px-6 text-center flex flex-col items-center justify-center h-full pt-16">
        
        {/* Subtle Luxury Subtitle */}
        <div className="mb-4 md:mb-6 overflow-hidden">
          <span className="inline-block text-[10px] md:text-xs tracking-[0.4em] uppercase font-bold text-luxury-rosegold text-reveal">
            L'ART DE LA PARFUMERIE
          </span>
        </div>

        {/* Major Editorial Headline */}
        <h1 className="font-serif text-4xl sm:text-6xl md:text-8xl tracking-widest uppercase mb-6 leading-tight select-none">
          <span className="block text-white opacity-95">WELCOME TO</span>
          <span className="block text-gold-gradient font-black mt-2 filter drop-shadow-[0_2px_15px_rgba(212,175,55,0.2)]">
            OMAN'S VOGUE
          </span>
        </h1>

        {/* Emotionally Charged Philosophy Text */}
        <div className="max-w-2xl mb-10 overflow-hidden">
          <p className="font-sans text-sm sm:text-base md:text-lg text-luxury-champagne/80 font-light tracking-wide leading-relaxed text-reveal" style={{ animationDelay: '0.4s' }}>
            “HERE ARE THE PERFECT COLLECTIONS FOR YOUR PERSONAL INNER GROWTH”
          </p>
        </div>

        {/* CTA Button Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-5 justify-center w-full max-w-md">
          {/* Action 1: Catalog Scroll */}
          <button 
            onClick={onExploreClick}
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white text-xs uppercase tracking-widest font-bold rounded-none border border-luxury-rosegold/30 transition-all duration-300 transform hover:scale-[1.03] hover:shadow-[0_0_25px_rgba(183,110,121,0.4)] btn-shimmer group"
          >
            <span className="flex items-center justify-center gap-2">
              Explore Collections
              <ArrowDown size={12} className="group-hover:translate-y-0.5 transition-transform" />
            </span>
          </button>

          {/* Action 2: Direct WhatsApp consultation */}
          <button 
            onClick={handleWhatsAppChat}
            className="w-full sm:w-auto px-8 py-4 bg-transparent text-luxury-gold text-xs uppercase tracking-widest font-bold rounded-none border border-luxury-gold/40 hover:border-luxury-gold hover:bg-luxury-gold/5 transition-all duration-300 transform hover:scale-[1.03]"
          >
            <span className="flex items-center justify-center gap-2">
              Order on WhatsApp
              <Send size={12} />
            </span>
          </button>
        </div>

        {/* Scrolling Indicator */}
        <div 
          onClick={onExploreClick}
          className="absolute bottom-8 cursor-pointer flex flex-col items-center gap-2 animate-bounce opacity-50 hover:opacity-100 transition-opacity"
        >
          <span className="text-[9px] uppercase tracking-[0.3em] font-semibold text-luxury-champagne/70">Scroll To Explore</span>
          <ArrowDown size={14} className="text-luxury-rosegold" />
        </div>

      </div>

    </section>
  );
};

export default Hero;
