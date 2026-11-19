const { createHmac, timingSafeEqual } = require('node:crypto');
const { cartPriceKey, checkoutError, cleanText, formatCurrency, hash, parseItems, toE164, toPesewas } = require('./checkout');

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const linkLifetimeMs = 24 * 60 * 60 * 1000;

function parseDeliveryRequest(body) {
  const id = cleanText(body.requestId).toLowerCase();
  const customerName = cleanText(body.customerName);
  const customerPhone = toE164(body.customerPhone);
  const customerEmail = cleanText(body.customerEmail);
  const area = cleanText(body.area);
  const address = cleanText(body.address);
  const landmark = cleanText(body.landmark);
  const priceKey = cleanText(body.priceKey);
  if (!uuid.test(id) || !/^[a-f0-9]{64}$/.test(priceKey)) throw checkoutError(400, 'Refresh checkout and try again.');
  if (!customerName || customerName.length > 120 || !customerPhone) throw checkoutError(400, 'Enter your name and a valid contact phone.');
  if (customerEmail && (customerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))) {
    throw checkoutError(400, 'Enter a valid contact email.');
  }
  if (!area || area.length > 120 || !address || address.length > 300 || !landmark || landmark.length > 180) {
    throw checkoutError(400, 'Enter the delivery area, detailed address and nearby landmark.');
  }
  return { id, customerName, customerPhone, customerEmail, area, address, landmark, priceKey, items: parseItems(body.items) };
}

function riderFee(value) {
  if (!['string', 'number'].includes(typeof value) || !/^\d{1,7}(\.\d{1,2})?$/.test(String(value))) {
    throw checkoutError(400, 'Enter the rider fee in Ghana cedis with up to two decimal places.');
  }
  return toPesewas(value);
}

const totalWithFee = (row) => (toPesewas(row.subtotal) + toPesewas(row.delivery_fee)) / 100;
const waLink = (phone, text) => `https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(text)}`;

