import React from 'react';
import { Compass, Eye, Heart } from 'lucide-react';

const About = () => {
  return (
    <section id="about" className="relative max-w-7xl mx-auto px-6 md:px-12 py-24 z-10 border-t border-luxury-rosegold/5">
      
      {/* Header */}
      <div className="text-center mb-16">
        <span className="text-[10px] tracking-[0.35em] uppercase font-bold text-luxury-rosegold block mb-3">
          NOTRE HISTOIRE
        </span>
        <h2 className="font-serif text-3xl sm:text-5xl tracking-widest uppercase text-white font-extrabold mb-4">
          THE HOUSE OF OMAN
        </h2>
        <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-luxury-rosegold to-transparent mx-auto" />
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* Text Story Column */}
        <div className="space-y-6">
          <h3 className="font-serif text-lg tracking-wider text-luxury-gold uppercase font-bold">
            Fragrance Architectured For Personal Inner Growth
          </h3>
          
          <p className="text-xs sm:text-sm text-luxury-champagne/80 font-light leading-relaxed">
            At OMAN’S VOGUE, we believe a fragrance is never merely a cosmetic accessory; it is an invisible armor, a silent narrator, and a powerful catalyst for your personal inner evolution. Founded on the principle of self-actualization, each perfume we curate is a milestone in your journey of growth.
          </p>

          <p className="text-xs sm:text-sm text-luxury-champagne/80 font-light leading-relaxed">
            Every notes composition is meticulously selected to capture emotional landmarks. From the initial spark of confidence offered by our sparkling citrus clementines to the grounded, deep majesty of velvet rose, royal patchouli, and sacred woods, our creations serve as daily sensory anchors aligning your posture with your highest aspirations.
          </p>

          {/* Pillars List */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
            <div className="p-4 glass-panel border border-luxury-rosegold/10 text-center space-y-2">
              <Compass size={18} className="text-luxury-rosegold mx-auto mb-1 animate-pulse" />
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-white">Sovereignty</h4>
              <p className="text-[9px] text-luxury-champagne/50 leading-relaxed font-light">Bold, leading presence in any room.</p>
            </div>
            <div className="p-4 glass-panel border border-luxury-rosegold/10 text-center space-y-2">
              <Heart size={18} className="text-luxury-rosegold mx-auto mb-1 animate-pulse" />
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-white">Affection</h4>
              <p className="text-[9px] text-luxury-champagne/50 leading-relaxed font-light">Warm, inviting velvet amber depths.</p>
            </div>
            <div className="p-4 glass-panel border border-luxury-rosegold/10 text-center space-y-2">
              <Eye size={18} className="text-luxury-rosegold mx-auto mb-1 animate-pulse" />
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-white">Vision</h4>
              <p className="text-[9px] text-luxury-champagne/50 leading-relaxed font-light">Grounded absolute graphite focus.</p>
            </div>
          </div>
        </div>

        {/* Narrative Image showcase */}
        <div className="relative aspect-[4/3] bg-luxury-black overflow-hidden border border-luxury-rosegold/10 group select-none pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-t from-luxury-black via-transparent to-transparent z-10" />
          <img 
            src="/images/products/women_placeholder.png" 
            alt="Perfume Alchemist Room" 
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
          />
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[8px] uppercase tracking-widest text-luxury-gold font-bold block mb-1">Our Creed</span>
            <span className="font-serif text-sm tracking-widest uppercase text-white font-bold block">
              "FRAGRANCE SECURES IDENTITY"
            </span>
          </div>
        </div>

      </div>

    </section>
  );
};

export default About;
