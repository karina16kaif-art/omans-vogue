import React from 'react';
import { MapPin, Truck } from 'lucide-react';
import { ProductCard } from './Catalog';
import { currency, homepageSections, memberships, visibleCollections } from '../lib/catalogue';

const sectionTitles = Object.fromEntries(homepageSections);

function sectionContent(settings, key) {
  const section = settings?.sections?.[key];
  return {
    title: section?.title || sectionTitles[key],
    description: section?.description,
    visible: section?.visible !== false
  };
}

const Section = ({ title, description, children }) => (
  <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-10 sm:py-14">
    <div className="mb-5 sm:mb-7">
      <h2 className="font-serif text-2xl sm:text-3xl uppercase tracking-wider text-white font-bold">{title}</h2>
      {description && <p className="mt-2 max-w-xl text-luxury-champagne/80 text-sm sm:text-base">{description}</p>}
    </div>
    {children}
  </section>
);

export const ShopByCollection = ({ settings, onSelectCollection }) => {
  const content = sectionContent(settings, 'collections');
  const choices = visibleCollections(settings);
  if (!content.visible || !choices.length) return null;

  return (
    <Section {...content}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {choices.map(([id, label]) => (
          <button key={id} type="button" onClick={() => onSelectCollection(id)}
            className="glass-panel text-left min-h-16 p-4 sm:p-5 text-white hover:text-luxury-gold hover:border-luxury-gold/55 border border-luxury-rosegold/20 transition-colors font-serif text-sm sm:text-lg">
            {label}
          </button>
        ))}
      </div>
    </Section>
  );
};

export const ProductShowcases = ({ products, settings, ranks, onSelectProduct, onCheckout }) => {
  const byProduct = new Map(products.map(product => [String(product.id), product]));
  const groups = [
    ['newArrivals', products.filter(product => product.newArrival).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))],
    ['bestSellers', ranks.map(item => byProduct.get(String(item.productId))).filter(Boolean)],
    ['featured', products.filter(product => product.featured)],
    ['gifts', products.filter(product => memberships(product, settings).has('gift-sets'))]
  ];

  return groups.map(([key, items]) => {
    const content = sectionContent(settings, key);
    if (!content.visible || !items.length || (key === 'gifts' && settings?.collectionVisibility?.['gift-sets'] === false)) return null;
    return (
      <Section key={key} {...content}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {items.slice(0, 4).map(product => (
            <ProductCard key={product.id} product={product} onSelect={onSelectProduct} onCheckout={onCheckout} />
          ))}
        </div>
      </Section>
    );
  });
};

export const FulfilmentInfo = ({ brandSettings }) => {
  const content = sectionContent(brandSettings.storefront, 'fulfilment');
  if (!content.visible) return null;
  return (
    <Section {...content}>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="glass-panel p-5 border border-luxury-rosegold/15">
          <h3 className="text-luxury-gold font-semibold flex items-center gap-2"><MapPin size={17} /> Pickup</h3>
          <p className="mt-2 text-luxury-champagne">{brandSettings.pickupLocation}</p>
        </div>
        <div className="glass-panel p-5 border border-luxury-rosegold/15">
          <h3 className="text-luxury-gold font-semibold flex items-center gap-2"><Truck size={17} /> Campus delivery · {currency(brandSettings.campusDeliveryFee)}</h3>
          <p className="mt-2 text-luxury-champagne">Delivery is available at the listed University of Ghana, Legon campus destinations. Arbitrary meetup locations are unavailable.</p>
        </div>
      </div>
    </Section>
  );
};
