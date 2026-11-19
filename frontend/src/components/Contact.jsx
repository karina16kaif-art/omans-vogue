import React, { useState } from 'react';
import { Send, Instagram, Phone, MapPin, Mail, Sparkles } from 'lucide-react';

const Contact = ({ brandSettings }) => {
  const contact = brandSettings?.storefront?.contact;
  const WHATSAPP_NUMBER = contact?.whatsapp || brandSettings?.whatsappNumber || '+233591259991';
  const brandName = brandSettings?.brandName || "OMAN'S VOGUE";
  const INSTAGRAM_HANDLE = contact?.instagram ?? 'Eugeniaa..a';

  const [formState, setFormState] = useState({ name: '', email: '', message: '' });
  const [draft, setDraft] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formState.name || !formState.email || !formState.message) return;
    
    const text = encodeURIComponent(`Hello ${brandName}!
${formState.message}

${formState.name}
${formState.email}`);
    const url = `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${text}`;
    setDraft(url);
    window.open(url, '_blank', 'noopener,noreferrer');
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
              {brandName} ATELIER
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
                <a href={`https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-xs font-mono text-white hover:text-luxury-gold transition-colors">
                  {WHATSAPP_NUMBER}
                </a>
              </div>
            </div>

            {contact?.email && <div className="flex gap-4 items-center">
              <Mail size={16} />
              <a href={`mailto:${contact.email}`} className="text-sm break-all text-luxury-champagne">{contact.email}</a>
            </div>}
            {INSTAGRAM_HANDLE && <div className="flex gap-4 items-center group">
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
            </div>}

            {/* Location */}
            <div className="flex gap-4 items-center group">
              <div className="p-3 bg-luxury-charcoal border border-luxury-rosegold/10 text-luxury-rosegold rounded-full group-hover:border-luxury-rosegold/30 transition-colors">
                <MapPin size={16} />
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-luxury-champagne/40 block mb-0.5">Pickup location</span>
                <span className="text-xs text-white font-light">
                  {brandSettings.pickupLocation}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Message Form Column (Right) */}
        <div className="lg:col-span-7">
          <div className="glass-panel p-6 sm:p-8 border border-luxury-rosegold/10 relative overflow-hidden">
            
            {draft && <div className="mb-5 text-sm" role="status">
              Press Send in WhatsApp to deliver your message. <a href={draft} target="_blank" rel="noreferrer" className="underline">Open WhatsApp again</a>
            </div>}
              <form onSubmit={handleSubmit} className="space-y-6">
                <h3 className="text-xs uppercase tracking-widest text-white font-bold flex items-center gap-1.5 border-b border-luxury-rosegold/10 pb-3">
                  <Sparkles size={12} className="text-luxury-gold animate-pulse" />
                  concierge ticket
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="contact-name" className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Your Name</label>
                    <input
                      required
                      type="text" id="contact-name" maxLength={120}
                      placeholder="Jane Doe"
                      value={formState.name}
                      onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                      className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="contact-email" className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Your Email</label>
                    <input
                      required
                      type="email" id="contact-email" maxLength={254}
                      placeholder="jane@example.com"
                      value={formState.email}
                      onChange={(e) => setFormState(prev => ({ ...prev, email: e.target.value }))}
                      className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contact-message" className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Concierge Message</label>
                  <textarea
                    required
                    rows="4" id="contact-message" maxLength={1600}
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
                  Open WhatsApp message
                </button>
              </form>

          </div>
        </div>

      </div>

    </section>
  );
};

export default Contact;
