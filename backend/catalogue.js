const { randomUUID } = require('crypto');
const { checkoutError, cleanText, isExactPesewaAmount, toE164, toPesewas } = require('./checkout');

const collections = ['women', 'men', 'unisex', 'bath-body-works', 'gift-sets', 'affordable', '100ml'];
const collectionIds = (storefront) => storefront?.collectionDefinitions?.map(item => item.id) ?? collections;
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
function sellingPrice(value) {
  if (value === '' || value == null) return null;
  const raw = String(value).trim();
  if (!['number', 'string'].includes(typeof value) || !/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(raw)) {
    invalid('Enter a positive selling price in Ghana cedis, with up to two decimal places.');
  }
  const [whole, fraction = ''] = raw.split('.');
  const cents = toPesewas(`${whole || '0'}.${fraction.padEnd(2, '0')}`);
  if (!(cents > 0)) invalid('Enter a selling price greater than zero.');
  if (!isExactPesewaAmount(cents)) {
    invalid('This selling price exceeds the exact currency precision supported by checkout.');
  }
  return cents / 100;
}

// An older product editor may still submit the regular and displayed sale price together.
function submittedPrice(fields, current) {
  if (fields.sellingPrice !== undefined) return fields.sellingPrice;
  if (fields.salePrice != null && fields.salePrice !== '') return fields.salePrice;
  return fields.price === undefined ? current?.price : fields.price;
}

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
    const price = sellingPrice(submittedPrice(variant));
    const stockQuantity = optionalNumber(variant.stockQuantity, 0, 2147483647, 'Variant stock quantity', true);
    if (!label || price === null || stockQuantity === null) invalid('Enter a name, selling price and stock quantity for every variant.');
    return {
      id, label, price, stockQuantity,
      sizeMl: optionalNumber(variant.sizeMl, 0.01, 999999.99, 'Variant size')
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

function productPayload(body, current = {}, allowedCollections = collections) {
  const name = body.name === undefined ? current.name : text(body.name, 160, 'Product name');
  if (!name) invalid('Enter a product name.');
  // Keep the existing category column compatible with older catalogues. Collections drive shopping.
  const category = body.category === undefined ? current.category ?? 'Other' : categories.get(body.category) ?? (
    body.category === current.category ? current.category : null
  );
  if (category === null) invalid('Choose a valid legacy category.');
  const variants = body.variants === undefined ? current.variants || [] : normalizeVariants(body.variants);
  const updatesPrice = ['sellingPrice', 'price', 'salePrice'].some(field => body[field] !== undefined);
  const price = updatesPrice ? sellingPrice(submittedPrice(body, current)) : current.price;
  const salePrice = updatesPrice ? null : current.salePrice ?? null;
  if (!variants.length && !((salePrice ?? price) > 0)) invalid('Enter a selling price or add a priced variant.');
  const basePrice = price ?? salePrice ?? Math.min(...variants.map(effectivePrice));
  let assigned = current.collections ?? null;
  if (body.collections !== undefined) {
    if (!Array.isArray(body.collections) || body.collections.length > 64 || body.collections.some(value => !allowedCollections.includes(value))) {
      invalid('Choose valid collections.');
    }
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
    published: body.published === undefined ? current.published !== false : flag(body.published),
    bestsellerFeatured: body.bestsellerFeatured === undefined ? Boolean(current.bestsellerFeatured) : flag(body.bestsellerFeatured),
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
  let collectionDefinitions = previous.collectionDefinitions;
  if (value.collectionDefinitions !== undefined) {
    if (!Array.isArray(value.collectionDefinitions) || value.collectionDefinitions.length > 64) invalid('Use up to 64 collections.');
    const ids = new Set();
    const names = new Set();
    collectionDefinitions = value.collectionDefinitions.map(item => {
      const id = item?.id;
      const name = text(item?.name, 64, 'Collection name');
      if (typeof id !== 'string' || (!collections.includes(id) && !/^custom-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)) ||
          !name || ids.has(id) || names.has(name.toLowerCase())) invalid('Enter a unique name for each collection.');
      ids.add(id);
      names.add(name.toLowerCase());
      return { id, name, visible: item.visible !== false };
    });
  }
  const contact = { ...previous.contact };
  if (value.contact !== undefined) {
    if (!value.contact || typeof value.contact !== 'object' || Array.isArray(value.contact)) invalid('Invalid contact settings.');
    const { whatsapp, email, instagram } = value.contact;
    if (whatsapp !== undefined) {
      const number = toE164(whatsapp);
      if (whatsapp !== '' && !number) invalid('Enter a valid WhatsApp support number with its country code.');
      contact.whatsapp = number;
    }
    if (email !== undefined) {
      const address = text(email, 254, 'Support email');
      if (address && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) invalid('Enter a valid support email.');
      contact.email = address;
    }
    if (instagram !== undefined) {
      const handle = text(instagram, 30, 'Instagram handle').replace(/^@/, '');
      if (handle && !/^[A-Za-z0-9._]+$/.test(handle)) invalid('Enter an Instagram username.');
      contact.instagram = handle;
    }
  }
  return {
    sections, collectionVisibility: visibility, collectionDefinitions, contact,
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

module.exports = { productPayload, effectivePrice, publicProduct, productAvailable, normalizeStorefront, fallbackImage, collectionIds };
