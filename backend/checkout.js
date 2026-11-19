const crypto = require('crypto');

const campus = 'University of Ghana, Legon';
const pickupLocation = 'Jean Nelson Hostel, University of Ghana, Legon';
const campusDeliveryFee = 10;
const campusDestinations = [
  'Akuafo Hall', 'Alexander Adum Kwapong Hall', 'Balme Library', 'Bani Hostel', 'Commonwealth Hall',
  'Diamond Jubilee Hall',
  'Elizabeth Frances Baaba Sey Hall', 'Hilla Limann Hall', 'International Students Hostel',
  'Jean Nelson Hostel', 'Jubilee Hall', 'Legon Hall', 'Legon Hall Annex C', 'Mensah Sarbah Hall',
  'Mensah Sarbah Hall Annex C/D', 'Pentagon (Pent)', 'TF Hostel', 'United Nations Hall',
  'VALCO Trust Hostel', 'Vikings Hostel', 'Volta Hall'
];

const cleanText = (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const toE164 = (value) => {
  let phone = cleanText(value).replace(/[ ().-]/g, '');
  if (/^0[2-5]\d{8}$/.test(phone)) phone = `+233${phone.slice(1)}`;
  if (/^233[2-5]\d{8}$/.test(phone)) phone = `+${phone}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : '';
};
const toGhanaPhone = (value) => {
  const phone = toE164(value);
  return /^\+233[2-5]\d{8}$/.test(phone) ? phone : '';
};
const toPesewas = (value) => {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value));
  if (!match) return Math.round(Number(value) * 100);

  const [, sign, whole, fraction = ''] = match;
  const cents = Number(whole) * 100 + Number(fraction.slice(0, 2).padEnd(2, '0'));
  return (sign ? -1 : 1) * (cents + (Number(fraction[2] || 0) >= 5 ? 1 : 0));
};
const formatCurrency = (value) => `GH₵${Number(value || 0).toFixed(2)}`;
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cartPriceKey = (items) => hash(items.map(({ productId, variantId, quantity, unitPrice }) =>
  [String(productId), variantId ?? null, quantity, toPesewas(unitPrice)]
));

const checkoutError = (status, message) => Object.assign(new Error(message), { checkoutStatus: status });

function parseItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 30) {
    throw checkoutError(400, 'Choose between 1 and 30 products for checkout.');
  }
  const quantities = new Map();
  for (const item of items) {
    const { productId, quantity } = item || {};
    const id = String(productId ?? '');
    const variantId = item?.variantId ?? null;
    const key = `${id}:${variantId ?? ''}`;
    if (!/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n ||
        (variantId !== null && (typeof variantId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(variantId))) ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 99 || quantities.has(key)) {
      throw checkoutError(400, 'Review the products and quantities in your cart.');
    }
    quantities.set(key, { productId: id, variantId, quantity });
  }
  return [...quantities.values()].sort((first, second) =>
    first.productId.localeCompare(second.productId) || (first.variantId || '').localeCompare(second.variantId || '')
  );
}

function parseOrder(body, approvedDelivery = false) {
  const requestId = cleanText(body.requestId).toLowerCase();
  const quoteKey = cleanText(body.quoteKey);
  const customerName = cleanText(body.customerName);
  const customerEmail = cleanText(body.customerEmail);
  const customerPhone = toE164(body.customerPhone);
  const momoPhone = toGhanaPhone(body.momoPhone);
  const paymentReference = cleanText(body.paymentReference);
  const method = body.fulfilmentMethod;
  const campusDestination = method === 'delivery' ? cleanText(body.campusDestination) : '';
  const addressDetails = method === 'delivery' ? cleanText(body.addressDetails) : '';

  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(requestId) ||
      !/^[a-f0-9]{64}$/.test(quoteKey)) {
    throw checkoutError(400, 'Reopen checkout to refresh your order details.');
  }
  if (!customerName || customerName.length > 120 || !customerPhone || !momoPhone ||
      !paymentReference || paymentReference.length > 100) {
    throw checkoutError(400, 'Enter your name, contact phone, Ghanaian MoMo phone, and payment reference.');
  }
  if (customerEmail && (customerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))) {
    throw checkoutError(400, 'Enter a valid contact email for your order.');
  }
  if (!['pickup', 'delivery'].includes(method) && !(approvedDelivery && method === 'outside_campus')) {
    throw checkoutError(400, 'Choose pickup or campus delivery.');
  }
  if (method === 'delivery' && (!campusDestinations.includes(campusDestination) || !addressDetails || addressDetails.length > 180)) {
    throw checkoutError(400, 'Choose a listed Legon campus destination and enter a room or entrance.');
  }

  return {
    requestId,
    quoteKey,
    customerName,
    customerEmail,
    customerPhone,
    momoPhone,
    paymentReference,
    fulfilmentMethod: method,
    campusDestination,
    addressDetails,
    items: parseItems(body.items)
  };
}

function buildQuote(quantities, products, settings, { payment = true } = {}) {
  const {
    momoNumber, momoAccountName, momoPaymentInstructions, whatsappNumber, customerEmailRequired
  } = settings;
  const deliveryFee = toPesewas(campusDeliveryFee);
  if (!toE164(whatsappNumber) || (payment && (!toGhanaPhone(momoNumber) || !cleanText(momoAccountName)))) {
    throw checkoutError(503, 'Mobile Money checkout is temporarily unavailable. Please try again later.');
  }

  const byId = new Map(products.map(product => [String(product.id), product]));
  let subtotal = 0;
  const items = quantities.map(({ productId, variantId, quantity }) => {
    const product = byId.get(productId);
    const option = variantId ? product?.variants?.find(variant => variant.id === variantId) : product;
    const price = toPesewas(option?.salePrice ?? option?.price);
    if (!product || product.enabled === false || !option || (!variantId && product.variants?.length) ||
        (option.stockQuantity != null && option.stockQuantity < quantity) ||
        !Number.isSafeInteger(price) || price <= 0) {
      throw checkoutError(409, 'An item or quantity in your cart is unavailable. Update your cart and try again.');
    }
    subtotal += price * quantity;
    return {
      productId: product.id, variantId, name: product.name, category: product.category, quantity, unitPrice: price / 100,
      ...(variantId ? { variantLabel: option.label } : {}),
      ...(option.sizeMl ? { sizeMl: option.sizeMl } : {})
    };
  });
  if (subtotal <= 0 || !Number.isSafeInteger(subtotal + deliveryFee)) {
    throw checkoutError(409, 'The cart total is unavailable. Review your cart and try again.');
  }

  const quote = {
    items,
    subtotal: subtotal / 100,
    ...(payment ? { momoNumber: toGhanaPhone(momoNumber), momoAccountName: cleanText(momoAccountName) } : {}),
    whatsappNumber: toE164(whatsappNumber),
    pickupLocation: cleanText(pickupLocation),
    campusDeliveryFee: deliveryFee / 100,
    customerEmailRequired
  };
  return { ...quote, ...(payment ? { momoPaymentInstructions: momoPaymentInstructions || '' } : {}),
    campusDestinations, quoteKey: hash(quote), priceKey: cartPriceKey(items) };
}

module.exports = {
  campus, campusDeliveryFee, pickupLocation, cleanText, toE164, toGhanaPhone, toPesewas, formatCurrency,
  hash, cartPriceKey, checkoutError, parseItems, parseOrder, buildQuote
};
