const { createHmac, timingSafeEqual } = require('node:crypto');
const { cartPriceKey, checkoutError, cleanText, formatCurrency, hash, isExactPesewaAmount, parseItems, toE164, toPesewas } = require('./checkout');
const { allowedStatuses, buildWhatsAppMessage, customerMessage, orderNumber, whatsappUrl } = require('./order-workflow');

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const linkLifetimeMs = 24 * 60 * 60 * 1000;
const projection = 'select=*,order_number_text:order_number::text';

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

module.exports = function createDeliveryQuotes({ secret, origin, supabaseRequest, quoteCart, requireCheckout }) {
  const readQuote = async (id) => {
    const [row] = await supabaseRequest(`delivery_quotes?${projection}&id=eq.${id}&limit=1`);
    return row;
  };
  const sign = (id) => createHmac('sha256', secret).update(`omans-delivery-quote:v1:${id}`).digest();
  const tokenFor = (row) => `${row.id}.${sign(row.id).toString('base64url')}`;
  const isActive = (row) => row?.merchant_status === 'Awaiting Payment' && row.approved_at && Date.parse(row.expires_at) > Date.now();

  const shareQuote = (row) => {
    if (!isActive(row)) return {};
    const link = new URL('/checkout/delivery', origin);
    link.hash = tokenFor(row);
    const message = [
      "*Oman's Parfum*",
      `Hello ${row.customer_name}, this is Eugenia. Delivery for ${orderNumber(row.order_number_text)} is approved.`,
      `Product subtotal: ${formatCurrency(row.subtotal)}`,
      `Delivery fee: ${formatCurrency(row.delivery_fee)}`,
      `Total: ${formatCurrency(totalWithFee(row))}`,
      'Review the approved details and Mobile Money instructions through this private link:',
      link.href
    ].join('\n');
    return { checkoutUrl: link.href, whatsappUrl: whatsappUrl(row.customer_phone, message) };
  };

  const asAdmin = (row) => {
    const approved = Boolean(row.approved_at);
    const request = {
      id: row.id, orderNumber: orderNumber(row.order_number_text), isPurchaseRequest: true,
      customerName: row.customer_name, customerPhone: row.customer_phone, customerEmail: row.customer_email,
      area: row.area, address: row.address, landmark: row.landmark, items: row.items,
      subtotal: Number(row.subtotal), deliveryFee: row.delivery_fee === null ? null : Number(row.delivery_fee),
      total: approved ? totalWithFee(row) : null, totalAmount: approved ? totalWithFee(row) : null,
      approved, orderStatus: row.merchant_status, paymentStatus: 'Pending', paymentMethod: 'Mobile Money',
      fulfilmentMethod: 'outside_campus', history: row.merchant_history || [],
      expiresAt: row.expires_at, createdAt: row.created_at
    };
    const links = shareQuote(row);
    return {
      ...request, ...links, allowedStatuses: allowedStatuses(request),
      customerWhatsappUrl: links.whatsappUrl || whatsappUrl(row.customer_phone, customerMessage(request))
    };
  };

  const recheckCart = async (row, payment) => {
    const quote = await quoteCart(parseItems(row.items), { payment });
    if (cartPriceKey(row.items) !== quote.priceKey) {
      throw checkoutError(409, 'Product prices changed. Please submit a new purchase request before paying.');
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
      const [inserted] = await supabaseRequest(`delivery_quotes?${projection}&on_conflict=id`, {
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
    if (!row || row.request_hash !== requestHash) throw checkoutError(409, 'This purchase request was already used. Please start a new request.');
    const purchase = asAdmin(row);
    return {
      requestId: row.id,
      orderNumber: purchase.orderNumber,
      whatsappUrl: whatsappUrl(row.whatsapp_number, buildWhatsAppMessage(purchase))
    };
  }

  async function listQuotes(reviewed, page) {
    if (!/^\d{1,6}$/.test(String(page))) throw checkoutError(400, 'Choose a valid quote page.');
    const limit = 20;
    const approval = reviewed ? 'not.is.null' : 'is.null';
    const rows = await supabaseRequest(`delivery_quotes?${projection}&approved_at=${approval}&order=created_at.desc,id.desc&limit=${limit + 1}&offset=${Number(page) * limit}`);
    return { quotes: rows.slice(0, limit).map(asAdmin), hasMore: rows.length > limit };
  }

  async function readPurchases() {
    const rows = [];
    let cursor = '';
    do {
      const batch = await supabaseRequest(`delivery_quotes?${projection}&order=order_number.asc&limit=500${cursor}`);
      rows.push(...batch);
      if (batch.length < 500) return rows.map(asAdmin);
      cursor = `&order_number=gt.${batch.at(-1).order_number_text}`;
    } while (true);
  }

  async function updatePurchaseStatus(id, status) {
    const current = uuid.test(id) ? await readQuote(id) : null;
    if (!current) return null;
    if (!allowedStatuses(asAdmin(current)).includes(status)) throw checkoutError(409, 'This fulfilment status is unavailable for the purchase request.');
    if (current.merchant_status === status) return asAdmin(current);
    const [row] = await supabaseRequest(
      `delivery_quotes?${projection}&id=eq.${id}&merchant_status=eq.${encodeURIComponent(current.merchant_status)}`,
      { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ merchant_status: status }) }
    );
    if (!row) throw checkoutError(409, 'The purchase request changed. Refresh Orders and try again.');
    return asAdmin(row);
  }

  async function approveQuote(id, amount) {
    const fee = riderFee(amount);
    let row = uuid.test(id) ? await readQuote(id) : null;
    if (!row) throw checkoutError(404, 'Purchase request not found.');
    if (row.merchant_status === 'Cancelled') throw checkoutError(409, 'This purchase request has been cancelled.');
    if (!row.approved_at) {
      await recheckCart(row, true);
      if (!isExactPesewaAmount(toPesewas(row.subtotal) + fee)) {
        throw checkoutError(409, 'The total with this rider fee cannot be represented exactly. Review the delivery fee.');
      }
      const now = Date.now();
      const [approved] = await supabaseRequest(`delivery_quotes?${projection}&id=eq.${id}&approved_at=is.null&merchant_status=eq.${encodeURIComponent(row.merchant_status)}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          delivery_fee: fee / 100, approved_at: new Date(now).toISOString(),
          expires_at: new Date(now + linkLifetimeMs).toISOString()
        })
      });
      row = approved || await readQuote(id);
    }
    if (!isActive(row) || toPesewas(row.delivery_fee) !== fee) {
      throw checkoutError(409, 'This fee was already approved or the link has expired. Ask the customer to submit a new purchase request if needed.');
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
    if (!isActive(row)) throw checkoutError(410, 'This purchase link has expired or is unavailable. Contact the merchant before paying.');
    return row;
  }

  async function payableQuote(row) {
    const quote = await recheckCart(row, true);
    const deliveryFee = Number(row.delivery_fee);
    if (quote.customerEmailRequired && !row.customer_email) throw checkoutError(409, 'This purchase request needs a contact email. Please submit a new request.');
    return {
      ...quote, deliveryFee, total: totalWithFee(row), expiresAt: row.expires_at,
      orderNumber: orderNumber(row.order_number_text),
      destination: { area: row.area, address: row.address, landmark: row.landmark },
      quoteKey: hash([quote.quoteKey, row.id, toPesewas(deliveryFee)])
    };
  }

  return { requestQuote, listQuotes, readPurchases, updatePurchaseStatus, approveQuote, fromToken, payableQuote };
};