module.exports = function createDeliveryQuotes({ secret, origin, supabaseRequest, quoteCart, requireCheckout }) {
  const readQuote = async (id) => {
    const [row] = await supabaseRequest(`delivery_quotes?id=eq.${id}&limit=1`);
    return row;
  };
  const sign = (id) => createHmac('sha256', secret).update(`omans-delivery-quote:v1:${id}`).digest();
  const tokenFor = (row) => `${row.id}.${sign(row.id).toString('base64url')}`;
  const isActive = (row) => row?.approved_at && Date.parse(row.expires_at) > Date.now();

  const shareQuote = (row) => {
    if (!isActive(row)) return {};
    const link = new URL('/checkout/delivery', origin);
    link.hash = tokenFor(row);
    const message = [
      `Your Oman's Vogue delivery quote ${row.id} is ready.`,
      `Product subtotal: ${formatCurrency(row.subtotal)}`,
      `Delivery fee: ${formatCurrency(row.delivery_fee)}`,
      `Total: ${formatCurrency(totalWithFee(row))}`,
      'Review the approved details and Mobile Money instructions here:',
      link.href
    ].join('\n');
    return { checkoutUrl: link.href, whatsappUrl: waLink(row.customer_phone, message) };
  };

  const asAdmin = (row) => ({
    id: row.id, customerName: row.customer_name, customerPhone: row.customer_phone,
    area: row.area, address: row.address, landmark: row.landmark, items: row.items,
    subtotal: Number(row.subtotal), deliveryFee: row.delivery_fee === null ? null : Number(row.delivery_fee),
    total: row.approved_at ? totalWithFee(row) : null, approved: Boolean(row.approved_at),
    expiresAt: row.expires_at, createdAt: row.created_at, ...shareQuote(row)
  });

  const recheckCart = async (row, payment) => {
    const quote = await quoteCart(parseItems(row.items), { payment });
    if (cartPriceKey(row.items) !== quote.priceKey) {
      throw checkoutError(409, 'Product prices changed. Please request a fresh delivery quote before paying.');
    }
    return quote;
  };

  async function requestQuote(body) {
    requireCheckout();
    const request = parseDeliveryRequest(body);
    const requestHash = hash(request);
    let row = await readQuote(request.id);
    if (!row) {
      const quote = await quoteCart(request.items, { payment: false });
      if (quote.customerEmailRequired && !request.customerEmail) throw checkoutError(400, 'Enter a valid contact email.');
      if (quote.priceKey !== request.priceKey) throw checkoutError(409, 'Product prices changed. Review the subtotal and try again.');
      const [inserted] = await supabaseRequest('delivery_quotes?on_conflict=id', {
        method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation,missing=default' },
        body: JSON.stringify({
          id: request.id, request_hash: requestHash, customer_name: request.customerName,
          customer_phone: request.customerPhone, customer_email: request.customerEmail || null,
          area: request.area, address: request.address, landmark: request.landmark,
          items: quote.items, subtotal: quote.subtotal, whatsapp_number: quote.whatsappNumber
        })
      });
      row = inserted || await readQuote(request.id);
    }
    if (!row || row.request_hash !== requestHash) throw checkoutError(409, 'This quote request was already used. Please start a new request.');
    return {
      requestId: row.id,
      whatsappUrl: waLink(row.whatsapp_number, [
        `Hello, please confirm delivery quote ${row.id} for ${row.area}.`,
        `Product subtotal: ${formatCurrency(row.subtotal)}`,
        'Delivery fee to be confirmed.'
      ].join('\n'))
    };
  }

  async function listQuotes(reviewed, page) {
    if (!/^\d{1,6}$/.test(String(page))) throw checkoutError(400, 'Choose a valid quote page.');
    const limit = 20;
    const approval = reviewed ? 'not.is.null' : 'is.null';
    const rows = await supabaseRequest(`delivery_quotes?approved_at=${approval}&order=created_at.desc,id.desc&limit=${limit + 1}&offset=${Number(page) * limit}`);
    return { quotes: rows.slice(0, limit).map(asAdmin), hasMore: rows.length > limit };
  }

  async function approveQuote(id, amount) {
    const fee = riderFee(amount);
    let row = uuid.test(id) ? await readQuote(id) : null;
    if (!row) throw checkoutError(404, 'Delivery quote request was not found.');
    if (!row.approved_at) {
      await recheckCart(row, true);
      const now = Date.now();
      const [approved] = await supabaseRequest(`delivery_quotes?id=eq.${id}&approved_at=is.null`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          delivery_fee: fee / 100, approved_at: new Date(now).toISOString(),
          expires_at: new Date(now + linkLifetimeMs).toISOString()
        })
      });
      row = approved || await readQuote(id);
    }
    if (!isActive(row) || toPesewas(row.delivery_fee) !== fee) {
      throw checkoutError(409, 'This quote was already confirmed or has expired. Ask the customer to request a new quote.');
    }
    return asAdmin(row);
  }

  async function fromToken(token) {
    const [id, proof, extra] = typeof token === 'string' ? token.split('.') : [];
    if (extra !== undefined || !uuid.test(id || '') || !/^[A-Za-z0-9_-]{43}$/.test(proof || '') ||
        !timingSafeEqual(sign(id), Buffer.from(proof, 'base64url'))) {
      throw checkoutError(404, 'This delivery checkout link is invalid.');
    }
    const row = await readQuote(id);
    if (!isActive(row)) throw checkoutError(410, 'This delivery quote has expired. Contact the merchant before paying.');
    return row;
  }

  async function payableQuote(row) {
    const quote = await recheckCart(row, true);
    const deliveryFee = Number(row.delivery_fee);
    if (quote.customerEmailRequired && !row.customer_email) throw checkoutError(409, 'This quote needs a new contact email. Ask the merchant for a new quote.');
    return {
      ...quote, deliveryFee, total: totalWithFee(row), expiresAt: row.expires_at,
      destination: { area: row.area, address: row.address, landmark: row.landmark },
      quoteKey: hash([quote.quoteKey, row.id, toPesewas(deliveryFee)])
    };
  }

  return { requestQuote, listQuotes, approveQuote, fromToken, payableQuote };
};
