import React, { useDeferredValue, useMemo, useState } from 'react';
import { ShoppingBag, Eye, Sparkles, AlertCircle, Search } from 'lucide-react';
import StoreImage from './StoreImage';
import { collectionLabel, currency, displayOption, memberships, optionAvailable, optionPrice, optionsFor, visibleCollections } from '../lib/catalogue';

export const ProductCard = React.memo(({ product, settings, onSelect, onCheckout, storePick = false }) => {
  const label = collectionLabel(product, settings);
  const option = displayOption(product);
  const available = optionsFor(product).some(item => optionAvailable(product, item));

  return (
    <div 
      className="tilt-card-container cursor-pointer select-none"
      onClick={() => onSelect(product)}
    >
      <div 
        className={`tilt-card glass-panel group relative flex flex-col h-full overflow-hidden border transition-all duration-500 ${
          available
            ? 'border-luxury-rosegold/10 hover:border-luxury-rosegold/30' 
            : 'border-white/5 opacity-70 filter saturate-50'
        }`}
      >
        {/* Out of Stock Overlay / Badge */}
        {!available && (
          <div className="absolute inset-0 pointer-events-none out-of-stock-overlay z-20 flex flex-col items-center justify-center p-4">
            <div className="px-4 py-2 border border-luxury-rosegold bg-luxury-black/90 text-luxury-rosegold font-serif text-xs uppercase tracking-widest font-black flex items-center gap-1.5 shadow-lg">
              <AlertCircle size={12} />
              Out of Stock
            </div>
          </div>
        )}

        {/* Perfume Image Wrap */}
        <div className="relative aspect-[1/1] overflow-hidden bg-luxury-black">
          <StoreImage image={product.image} widths={[240, 400, 640, 800]}
            sizes="(min-width: 1280px) 275px, (min-width: 1024px) 25vw, 50vw" alt={product.name}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
          {/* Sparkle decorative effect */}
          {available && (
            <div className="absolute top-3 right-3 p-1.5 rounded-full bg-luxury-charcoal/80 backdrop-blur-xs border border-luxury-rosegold/20 opacity-0 group-hover:opacity-100 transition-opacity">
              <Sparkles size={12} className="text-luxury-gold " />
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-3 sm:p-5 flex flex-col justify-between flex-grow">
          <div>
            {/* Category tag */}
            <span className="text-[9px] font-sans tracking-[0.25em] uppercase text-luxury-rosegold font-bold block mb-1">
              {label}
            </span>
            {storePick && <span className="text-xs text-luxury-rosegold">Store pick</span>}
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
              {product.variants?.length > 1 && <span className="text-xs text-luxury-champagne/65">From</span>}
              <span className="font-serif text-sm font-bold text-luxury-gold">{currency(optionPrice(option))}</span>
              {option.salePrice != null && <del className="text-xs text-luxury-champagne/65">{currency(option.price)}</del>}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* View Details Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(product);
                }}
                title="View details"
                aria-label={`View details for ${product.name}`}
                className="p-2 rounded-full border border-luxury-rosegold/10 text-luxury-champagne hover:border-luxury-rosegold/40 hover:bg-luxury-wine/20 transition-all duration-300"
              >
                <Eye size={12} />
              </button>
              {available && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCheckout(product);
                  }}
                  title="Checkout"
                  aria-label={`Checkout ${product.name}`}
                  className="p-2 rounded-full bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white transition-all duration-300 hover:shadow-[0_0_12px_rgba(183,110,121,0.3)] transform active:scale-95"
                >
                  <ShoppingBag size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const controlClass = 'w-full min-w-0 border border-luxury-rosegold/25 bg-luxury-black px-3 py-2.5 text-sm text-white focus:border-luxury-gold focus:outline-none';
const initialFilters = { query: '', brand: '', size: '', minPrice: '', price: '', stock: '' };

const Catalog = ({ products, pending, error, onReload, settings, collection, onCollectionChange, onSelectProduct, onCheckout }) => {
  const [filters, setFilters] = useState(initialFilters);
  const { query, brand, size, minPrice, price, stock } = filters;
  const deferredQuery = useDeferredValue(query);
  const selection = JSON.stringify([collection, brand, size, minPrice, price, stock, deferredQuery]);
  const [visible, setVisible] = useState({ selection, count: 24 });
  const visibleCount = visible.selection === selection ? visible.count : 24;
  const setFilter = (key, value) => setFilters(previous => ({ ...previous, [key]: value }));
  const enabledCollections = visibleCollections(settings);

  const brands = useMemo(() => [...new Set(products.map(product => product.brand).filter(Boolean))].sort(), [products]);
  const sizes = useMemo(() => [...new Set(products.flatMap(product => optionsFor(product).map(option => option.sizeMl)).filter(Boolean))]
    .sort((a, b) => a - b), [products]);
  const searchIndex = useMemo(() => products.map(product => ({
    product,
    groups: memberships(product, settings),
    searchable: [product.name, product.brand, product.notes, product.description, ...optionsFor(product).map(option => option.label)]
      .filter(Boolean).join(' ').toLowerCase()
  })), [products, settings]);
  const filtered = useMemo(() => {
    const search = deferredQuery.trim().toLowerCase().split(/\s+/);
    return searchIndex.filter(({ product, groups, searchable }) => {
      if (collection && !groups.has(collection)) return false;
      if (brand && product.brand !== brand) return false;
      if (!search.every(term => searchable.includes(term))) return false;
      return optionsFor(product).some(option => (
        (!size || Number(option.sizeMl) === Number(size)) &&
        (minPrice === '' || optionPrice(option) >= Number(minPrice)) &&
        (price === '' || optionPrice(option) <= Number(price)) &&
        (!stock || optionAvailable(product, option) === (stock === 'available'))
      ));
    }).map(({ product }) => product);
  }, [searchIndex, collection, deferredQuery, brand, size, minPrice, price, stock]);

  return (
    <section id="catalog" className="relative max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-16 sm:py-24 z-10 border-t border-luxury-rosegold/5 scroll-mt-20">
      <div className="text-center mb-8 sm:mb-12">
        <h2 className="font-serif text-3xl sm:text-5xl tracking-widest uppercase text-white font-extrabold">
          Explore Collections
        </h2>
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-luxury-rosegold to-transparent mx-auto mt-5" />
      </div>

      <div className="glass-panel p-4 sm:p-5 space-y-4 mb-7">
        <label className="block space-y-1 text-sm text-luxury-champagne">
          <span>Search fragrances</span>
          <span className="relative block">
            <Search size={17} className="absolute top-3 left-3 text-luxury-rosegold" aria-hidden="true" />
            <input type="search" value={query} onChange={event => setFilter('query', event.target.value)}
              className={`${controlClass} pl-10`} placeholder="Product, brand or fragrance note" />
          </span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Filter label="Collection" value={collection} onChange={onCollectionChange} choices={enabledCollections} />
          <Filter label="Brand" value={brand} onChange={value => setFilter('brand', value)} choices={brands.map(value => [value, value])} />
          <Filter label="Size" value={size} onChange={value => setFilter('size', value)} choices={sizes.map(value => [value, `${value} ml`])} />
          <label className="block min-w-0 space-y-1 text-sm text-luxury-champagne">
            <span>Min price (GH₵)</span>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={minPrice} onChange={event => setFilter('minPrice', event.target.value)} className={controlClass} placeholder="Any price" />
          </label>
          <label className="block min-w-0 space-y-1 text-sm text-luxury-champagne">
            <span>Max price (GH₵)</span>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={event => setFilter('price', event.target.value)} className={controlClass} placeholder="Any price" />
          </label>
          <Filter label="Availability" value={stock} onChange={value => setFilter('stock', value)}
            choices={ [['available', 'In stock'], ['unavailable', 'Out of stock']] } />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-5 text-sm text-luxury-champagne/75">
        <p aria-live="polite">{pending ? 'Loading fragrances…' : error ? 'Catalogue unavailable' : `${filtered.length} ${filtered.length === 1 ? 'product' : 'products'}`}</p>
        {(collection || Object.values(filters).some(Boolean)) && (
          <button type="button" className="text-luxury-gold underline underline-offset-4" onClick={() => {
            setFilters(initialFilters);
            onCollectionChange('');
          }}>Clear filters</button>
        )}
      </div>
      {error && <p role="alert" className="mb-4 text-sm">{error} <button type="button" className="underline" onClick={onReload}>Retry</button></p>}
      {filtered.length ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 md:gap-8">
          {filtered.slice(0, visibleCount).map(product => <ProductCard key={product.id} product={product} settings={settings} onSelect={onSelectProduct} onCheckout={onCheckout} />)}
        </div>
      ) : !pending && !error && <p className="glass-panel py-12 text-center text-luxury-champagne/75">No products match these filters.</p>}
      {visibleCount < filtered.length && <button type="button" className="mx-auto mt-6 block border border-luxury-rosegold/25 px-5 py-2.5 text-sm"
        onClick={() => setVisible({ selection, count: visibleCount + 24 })}>Show more fragrances</button>}
    </section>
  );
};

const Filter = ({ label, value, onChange, choices }) => (
  <label className="block min-w-0 space-y-1 text-sm text-luxury-champagne">
    <span>{label}</span>
    <select className={controlClass} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">All</option>
      {choices.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
    </select>
  </label>
);

export default React.memo(Catalog);
