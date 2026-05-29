import React, { useMemo, useState } from 'react';
import { Send, Eye, Sparkles, AlertCircle } from 'lucide-react';
import { getAssetUrl, getWebPAssetUrl } from '../lib/api';

const ProductCard = React.memo(({ product, onSelect, brandSettings }) => {
  const [tiltStyle, setTiltStyle] = useState({});

  const handleMouseMove = (e) => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left; // x coordinate inside element
    const y = e.clientY - rect.top;  // y coordinate inside element

    // Calculate rotation degree based on hover position (max 10 degrees tilt)
    const rotateX = ((rect.height / 2 - y) / (rect.height / 2)) * 10;
    const rotateY = -((rect.width / 2 - x) / (rect.width / 2)) * 10;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`,
      transition: 'transform 0.1s ease-out'
    });
  };

  const handleMouseLeave = () => {
    setTiltStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.5s ease'
    });
  };

  const collectionLabel = product.category === 'Women' ? "Women's Collection" : "Men's Collection";
  const productImageUrl = getAssetUrl(product.image);
  const productWebPUrl = getWebPAssetUrl(product.image);

  const handleWhatsAppOrder = (e) => {
    e.stopPropagation();
    const text = encodeURIComponent(
      `Hello ${brandSettings?.brandName || "Oman's Vogue"}! I want to order ${product.name}. Price: GHS ${Number(product.price).toFixed(2)}. Category: ${collectionLabel}. Please confirm availability and payment details.${product.inStock ? '' : ' I can see it is currently marked out of stock.'}`
    );
    window.open(`https://wa.me/${(brandSettings?.whatsappNumber || '+233591259991').replace('+', '')}?text=${text}`, '_blank');
  };

  return (
    <div 
      className="tilt-card-container cursor-pointer select-none"
      onClick={() => onSelect(product)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div 
        style={tiltStyle}
        className={`tilt-card glass-panel group relative flex flex-col h-full overflow-hidden border transition-all duration-500 ${
          product.inStock 
            ? 'border-luxury-rosegold/10 hover:border-luxury-rosegold/30' 
            : 'border-white/5 opacity-70 filter saturate-50'
        }`}
      >
        {/* Out of Stock Overlay / Badge */}
        {!product.inStock && (
          <div className="absolute inset-0 out-of-stock-overlay z-20 flex flex-col items-center justify-center p-4">
            <div className="px-4 py-2 border border-luxury-rosegold bg-luxury-black/90 text-luxury-rosegold font-serif text-xs uppercase tracking-widest font-black flex items-center gap-1.5 shadow-lg animate-pulse">
              <AlertCircle size={12} />
              Out of Stock
            </div>
          </div>
        )}

        {/* Perfume Image Wrap */}
        <div className="relative aspect-[1/1] overflow-hidden bg-luxury-black">
          <picture className="block w-full h-full">
            {productWebPUrl && <source srcSet={productWebPUrl} type="image/webp" />}
            <img
              src={productImageUrl}
              alt={product.name}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 select-none pointer-events-none"
              loading="lazy"
              decoding="async"
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            />
          </picture>
          {/* Sparkle decorative effect */}
          {product.inStock && (
            <div className="absolute top-3 right-3 p-1.5 rounded-full bg-luxury-charcoal/80 backdrop-blur-xs border border-luxury-rosegold/20 opacity-0 group-hover:opacity-100 transition-opacity">
              <Sparkles size={12} className="text-luxury-gold animate-spin-slow" />
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-5 flex flex-col justify-between flex-grow">
          <div>
            {/* Category tag */}
            <span className="text-[9px] font-sans tracking-[0.25em] uppercase text-luxury-rosegold font-bold block mb-1">
              {collectionLabel}
            </span>
            {/* Product Name */}
            <h3 className="font-serif text-base tracking-wider text-white group-hover:text-luxury-gold transition-colors duration-300 mb-2 truncate">
              {product.name}
            </h3>
            {/* Notes preview */}
            <p className="text-[10px] text-luxury-champagne/60 font-light line-clamp-2 leading-relaxed mb-4">
              {product.notes}
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-luxury-rosegold/5 pt-4 mt-auto">
            {/* Price tag */}
            <div className="flex flex-col">
              <span className="text-[8px] uppercase tracking-widest text-luxury-champagne/40">Price</span>
              <span className="font-serif text-sm font-black text-luxury-champagne">GHS {product.price}.00</span>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {/* View Details Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(product);
                }}
                title="View Details"
                className="p-2 rounded-full border border-luxury-rosegold/10 text-luxury-champagne hover:border-luxury-rosegold/40 hover:bg-luxury-wine/20 transition-all duration-300"
              >
                <Eye size={12} />
              </button>
              {/* WhatsApp Order Button */}
              <button
                onClick={handleWhatsAppOrder}
                title="Order on WhatsApp"
                className="p-2 rounded-full bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white transition-all duration-300 hover:shadow-[0_0_12px_rgba(183,110,121,0.3)] transform active:scale-95"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const Catalog = ({ products, onSelectProduct, onAddToCart, activeSection, setActiveSection, brandSettings }) => {
  const [filter, setFilter] = useState('All'); // 'All', 'Women', 'Men'

  // Apply filters
  const filteredProducts = useMemo(() => products.filter(p => {
    if (filter === 'All') return true;
    return p.category.toLowerCase() === filter.toLowerCase();
  }), [filter, products]);

  return (
    <section id="catalog" className="relative max-w-7xl mx-auto px-6 md:px-12 py-24 z-10 border-t border-luxury-rosegold/5">
      
      {/* Dynamic Header */}
      <div className="text-center mb-16">
        <span className="text-[10px] tracking-[0.35em] uppercase font-bold text-luxury-rosegold block mb-3">
          LES CRÉATIONS
        </span>
        <h2 className="font-serif text-3xl sm:text-5xl tracking-widest uppercase text-white font-extrabold mb-4">
          EXPLORE COLLECTIONS
        </h2>
        <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-luxury-rosegold to-transparent mx-auto mb-6" />
        <p className="max-w-md mx-auto text-xs sm:text-sm text-luxury-champagne/70 font-light leading-relaxed">
          Crafted to express your soul. Filter by collections to discover your personal signature fragrance for growth.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex justify-center gap-3 mb-16">
        {['All', 'Women', 'Men'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-6 py-2.5 text-[10px] sm:text-xs uppercase tracking-widest font-bold border transition-all duration-300 ${
              filter === cat
                ? 'bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white border-luxury-rosegold/50 shadow-md shadow-luxury-wine/25'
                : 'bg-transparent text-luxury-champagne/70 border-luxury-rosegold/10 hover:border-luxury-rosegold/30 hover:text-white'
            }`}
          >
            {cat === 'All' ? 'All Products' : `${cat}'s Collection`}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-20 glass-panel border border-dashed border-luxury-rosegold/20">
          <p className="text-luxury-champagne/50 tracking-widest text-sm uppercase">No fragrances found in this collection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {filteredProducts.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onSelect={onSelectProduct}
              brandSettings={brandSettings}
            />
          ))}
        </div>
      )}

    </section>
  );
};

export default React.memo(Catalog);
