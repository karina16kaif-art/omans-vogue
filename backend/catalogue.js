const { randomUUID } = require('crypto');
const { checkoutError, cleanText } = require('./checkout');

const collections = ['women', 'men', 'unisex', 'bath-body-works', 'gift-sets', 'affordable', '100ml'];
const homepageSections = ['collections', 'newArrivals', 'bestSellers', 'featured', 'gifts', 'fulfilment'];
const fallbackImage = (category) => `/images/products/${category === 'Men' ? 'men' : 'women'}_placeholder.png`;

const invalid = (message) => { throw checkoutError(400, message); };
const text = (value, max, field) => {
  const result = cleanText(value);
  if (result.length > max) invalid(`${field} must be ${max} characters or fewer.`);
  return result;
};
const optionalNumber = (value, min, max, field, integer = false) => {
  if (value === '' || value == null) return null;
  const pattern = integer ? /^\d+$/ : /^\d+(\.\d{1,2})?$/;
  const number = Number(value);
  if (!['number', 'string'].includes(typeof value) || !pattern.test(String(value)) || number < min || number > max) {
    invalid(`Enter a valid ${field.toLowerCase()}.`);
  }
  return number;
};
const price = (value, field) => optionalNumber(value, 0.01, 9999999.99, field);
const checkedSale = (value, regular) => {
  const sale = price(value, 'Sale price');
  if (sale !== null && (regular === null || sale >= regular)) invalid('Sale price must be below the regular price.');
  return sale;
};

const effectivePrice = (item) => item.salePrice ?? item.price;
const productAvailable = (product) => product.enabled !== false && (
  product.variants?.length
    ? product.variants.some(variant => variant.stockQuantity > 0 && effectivePrice(variant) > 0)
    : (product.stockQuantity == null || product.stockQuantity > 0) && effectivePrice(product) > 0
);

const categories = new Map([['Women', 'Women'], ['Men', 'Men'], ['Unisex', 'Unisex'], ['Other', 'Other'], ["Women's Collection", 'Women'], ["Men's Collection", 'Men']]);
const legacyCollection = (category) => {
  const normalized = cleanText(category).toLowerCase();
  if (['women', "women's collection", "women's fragrances"].includes(normalized)) return ['women'];
  if (['men', "men's collection", "men's fragrances"].includes(normalized)) return ['men'];
  if (['unisex', 'unisex fragrances'].includes(normalized)) return ['unisex'];
  return [];
};

function normalizeVariants(value) {
  if (!Array.isArray(value) || value.length > 30) invalid('Use up to 30 variants per product.');
  const ids = new Set();
  return value.map(variant => {
    if (!variant || typeof variant !== 'object') invalid('Enter valid variant details.');
    const id = variant.id || randomUUID();
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || ids.has(id)) invalid('Variant IDs must be unique.');
    ids.add(id);
    const label = text(variant.label, 80, 'Variant name');
    const regular = price(variant.price, 'Variant price');
    const stockQuantity = optionalNumber(variant.stockQuantity, 0, 2147483647, 'Variant stock quantity', true);
    if (!label || regular === null || stockQuantity === null) invalid('Enter a name, price and stock quantity for every variant.');
    return {
      id, label, price: regular, stockQuantity,
      sizeMl: optionalNumber(variant.sizeMl, 0.01, 999999.99, 'Variant size'),
      salePrice: checkedSale(variant.salePrice, regular)
    };
  });
}

function normalizeImages(value) {
  if (!Array.isArray(value) || value.length > 12) invalid('Use up to 12 images per product.');
  return [...new Set(value.map(image => {
    if (typeof image !== 'string' || image.length > 2048 ||
        !/^(https?:\/\/[^\s]+|\/(?:images|uploads)\/[^\s]+)$/.test(image)) {
      invalid('Use uploaded images or valid image URLs.');
    }
    return image;
  }))];
}

const flag = (value) => value === true || value === 'true';

