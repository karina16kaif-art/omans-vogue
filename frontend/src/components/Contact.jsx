import React, { useState } from 'react';
import { Send, Instagram, Phone, MapPin, Mail, Sparkles, CheckCircle2 } from 'lucide-react';

const Contact = () => {
  const WHATSAPP_NUMBER = '+233591259991';
  const INSTAGRAM_HANDLE = 'Eugeniaa..a';

  const [formState, setFormState] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formState.name || !formState.email || !formState.message) return;
    
    // Simulate luxury response
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormState({ name: '', email: '', message: '' });
    }, 4000);
  };

  const handleLiveChat = () => {
    const text = encodeURIComponent(
      "Hello Oman's Vogue! I'd like to initiate a live consultation regarding perfume choices."
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank');
  };

  return (
    <section id="contact" className="relative max-w-7xl mx-auto px-6 md:px-12 py-24 z-10 border-t border-luxury-rosegold/5">
      
      {/* Header */}
      <div className="text-center mb-16">
        <span className="text-[10px] tracking-[0.35em] uppercase font-bold text-luxury-rosegold block mb-3">
          CONTACTEZ-NOUS
        </span>
        <h2 className="font-serif text-3xl sm:text-5xl tracking-widest uppercase text-white font-extrabold mb-4">
          GET IN TOUCH
        </h2>
        <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-luxury-rosegold to-transparent mx-auto" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        
        {/* Info Column (Left) */}
        <div className="lg:col-span-5 space-y-8">
          <div>
            <h3 className="font-serif text-lg tracking-wider text-luxury-gold uppercase font-bold mb-4">
              OMAN’S VOGUE ATELIER
            </h3>
            <p className="text-xs text-luxury-champagne/60 leading-relaxed font-light">
              Reach out to our concierge service for personal fragrance formulation consultations, wedding bulk packages, and secure dispatch inquiries.
            </p>
          </div>

          <div className="space-y-6 pt-4">
            {/* Phone */}
            <div className="flex gap-4 items-center group">
              <div className="p-3 bg-luxury-charcoal border border-luxury-rosegold/10 text-luxury-rosegold rounded-full group-hover:border-luxury-rosegold/30 transition-colors">
                <Phone size={16} />
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-luxury-champagne/40 block mb-0.5">WhatsApp Concierge</span>
                <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" className="text-xs font-mono text-white hover:text-luxury-gold transition-colors">
                  +233 59 125 9991
                </a>
              </div>
            </div>

            {/* Instagram */}
            <div className="flex gap-4 items-center group">
              <div className="p-3 bg-luxury-charcoal border border-luxury-rosegold/10 text-luxury-rosegold rounded-full group-hover:border-luxury-rosegold/30 transition-colors">
                <Instagram size={16} />
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-luxury-champagne/40 block mb-0.5">Instagram Journal</span>
                <a 
                  href={`https://instagram.com/${INSTAGRAM_HANDLE}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-xs text-white hover:text-luxury-gold transition-colors font-medium"
                >
                  @{INSTAGRAM_HANDLE}
                </a>
              </div>
            </div>

            {/* Location */}
            <div className="flex gap-4 items-center group">
              <div className="p-3 bg-luxury-charcoal border border-luxury-rosegold/10 text-luxury-rosegold rounded-full group-hover:border-luxury-rosegold/30 transition-colors">
                <MapPin size={16} />
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-luxury-champagne/40 block mb-0.5">Atelier Hub</span>
                <span className="text-xs text-white font-light">
                  East Legon Boutique Street, Accra, Ghana
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Message Form Column (Right) */}
        <div className="lg:col-span-7">
          <div className="glass-panel p-6 sm:p-8 border border-luxury-rosegold/10 relative overflow-hidden">
            
            {submitted ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-fade-in">
                <div className="w-12 h-12 bg-luxury-gold/10 border border-luxury-gold rounded-full flex items-center justify-center text-luxury-gold animate-pulse">
                  <CheckCircle2 size={24} />
                </div>
                <h4 className="font-serif text-sm uppercase tracking-widest text-white">Message Transmitted</h4>
                <p className="text-[11px] text-luxury-champagne/60 leading-relaxed max-w-xs mx-auto font-light">
                  Our fragrance concierge team has received your ticket and will write back to your coordinates within the hour.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <h3 className="text-xs uppercase tracking-widest text-white font-bold flex items-center gap-1.5 border-b border-luxury-rosegold/10 pb-3">
                  <Sparkles size={12} className="text-luxury-gold animate-pulse" />
                  concierge ticket
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Your Name</label>
                    <input
                      required
                      type="text"
                      placeholder="Jane Doe"
                      value={formState.name}
                      onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                      className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Your Email</label>
                    <input
                      required
                      type="email"
                      placeholder="jane@example.com"
                      value={formState.email}
                      onChange={(e) => setFormState(prev => ({ ...prev, email: e.target.value }))}
                      className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Concierge Message</label>
                  <textarea
                    required
                    rows="4"
                    placeholder="Hello! I would like to seek recommendation for wedding scent favors..."
                    value={formState.message}
                    onChange={(e) => setFormState(prev => ({ ...prev, message: e.target.value }))}
                    className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-transparent border border-luxury-gold/50 text-luxury-gold hover:bg-luxury-gold hover:text-luxury-black text-xs uppercase tracking-widest font-black flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(212,175,55,0.2)] transition-all duration-300"
                >
                  <Send size={12} />
                  Transmit Concierge Ticket
                </button>
              </form>
            )}

          </div>
        </div>

      </div>

    </section>
  );
};

export default Contact;
