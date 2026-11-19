import React, { useState } from 'react';
import { X, ShoppingBag, Wallet, AlertTriangle, Check } from 'lucide-react';
import StoreImage from './StoreImage';
import { cartKey, collectionLabel, currency, lineKey, optionAvailable, optionPrice } from '../lib/catalogue';

const ProductModal = ({ product, settings, relatedProducts, onSelectProduct, onClose, onAddToCart, onCheckout, cart }) => {
  const variants = product.variants || [];
  const [activeImage, setActiveImage] = useState(0);
  const [variantId, setVariantId] = useState(() => variants.find(option => optionAvailable(product, option))?.id || variants[0]?.id);
  const selectedVariant = variants.find(variant => variant.id === variantId);
  const option = selectedVariant ?? product;
  const available = optionAvailable(product, option) && (!variants.length || Boolean(selectedVariant));
  const isInCart = cart.some(item => cartKey(item) === lineKey(product.id, selectedVariant?.id));
  const images = product.images?.length ? product.images : [product.image];
  const image = images[activeImage] || images[0];
  const label = collectionLabel(product, settings);

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
        role="dialog" aria-modal="true" aria-labelledby="product-title"
        className="relative w-full max-w-4xl glass-panel-heavy border border-luxury-rosegold/20 shadow-2xl overflow-y-auto z-10 max-h-[90dvh] flex flex-col md:flex-row md:overflow-hidden"
      >
        {/* Close Button */}
        <button 
          aria-label="Close product details"
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 bg-luxury-black/80 backdrop-blur-xs border border-luxury-rosegold/10 text-luxury-champagne/80 hover:text-white hover:border-luxury-rosegold/30 transition-all rounded-full"
        >
          <X size={16} />
        </button>

        {/* Column 1: Image Showcase */}
        <div className="w-full md:w-1/2 shrink-0 md:max-h-[90dvh] md:overflow-y-auto bg-luxury-black">
          <div className="aspect-square relative overflow-hidden select-none">
          <StoreImage image={image} widths={[400, 640, 960, 1200]} sizes="(min-width: 920px) 450px, (min-width: 768px) 50vw, 95vw"
            eager alt={product.name} className="w-full h-full object-cover object-center" />
          {!product.inStock && (
            <div className="absolute inset-0 bg-luxury-black/75 flex items-center justify-center p-4">
              <span className="px-4 py-2 border border-luxury-rosegold text-luxury-rosegold text-xs uppercase tracking-widest font-black font-serif shadow-lg bg-black/95">
                Out of Stock
              </span>
            </div>
          )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto">
              {images.map((source, index) => (
                <button key={source} type="button" aria-label={`View image ${index + 1}`} aria-pressed={activeImage === index}
                  onClick={() => setActiveImage(index)}
                  className={`w-14 h-14 shrink-0 border ${activeImage === index ? 'border-luxury-gold' : 'border-luxury-rosegold/25'}`}>
                  <StoreImage image={source} widths={[112, 168]} sizes="56px" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Information Column */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col justify-between md:overflow-y-auto md:max-h-[90dvh]">
          <div>
            {/* Category tag */}
            <span className="text-[10px] tracking-[0.3em] uppercase font-bold text-luxury-rosegold block mb-2">
              {[label, product.brand !== label ? product.brand : ''].filter(Boolean).join(' · ')}
            </span>

            {/* Title */}
            <h2 id="product-title" className="font-serif text-2xl md:text-3xl tracking-widest text-white uppercase font-black mb-3">
              {product.name}
            </h2>

            {/* Price */}
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-xs uppercase tracking-wider text-luxury-champagne/40 font-light">Price:</span>
              <span className="font-serif text-xl font-black text-luxury-gold">{currency(optionPrice(option))}</span>
              {option.salePrice != null && <del className="text-luxury-champagne/65">{currency(option.price)}</del>}
            </div>

            {variants.length ? (
              <label className="block space-y-2 text-sm text-luxury-champagne mb-6">
                <span>Choose a variant</span>
                <select value={variantId || ''} onChange={event => setVariantId(event.target.value)}
                  className="w-full px-3 py-2.5 bg-luxury-black border border-luxury-rosegold/30 text-white">
                  {variants.map(variant => (
                    <option key={variant.id} value={variant.id}>
                      {variant.label}{variant.sizeMl ? ` · ${variant.sizeMl} ml` : ''} · {currency(optionPrice(variant))}
                      {optionAvailable(product, variant) ? '' : ' · Out of stock'}
                    </option>
                  ))}
                </select>
              </label>
            ) : product.sizeMl ? <p className="text-sm text-luxury-champagne mb-5">{product.sizeMl} ml</p> : null}


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
            {available ? (
              <>
                {/* Action 1: Add to Cart */}
                <button
                  onClick={() => onAddToCart(product, selectedVariant)}
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

                {/* Checkout */}
                <button
                  onClick={() => onCheckout(product, selectedVariant)}
                  className="w-full py-4 bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white text-xs uppercase tracking-widest font-bold hover:shadow-[0_0_20px_rgba(183,110,121,0.4)] flex items-center justify-center gap-2 btn-shimmer"
                >
                  <Wallet size={14} />
                  Checkout
                </button>
              </>
            ) : (
              <div className="w-full py-4 bg-luxury-charcoal border border-white/5 text-luxury-champagne/40 text-xs uppercase tracking-widest font-bold text-center flex items-center justify-center gap-2">
                <AlertTriangle size={14} />
                Fragrance Out of Stock
              </div>
            )}
          </div>
          {!!relatedProducts.length && (
            <div className="mt-7 pt-5 border-t border-luxury-rosegold/20">
              <h3 className="text-sm uppercase tracking-wider text-luxury-gold">Related products</h3>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {relatedProducts.map(related => (
                  <button type="button" key={related.id} onClick={() => onSelectProduct(related)}
                    className="text-left text-xs text-luxury-champagne hover:text-white">
                    <div className="aspect-square mb-1"><StoreImage image={related.image} widths={[144, 288]} sizes="120px" className="w-full h-full object-cover" /></div>
                    {related.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ProductModal);
