import { useEffect } from 'react';
import { getAssetUrl } from '../lib/api';

const SITE_URL = 'https://omansvogue.netlify.app';
const DEFAULT_DESCRIPTION = "Discover OMAN'S VOGUE luxury perfumes in Ghana. Shop premium women's and men's fragrance collections with secure checkout and WhatsApp concierge ordering.";

const absoluteUrl = (assetPath) => {
  const resolved = getAssetUrl(assetPath);
  if (!resolved) return SITE_URL;
  if (/^https?:\/\//i.test(resolved)) return resolved;
  if (resolved.startsWith('/')) return `${SITE_URL}${resolved}`;
  return `${SITE_URL}/${resolved}`;
};

const setMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
};

const setLink = (rel, href) => {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
};

const productSchema = (products) => products.slice(0, 24).map((product) => ({
  '@type': 'Product',
  name: product.name,
  description: product.description || product.notes || `${product.name} luxury fragrance by OMAN'S VOGUE.`,
  image: absoluteUrl(product.image),
  brand: {
    '@type': 'Brand',
    name: "OMAN'S VOGUE"
  },
  category: product.category === 'Women' ? "Women's Fragrance" : "Men's Fragrance",
  offers: {
    '@type': 'Offer',
    priceCurrency: 'GHS',
    price: String(Number(product.price || 0)),
    availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    url: SITE_URL
  }
}));

const SeoMeta = ({ products = [], brandSettings, isAdminRoute }) => {
  useEffect(() => {
    const brandName = brandSettings?.brandName || "OMAN'S VOGUE";
    const title = isAdminRoute
      ? `${brandName} Admin Console`
      : `${brandName} | Luxury Perfumes & Premium Fragrances in Ghana`;
    const description = isAdminRoute
      ? `${brandName} private administration console.`
      : DEFAULT_DESCRIPTION;
    const heroImage = absoluteUrl(brandSettings?.heroBackgroundImage || '/images/hero_bg.png');
    const canonicalUrl = isAdminRoute ? `${SITE_URL}/admin` : SITE_URL;

    document.title = title;
    setMeta('meta[name="description"]', { name: 'description', content: description });
    setMeta('meta[name="robots"]', { name: 'robots', content: isAdminRoute ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large' });
    setMeta('meta[name="theme-color"]', { name: 'theme-color', content: '#0a0506' });
    setMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    setMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    setMeta('meta[property="og:type"]', { property: 'og:type', content: isAdminRoute ? 'website' : 'product.group' });
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    setMeta('meta[property="og:image"]', { property: 'og:image', content: heroImage });
    setMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: brandName });
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: heroImage });
    setLink('canonical', canonicalUrl);

    const existingSchema = document.getElementById('omans-vogue-schema');
    if (existingSchema) {
      existingSchema.remove();
    }

    if (!isAdminRoute) {
      const schema = document.createElement('script');
      schema.type = 'application/ld+json';
      schema.id = 'omans-vogue-schema';
      schema.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Store',
            '@id': `${SITE_URL}/#store`,
            name: brandName,
            url: SITE_URL,
            image: heroImage,
            description,
            telephone: brandSettings?.whatsappNumber || '+233591259991',
            areaServed: 'Ghana',
            sameAs: ['https://instagram.com/Eugeniaa..a']
          },
          {
            '@type': 'ItemList',
            '@id': `${SITE_URL}/#products`,
            name: `${brandName} Perfume Collection`,
            itemListElement: productSchema(products)
          }
        ]
      });
      document.head.appendChild(schema);
    }
  }, [brandSettings, isAdminRoute, products]);

  return null;
};

export default SeoMeta;