function productPayload(body, current = {}) {
  const name = body.name === undefined ? current.name : text(body.name, 160, 'Product name');
  if (!name) invalid('Enter a product name.');
  // Keep the existing category column compatible with older catalogues. Collections drive shopping.
  const category = body.category === undefined ? current.category ?? 'Other' : categories.get(body.category) ?? (
    body.category === current.category ? current.category : null
  );
  if (category === null) invalid('Choose a valid legacy category.');
  const variants = body.variants === undefined ? current.variants || [] : normalizeVariants(body.variants);
  const regular = body.price === undefined ? current.price ?? null : price(body.price, 'Price');
  if (!variants.length && !(regular > 0)) invalid('Enter a price or add a priced variant.');
  const basePrice = regular ?? Math.min(...variants.map(variant => variant.price));
  const salePrice = checkedSale(body.salePrice === undefined ? current.salePrice : body.salePrice, basePrice);
  let assigned = current.collections ?? null;
  if (body.collections !== undefined) {
    if (!Array.isArray(body.collections) || body.collections.some(value => !collections.includes(value))) invalid('Choose valid collections.');
    assigned = [...new Set(body.collections)];
  }
  let images = current.images || [];
  if (body.images !== undefined) {
    images = normalizeImages(body.images);
  } else if (body.image || body.image_url) {
    images = normalizeImages([body.image_url || body.image, ...images].filter(Boolean).slice(0, 12));
  }
  const enabled = body.enabled ?? body.inStock ?? body.in_stock ?? (
    body.stock_status === undefined ? current.enabled ?? true : cleanText(body.stock_status).toLowerCase() !== 'out of stock'
  );

  return {
    ...current,
    name, category, price: basePrice, salePrice, variants, collections: assigned, images,
    image: images[0] || fallbackImage(category),
    description: body.description === undefined ? current.description || '' : text(body.description, 6000, 'Description'),
    notes: body.notes === undefined ? current.notes || '' : text(body.notes, 1500, 'Notes'),
    brand: body.brand === undefined ? current.brand || '' : text(body.brand, 100, 'Brand'),
    sizeMl: body.sizeMl === undefined ? current.sizeMl ?? null : optionalNumber(body.sizeMl, 0.01, 999999.99, 'Size'),
    stockQuantity: body.stockQuantity === undefined ? current.stockQuantity ?? null : optionalNumber(body.stockQuantity, 0, 2147483647, 'Stock quantity', true),
    enabled: flag(enabled),
    featured: body.featured === undefined ? Boolean(current.featured) : flag(body.featured),
    newArrival: body.newArrival === undefined ? Boolean(current.newArrival) : flag(body.newArrival)
  };
}

function normalizeStorefront(value, previous = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Invalid storefront settings.');
  const sections = { ...previous.sections };
  for (const key of homepageSections) {
    const section = value.sections?.[key];
    if (section === undefined) continue;
    if (!section || typeof section !== 'object') invalid('Invalid homepage section.');
    sections[key] = {
      ...(sections[key] || {}),
      ...(section.visible === undefined ? {} : { visible: flag(section.visible) }),
      ...(section.title === undefined ? {} : { title: text(section.title, 100, 'Section title') }),
      ...(section.description === undefined ? {} : { description: text(section.description, 360, 'Section description') })
    };
  }
  const visibility = { ...previous.collectionVisibility };
  for (const key of collections) {
    if (value.collectionVisibility?.[key] !== undefined) visibility[key] = flag(value.collectionVisibility[key]);
  }
  return {
    sections, collectionVisibility: visibility,
    affordableThreshold: value.affordableThreshold === undefined
      ? previous.affordableThreshold ?? null
      : optionalNumber(value.affordableThreshold, 0.01, 9999999.99, 'Affordable price threshold')
  };
}

function publicProduct(product, admin = false) {
  const assignments = product.collections ?? legacyCollection(product.category);
  const available = productAvailable(product);
  // Legacy boolean stock is preserved until the merchant records a quantity.
  const { archivedAt, catalogVersion, stockQuantity, variants = [], ...details } = product;
  const visible = { ...details, collections: assignments, inStock: available };
  if (admin) return { ...visible, stockQuantity, variants, catalogVersion };

  return {
    ...visible,
    variants: variants.map(({ stockQuantity: quantity, ...variant }) => ({
      ...variant,
      inStock: product.enabled !== false && quantity > 0 && effectivePrice(variant) > 0
    }))
  };
}

module.exports = { productPayload, effectivePrice, publicProduct, productAvailable, normalizeStorefront, fallbackImage };
