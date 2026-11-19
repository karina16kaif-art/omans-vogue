const { cleanText, formatCurrency, toE164, toPesewas } = require('./checkout');

const ORDER_STATUSES = [
  'Pending Merchant Review', 'Awaiting Delivery Fee', 'Awaiting Payment', 'Payment Verification',
  'Confirmed', 'Processing', 'Ready for Pickup', 'Out for Delivery', 'Delivered', 'Cancelled'
];
const PENDING_STATUSES = ORDER_STATUSES.slice(0, 4);

function orderStatus(value) {
  const status = cleanText(value).toLowerCase();
  if (status === 'canceled') return 'Cancelled';
  return ORDER_STATUSES.find(item => item.toLowerCase() === status) || 'Pending Merchant Review';
}

const orderNumber = value => value == null ? null : `OMP-${String(value).padStart(4, '0')}`;
const isVerified = order => order.paymentStatus === 'Paid' && Boolean(order.paymentVerifiedAt);
const isTerminal = order => ['Delivered', 'Cancelled'].includes(order.orderStatus);
const canVerifyPayment = order => !order.isPurchaseRequest && order.orderStatus !== 'Cancelled' &&
  !isVerified(order) && Boolean(cleanText(order.paymentReference));

function allowedStatuses(order) {
  if (isTerminal(order)) return [order.orderStatus];
  if (order.isPurchaseRequest) {
    return order.approved
      ? ['Awaiting Payment', 'Cancelled']
      : ['Pending Merchant Review', 'Awaiting Delivery Fee', 'Cancelled'];
  }

  const verified = isVerified(order);
  const current = order.orderStatus;
  const handoff = order.fulfilmentMethod === 'pickup' ? 'Ready for Pickup' : 'Out for Delivery';
  const review = PENDING_STATUSES.includes(current);
  return ORDER_STATUSES.filter(status => {
    if (status === current || status === 'Cancelled') return true;
    if (status === 'Pending Merchant Review') return review;
    if (status === 'Awaiting Payment') return !verified && review;
    if (status === 'Payment Verification') return review && canVerifyPayment(order);
    if (!verified) return false;
    if (status === 'Confirmed') return review;
    if (status === 'Processing') return current === 'Confirmed';
    if (status === handoff) return ['Confirmed', 'Processing'].includes(current);
    return status === 'Delivered' && current === handoff;
  });
}

const productSubtotal = (items) => items.reduce((total, item) => {
  const quantity = Number(item.quantity);
  const unitPrice = toPesewas(item.unitPrice ?? item.price);
  return Number.isFinite(unitPrice) && Number.isSafeInteger(quantity) ? total + unitPrice * quantity : total;
}, 0) / 100;

const whatsappUrl = (phone, text) => {
  const number = toE164(phone);
  return number ? `https://wa.me/${number.slice(1)}?text=${encodeURIComponent(text)}` : null;
};

const dateFormat = new Intl.DateTimeFormat('en-GH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Accra'
});
const displayText = value => cleanText(value).replace(/[*_`~]/g, '') || '—';
const methodNames = { delivery: 'Campus delivery', outside_campus: 'Outside-campus delivery', pickup: 'Pickup' };
const paymentLabel = order => isVerified(order) ? 'Verified' : order.paymentStatus === 'Paid' ? 'Unverified' : order.paymentStatus || 'Pending';

function buildWhatsAppMessage(order) {
  const date = new Date(order.requestedAt || order.createdAt);
  const pickup = order.fulfilmentMethod === 'pickup';
  const address = pickup ? order.pickupLocation : order.address || order.deliveryAddress;
  const destination = pickup ? order.pickupLocation : order.area || (order.fulfilmentMethod === 'delivery'
    ? address?.split(', University of Ghana')[0] : order.cityRegion);
  const action = order.orderStatus === 'Cancelled' ? 'Review any follow-up from the customer.'
    : order.deliveryFee == null ? 'Eugenia, please review the purchase request and confirm the rider fee in Orders.'
    : order.isPurchaseRequest ? 'Eugenia, please share the approved checkout link if the customer still needs it.'
    : isVerified(order) ? 'Eugenia, please review the current fulfilment status in Orders.'
    : 'Eugenia, please verify the Mobile Money transfer against the payment reference before fulfilment.';
  return [
    "*Oman's Parfum*",
    `*Purchase request ${order.orderNumber || order.id}*`,
    `Order date: ${Number.isNaN(date.valueOf()) ? '—' : dateFormat.format(date)}`,
    '',
    '*Customer*',
    `Name: ${displayText(order.customerName)}`,
    `Phone: ${displayText(order.customerPhone)}`,
    '',
    '*Perfumes*',
    ...order.items.map(item => `• ${item.quantity} × ${displayText(item.name)}${item.variantLabel ? ` (${displayText(item.variantLabel)})` : item.sizeMl ? ` (${item.sizeMl} ml)` : ''} @ ${formatCurrency(item.unitPrice ?? item.price)} each`),
    `Product subtotal: ${formatCurrency(order.subtotal ?? productSubtotal(order.items))}`,
    '',
    '*Delivery and payment*',
    `Delivery method: ${methodNames[order.fulfilmentMethod] || 'Delivery'}`,
    `Destination: ${displayText(destination || address)}`,
    `Address: ${displayText(address)}`,
    `Landmark: ${pickup ? '—' : displayText(order.landmark)}`,
    `Delivery fee: ${order.deliveryFee == null ? 'Awaiting Merchant Approval' : formatCurrency(order.deliveryFee)}`,
    ...(order.deliveryFee != null && order.totalAmount != null ? [`*Final total: ${formatCurrency(order.totalAmount)}*`] : []),
    `Order status: ${order.orderStatus}`,
    `Payment status: ${paymentLabel(order)}`,
    ...(order.momoPhone ? [`MoMo phone: ${displayText(order.momoPhone)}`] : []),
    ...(order.paymentReference ? [`Payment reference: ${displayText(order.paymentReference)}`] : []),
    '',
    '*Merchant action*',
    action
  ].join('\n');
}

function customerMessage(order) {
  return [
    "*Oman's Parfum*",
    `Hello ${displayText(order.customerName)}, this is Eugenia following up on ${order.orderNumber || order.id}.`,
    `Order status: ${order.orderStatus}`,
    `Payment status: ${paymentLabel(order)}`,
    order.deliveryFee == null ? 'I’ll confirm the rider fee before payment.' : null,
    order.isPurchaseRequest && order.approved && order.orderStatus !== 'Cancelled'
      ? 'Please contact me if you need help with your approved checkout link.' : null,
    'Please reply here if you have any questions.'
  ].filter(Boolean).join('\n');
}

module.exports = {
  ORDER_STATUSES, PENDING_STATUSES, orderStatus, orderNumber, isVerified, canVerifyPayment, allowedStatuses,
  productSubtotal, whatsappUrl, buildWhatsAppMessage, customerMessage
};
