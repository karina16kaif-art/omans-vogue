import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Send, Wallet, X } from 'lucide-react';
import { api } from '../lib/api';
import { lineKey } from '../lib/catalogue';

const initialDetails = {
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  fulfilmentMethod: 'pickup',
  campusDestination: '',
  addressDetails: '',
  area: '',
  address: '',
  landmark: '',
  momoPhone: '',
  paymentReference: ''
};

const currency = (amount) => `GH₵${Number(amount).toFixed(2)}`;
const inputClass = 'w-full px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/25 text-white text-base focus:border-luxury-rosegold focus:outline-none rounded-none';
const labelClass = 'block space-y-1 text-sm text-luxury-champagne';
const headingClass = 'text-sm uppercase tracking-widest text-luxury-rosegold font-bold';
const actionClass = 'w-full py-3 px-4 bg-white text-luxury-black text-sm font-bold flex items-center justify-center gap-2 hover:bg-luxury-gold transition-colors disabled:opacity-50';

const CheckoutModal = ({ isOpen, onClose, cartItems, receipt, onOrderSaved, deliveryQuoteToken }) => {
  const [details, setDetails] = useState(initialDetails);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoteRevision, setQuoteRevision] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [paymentSupport, setPaymentSupport] = useState('');
  const deliveryRequest = receipt?.requestId && !receipt.orderId ? receipt : null;
  const attempt = useRef(null);
  const approvedDelivery = deliveryQuoteToken !== undefined;
  const awaitingDeliveryFee = !approvedDelivery && details.fulfilmentMethod === 'outside_campus';
  const needsDestination = details.fulfilmentMethod === 'delivery' && !details.campusDestination;
  const showPayment = !awaitingDeliveryFee && !needsDestination;
  const items = React.useMemo(() => cartItems.map(item => ({
    productId: item.id,
    variantId: item.variantId ?? null,
    quantity: item.quantity
  })), [cartItems]);

  useEffect(() => {
    if (!isOpen || receipt || attempt.current || (!approvedDelivery && !items.length)) return;

    const controller = new AbortController();
    setQuote(null);
    setQuoteError('');
    const path = approvedDelivery ? '/api/checkout/delivery-quotes/resume' : '/api/checkout/quote';
    api.post(path, approvedDelivery ? { deliveryQuoteToken } : { items }, { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (data.receipt) onOrderSaved(data.receipt);
        else setQuote(approvedDelivery ? data.quote : data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setQuoteError(error.response?.data?.error || 'Checkout is temporarily unavailable. Please try again.');
        }
      });
    return () => controller.abort();
  }, [approvedDelivery, deliveryQuoteToken, isOpen, items, onOrderSaved, quoteRevision, receipt]);

  const close = () => {
    if (!submitting) onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, submitting]);

  const setDetail = ({ target }) => {
    setDetails(previous => ({ ...previous, [target.name]: target.value }));
  };

  const selectDestination = ({ target }) => {
    setDetails(previous => ({
      ...previous,
      fulfilmentMethod: target.value === 'outside_campus' ? 'outside_campus' : 'delivery',
      campusDestination: target.value === 'outside_campus' ? '' : target.value
    }));
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!quote || submitting || needsDestination) return;

    const fields = approvedDelivery
      ? { deliveryQuoteToken, momoPhone: details.momoPhone, paymentReference: details.paymentReference }
      : { ...details, items };
    attempt.current ||= {
      ...fields,
      ...(awaitingDeliveryFee ? { priceKey: quote.priceKey } : { quoteKey: quote.quoteKey }),
      requestId: crypto.randomUUID()
    };
    setSubmitting(true);
    setCheckoutError('');
    setPaymentSupport('');
    let savedOrder;
    const payload = attempt.current;
    try {
      const endpoint = awaitingDeliveryFee ? '/api/checkout/delivery-quotes' : '/api/orders';
      const { data } = await api.post(endpoint, payload);
      if (!(awaitingDeliveryFee ? data?.requestId : data?.orderId) || !data.whatsappUrl?.startsWith('https://wa.me/')) {
        throw new Error('Missing order receipt');
      }
      savedOrder = data;
    } catch (error) {
      const status = error.response?.status;
      if (status >= 400 && status < 500) {
        attempt.current = null;
        setCheckoutError(error.response?.data?.error || 'Review your order details and try again.');
        if (status === 409) {
          if (!awaitingDeliveryFee) setPaymentSupport(quote.whatsappNumber || '');
          setQuoteRevision(previous => previous + 1);
        }
      } else {
        setCheckoutError('We couldn’t confirm that your submission was saved. Retry with the same details.');
      }
    } finally {
      setSubmitting(false);
    }

    if (savedOrder) {
      attempt.current = null;
      setDetails(initialDetails);
      onOrderSaved(savedOrder, awaitingDeliveryFee ? [] : payload.items);
    }
  };

  if (!isOpen) return null;

  const delivery = approvedDelivery || details.fulfilmentMethod !== 'pickup';
  const deliveryFee = approvedDelivery ? quote?.deliveryFee : delivery ? quote?.campusDeliveryFee : 0;
  const total = approvedDelivery ? quote?.total : Number(quote?.subtotal) + deliveryFee;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div onClick={close} className="absolute inset-0 bg-black/85 backdrop-blur-md" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        className="relative w-full max-w-xl max-h-[90dvh] overflow-y-auto overscroll-contain glass-panel-heavy border border-luxury-rosegold/20 shadow-2xl p-5 sm:p-8"
      >
        <button
          type="button"
          aria-label="Close checkout"
          onClick={close}
          disabled={submitting}
          className="absolute top-4 right-4 p-2 border border-luxury-rosegold/20 text-luxury-champagne hover:text-white rounded-full disabled:opacity-40"
        >
          <X size={17} />
        </button>
        <header className="text-center px-8 pb-4 mb-5 border-b border-luxury-rosegold/15">
          <h2 id="checkout-title" className="font-serif text-xl tracking-widest text-white uppercase font-black">
            {deliveryRequest ? 'Purchase request saved' : receipt ? 'Order saved' : 'Checkout'}
          </h2>
        </header>

        {receipt && !deliveryRequest ? (
          <div className="space-y-4 text-center text-luxury-champagne">
            <CheckCircle2 className="mx-auto text-luxury-gold" size={32} aria-hidden="true" />
            <p className="font-semibold break-all">{receipt.orderNumber || receipt.orderId}</p>
            <p>{receipt.orderStatus || 'Payment Verification'} · {receipt.paymentStatus === 'Paid' ? 'Payment verified' : 'Payment pending'}</p>
            <p>Your order is saved in Eugenia’s dashboard.</p>
            {receipt.whatsappUrl && <>
              <p>To notify Eugenia, open WhatsApp and press <strong>Send</strong>.</p>
              <a href={receipt.whatsappUrl} target="_blank" rel="noopener noreferrer" className={actionClass}>
                <Send size={16} /> Open WhatsApp notification
              </a>
            </>}
            <button type="button" onClick={close} className="px-4 py-2 underline underline-offset-4">Done</button>
          </div>
        ) : deliveryRequest ? (
          <div className="space-y-4 text-center text-luxury-champagne">
            <p className="font-semibold">{deliveryRequest.orderNumber}</p>
            <p>Eugenia can see your saved request in Orders. She’ll confirm the delivery fee before payment.</p>
            <p>Availability will be checked again before checkout.</p>
            {deliveryRequest.whatsappUrl && <>
              <p>To notify Eugenia, open WhatsApp and press <strong>Send</strong>.</p>
              <a href={deliveryRequest.whatsappUrl} target="_blank" rel="noopener noreferrer" className={actionClass}>
                <Send size={16} /> Open WhatsApp notification
              </a>
            </>}
            <button type="button" onClick={close} className="px-4 py-2 underline underline-offset-4">Done</button>
          </div>
        ) : (
          <form onSubmit={submitOrder} className="space-y-5">
            {quoteError && (
              <div className="space-y-2">
                <p role="alert" className="text-sm text-luxury-rosegold">{quoteError}</p>
                <button type="button" className="underline underline-offset-4 text-sm" onClick={() => setQuoteRevision(previous => previous + 1)}>
                  Retry checkout
                </button>
              </div>
            )}
            {!quote && !quoteError && <p role="status" className="text-sm text-luxury-champagne">Loading checkout details…</p>}
            {checkoutError && <p role="alert" className="text-sm text-luxury-rosegold">{checkoutError}</p>}
            {paymentSupport && (
              <p className="text-sm text-luxury-champagne">
                If you already transferred your payment, share your reference with{' '}
                <a className="underline text-luxury-gold" href={`https://wa.me/${paymentSupport.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer">WhatsApp support</a>.
              </p>
            )}

            {quote && (
              <>
                <fieldset disabled={submitting || Boolean(attempt.current)} className="space-y-5">
                  {!approvedDelivery && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CheckoutInput label="Full name" name="customerName" value={details.customerName} onChange={setDetail} autoComplete="name" maxLength={120} />
                    <CheckoutInput label="Contact phone" name="customerPhone" value={details.customerPhone} onChange={setDetail} type="tel" autoComplete="tel" maxLength={24} />
                    {quote.customerEmailRequired && (
                      <CheckoutInput label="Contact email" name="customerEmail" value={details.customerEmail} onChange={setDetail} type="email" autoComplete="email" maxLength={254} />
                    )}
                  </div>}

                  <fieldset className="space-y-3">
                    <legend className={headingClass}>Fulfilment</legend>
                    {approvedDelivery ? (
                      <p className="text-sm text-white break-words">{quote.orderNumber} · {quote.destination.area} · {quote.destination.address} · Landmark: {quote.destination.landmark}</p>
                    ) : <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[['pickup', 'Pickup · Free'], ['delivery', 'Delivery']].map(([value, label]) => (
                        <label key={value} className={`flex items-center gap-2 p-3 border text-sm cursor-pointer ${(value === 'delivery' ? delivery : !delivery) ? 'border-luxury-gold/60 text-white' : 'border-luxury-rosegold/25 text-luxury-champagne'}`}>
                          <input type="radio" name="fulfilmentMethod" value={value} checked={value === 'delivery' ? delivery : !delivery} onChange={setDetail} className="accent-luxury-gold" />
                          {label}
                        </label>
                      ))}
                    </div>
                    {delivery ? (
                      <>
                        <label className={labelClass}>
                          <span>Delivery destination</span>
                          <select required name="campusDestination" value={awaitingDeliveryFee ? 'outside_campus' : details.campusDestination} onChange={selectDestination} className={inputClass}>
                            <option value="">Select a destination</option>
                            {quote.campusDestinations.map(destination => <option key={destination}>{destination}</option>)}
                            <option value="outside_campus">Other location / Outside campus</option>
                          </select>
                        </label>
                        {awaitingDeliveryFee ? <>
                          <CheckoutInput label="Delivery area" name="area" value={details.area} onChange={setDetail} maxLength={120} />
                          <CheckoutInput label="Detailed address" name="address" value={details.address} onChange={setDetail} maxLength={300} />
                          <CheckoutInput label="Nearby landmark" name="landmark" value={details.landmark} onChange={setDetail} maxLength={180} />
                        </> : <CheckoutInput label="Room number or entrance at this location" name="addressDetails" value={details.addressDetails} onChange={setDetail} maxLength={180} />}
                      </>
                    ) : (
                      <p className="text-sm text-white">{quote.pickupLocation}</p>
                    )}
                    </>}
                  </fieldset>

                  <div className="space-y-2 border-y border-luxury-rosegold/15 py-3 text-sm">
                    {quote.items.map(item => (
                      <div key={lineKey(item.productId, item.variantId)} className="flex justify-between gap-3 text-luxury-champagne">
                        <span>{item.quantity} × {item.name}{item.variantLabel ? ` · ${item.variantLabel}` : ''}</span>
                        <span className="whitespace-nowrap">{currency(item.quantity * item.unitPrice)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between gap-3">
                      <span>Product subtotal</span><span>{currency(quote.subtotal)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>{delivery ? 'Delivery fee' : 'Pickup'}</span>
                      <span>{awaitingDeliveryFee ? 'Delivery fee to be confirmed' : needsDestination ? 'Select a destination' : delivery ? currency(deliveryFee) : 'Free'}</span>
                    </div>
                    {showPayment && <div className="flex justify-between gap-3 pt-2 font-serif font-bold text-lg text-luxury-gold">
                      <span>Total to pay</span><span>{currency(total)}</span>
                    </div>}
                  </div>
                  <p className="text-sm text-luxury-champagne/80">Product prices are fixed as displayed. Delivery charges may vary depending on your location and will be confirmed before payment.</p>

                  {showPayment && <div className="space-y-3">
                    <h3 className={`flex items-center gap-2 ${headingClass}`}><Wallet size={16} /> Mobile Money</h3>
                    <p className="text-sm text-luxury-champagne">Open your MoMo app and send <strong className="text-white">{currency(total)}</strong> to the account below. Then enter the transaction reference from your MoMo receipt.</p>
                    {quote.momoPaymentInstructions && (
                      <p className="whitespace-pre-wrap break-words text-sm text-luxury-champagne">{quote.momoPaymentInstructions}</p>
                    )}
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 border border-luxury-gold/25 text-sm">
                      <div><dt className="text-luxury-champagne">MoMo number</dt><dd className="font-semibold text-white">{quote.momoNumber}</dd></div>
                      <div><dt className="text-luxury-champagne">Account name</dt><dd className="font-semibold text-white break-words">{quote.momoAccountName}</dd></div>
                    </dl>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <CheckoutInput label="MoMo phone used to pay" name="momoPhone" value={details.momoPhone} onChange={setDetail} type="tel" maxLength={24} />
                      <CheckoutInput label="Payment reference" name="paymentReference" value={details.paymentReference} onChange={setDetail} maxLength={100} autoComplete="off" />
                    </div>
                  </div>}
                </fieldset>

                {!needsDestination && <p className="text-sm text-luxury-champagne/80">{awaitingDeliveryFee
                  ? 'The merchant will confirm your delivery fee in WhatsApp before you pay.'
                  : 'We’ll verify your payment manually after you save the order.'}</p>}
                <button type="submit" disabled={submitting || needsDestination} className={actionClass}>
                  <Send size={16} />
                  {submitting ? 'Saving…' : attempt.current ? 'Retry submission' : awaitingDeliveryFee ? 'Save purchase request' : 'Save order'}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

const CheckoutInput = ({ label, ...props }) => (
  <label className={labelClass}>
    <span>{label}</span>
    <input required className={inputClass} {...props} />
  </label>
);

export default React.memo(CheckoutModal);
