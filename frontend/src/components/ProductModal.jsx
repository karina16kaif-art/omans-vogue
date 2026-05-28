import React from 'react';
import { X, ShoppingBag, Send, AlertTriangle, Check } from 'lucide-react';
import { getAssetUrl } from '../lib/api';

const ProductModal = ({ product, onClose, onAddToCart, isInCart }) => {
  if (!product) return null;

  const WHATSAPP_NUMBER = '+233591259991';

  const collectionLabel = product.category === 'Women' ? "Women's Collection" : "Men's Collection";

  const handleWhatsAppOrder = () => {
    const text = encodeURIComponent(
      `Hello Oman's Vogue! I want to order ${product.name}. Price: GHS ${Number(product.price).toFixed(2)}. Category: ${collectionLabel}. Please confirm availability and payment details.`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}?text=${text}`, '_blank');
  };

  // Split notes string if comma-separated
  const notesArray = product.notes ? product.notes.split(',').map(n => n.trim()) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Frosted glass backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
      />

      {/* Modal Container */}
      <div 
        className="relative w-full max-w-4xl glass-panel-heavy border border-luxury-rosegold/20 rounded-none shadow-2xl overflow-hidden z-10 transform scale-95 md:scale-100 transition-transform duration-500 max-h-[90vh] flex flex-col md:flex-row"
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 bg-luxury-black/80 backdrop-blur-xs border border-luxury-rosegold/10 text-luxury-champagne/80 hover:text-white hover:border-luxury-rosegold/30 transition-all rounded-full"
        >
          <X size={16} />
        </button>

        {/* Column 1: Image Showcase */}
        <div className="w-full md:w-1/2 aspect-square md:aspect-auto md:h-auto min-h-[300px] relative bg-luxury-black overflow-hidden select-none">
          <img 
            src={getAssetUrl(product.image)} 
            alt={product.name} 
            className="w-full h-full object-cover object-center pointer-events-none"
          />
          {!product.inStock && (
            <div className="absolute inset-0 bg-luxury-black/75 flex items-center justify-center p-4">
              <span className="px-4 py-2 border border-luxury-rosegold text-luxury-rosegold text-xs uppercase tracking-widest font-black font-serif shadow-lg bg-black/95">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* Column 2: Information Column */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col justify-between overflow-y-auto max-h-[50vh] md:max-h-[80vh]">
          <div>
            {/* Category tag */}
            <span className="text-[10px] tracking-[0.3em] uppercase font-bold text-luxury-rosegold block mb-2">
              {collectionLabel}
            </span>

            {/* Title */}
            <h2 className="font-serif text-2xl md:text-3xl tracking-widest text-white uppercase font-black mb-3">
              {product.name}
            </h2>

            {/* Price */}
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-xs uppercase tracking-wider text-luxury-champagne/40 font-light">Price:</span>
              <span className="font-serif text-xl font-black text-luxury-gold">GHS {product.price}.00</span>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h4 className="text-[10px] uppercase tracking-widest text-luxury-champagne/50 font-bold mb-2">The Fragrance Story</h4>
              <p className="text-xs sm:text-sm text-luxury-champagne/80 font-light leading-relaxed">
                {product.description || "A captivating fragrance masterfully designed to elevate your sensory atmosphere and inspire personal confidence and inner growth."}
              </p>
            </div>

            {/* Fragrance Notes */}
            {notesArray.length > 0 && (
              <div className="mb-8">
                <h4 className="text-[10px] uppercase tracking-widest text-luxury-champagne/50 font-bold mb-3">Fragrance Notes</h4>
                <div className="flex flex-wrap gap-2">
                  {notesArray.map((note, index) => {
                    const noteTypes = ['Top Note', 'Heart Note', 'Base Note'];
                    const label = noteTypes[index % noteTypes.length];
                    return (
                      <div 
                        key={note}
                        className="px-3.5 py-1.5 glass-panel-light border border-white/5 flex flex-col items-start"
                      >
                        <span className="text-[8px] uppercase text-luxury-rosegold font-bold tracking-widest mb-0.5">{label}</span>
                        <span className="text-xs text-white tracking-wide font-medium">{note}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="border-t border-luxury-rosegold/10 pt-6 mt-8 flex flex-col sm:flex-row items-center gap-3">
            {product.inStock ? (
              <>
                {/* Action 1: Add to Cart */}
                <button
                  onClick={() => onAddToCart(product)}
                  className={`w-full py-4 text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
                    isInCart 
                      ? 'bg-transparent text-luxury-rosegold border border-luxury-rosegold/30 hover:border-luxury-rosegold' 
                      : 'bg-white text-luxury-black hover:bg-luxury-gold hover:shadow-lg'
                  }`}
                >
                  {isInCart ? (
                    <>
                      <Check size={14} />
                      In Shopping Cart
                    </>
                  ) : (
                    <>
                      <ShoppingBag size={14} />
                      Add To Cart
                    </>
                  )}
                </button>

                {/* Action 2: Direct Buy on WhatsApp */}
                <button
                  onClick={handleWhatsAppOrder}
                  className="w-full py-4 bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white text-xs uppercase tracking-widest font-bold hover:shadow-[0_0_20px_rgba(183,110,121,0.4)] flex items-center justify-center gap-2 btn-shimmer"
                >
                  <Send size={14} />
                  Order on WhatsApp
                </button>
              </>
            ) : (
              <div className="w-full py-4 bg-luxury-charcoal border border-white/5 text-luxury-champagne/40 text-xs uppercase tracking-widest font-bold text-center flex items-center justify-center gap-2">
                <AlertTriangle size={14} />
                Fragrance Out of Stock
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
