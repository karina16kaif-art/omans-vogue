export const collections = [
  ['women', "Women's Fragrances"],
  ['men', "Men's Fragrances"],
  ['unisex', 'Unisex Fragrances'],
  ['bath-body-works', 'Bath & Body Works'],
  ['gift-sets', 'Gift Sets'],
  ['affordable', 'Affordable Fragrances'],
  ['100ml', '100ml Perfumes']
];

export const collectionDefinitions = (settings) => settings?.collectionDefinitions ?? collections.map(([id, name]) => ({
  id, name, visible: settings?.collectionVisibility?.[id] !== false
}));

export const homepageSections = [
  ['collections', 'Shop by Collection'],
  ['newArrivals', 'New Arrivals'],
  ['bestSellers', 'Best Sellers'],
  ['featured', 'Featured Products'],
  ['gifts', 'Gift Ideas'],
  ['fulfilment', 'Delivery and Pickup']
];

export const currency = (value) => `GH₵${Number(value).toFixed(2)}`;
export const optionPrice = (option) => Number(option.salePrice ?? option.price);
export const optionsFor = (product) => product.variants?.length ? product.variants : [product];
export const optionAvailable = (product, option) => (product.enabled ?? product.inStock !== false) &&
  option.inStock !== false && (option.stockQuantity == null || option.stockQuantity > 0) && optionPrice(option) > 0;

export const displayOption = (product) => {
  const options = optionsFor(product);
  const available = options.filter(option => optionAvailable(product, option));
  return [...(available.length ? available : options)].sort((a, b) => optionPrice(a) - optionPrice(b))[0];
};

export const assignedCollections = (product) => product.collections ?? ({
  Women: ['women'], Men: ['men'], Unisex: ['unisex']
}[product.category] || []);

export function memberships(product, settings = {}) {
  const definitions = settings.collectionDefinitions;
  const defined = (id) => !definitions || definitions.some(collection => collection.id === id);
  const result = new Set(assignedCollections(product).filter(defined));
  if (defined('100ml') && optionsFor(product).some(option => Number(option.sizeMl) === 100)) result.add('100ml');
  if (settings.affordableThreshold != null && optionPrice(displayOption(product)) <= settings.affordableThreshold) {
    if (defined('affordable')) result.add('affordable');
  }
  return result;
}

export const visibleCollections = (settings) => collectionDefinitions(settings).filter(({ visible }) => visible !== false)
  .map(({ id, name }) => [id, name]);
export const collectionLabel = (product, settings) => visibleCollections(settings)
  .find(([key]) => assignedCollections(product).includes(key))?.[1] || product.brand || '';
export const lineKey = (id, variantId) => `${id}:${variantId ?? ''}`;
export const cartKey = (item) => lineKey(item.id, item.variantId);
