import React, { useState } from 'react';
import { X, ShieldCheck, Wallet, CreditCard, Send, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

const CheckoutModal = ({ isOpen, onClose, cartItems, onClearCart }) => {
  if (!isOpen) return null;

  const WHATSAPP_NUMBER = '+233591259991';

  // Step state: 'billing' | 'success'
  const [step, setStep] = useState('billing');
  const [paymentMethod, setPaymentMethod] = useState('momo'); // 'momo' | 'card'

  // Input states
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    momoProvider: 'MTN',
    momoNumber: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: '',
    cardName: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const total = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Trigger rose gold / gold luxury confetti burst!
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#b76e79', '#d4af37', '#ebd2b0']
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#b76e79', '#d4af37', '#ebd2b0']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());

    // Build the beautiful WhatsApp Order Invoice Text
    let orderDetails = `*👑 OMAN'S VOGUE - ORDER INVOICE* \n`;
    orderDetails += `--------------------------------------\n`;
    orderDetails += `*Customer Details:*\n`;
    orderDetails += `• Name: ${formData.name}\n`;
    orderDetails += `• Delivery Phone: ${formData.phone}\n`;
    orderDetails += `• Destination: ${formData.address}, ${formData.city}\n`;
    orderDetails += `\n*Payment Details:*\n`;
    orderDetails += `• Method: ${paymentMethod === 'momo' ? `Mobile Money (${formData.momoProvider})` : 'Visa / Mastercard'}\n`;
    if (paymentMethod === 'momo') {
      orderDetails += `• Payment Number: ${formData.momoNumber}\n`;
    }
    orderDetails += `\n*Items Ordered:*\n`;
    
    cartItems.forEach(item => {
      orderDetails += `• ${item.quantity}x ${item.name} (${item.category}'s Collection) - GHS ${item.price * item.quantity}.00\n`;
    });
    
    orderDetails += `--------------------------------------\n`;
    orderDetails += `*TOTAL AMOUNT:* GHS ${total}.00\n`;
    orderDetails += `*SHIPPING:* Complimentary\n`;
    orderDetails += `--------------------------------------\n`;
    orderDetails += `Please confirm my payment and expedite delivery! Thank you.`;

    const encodedText = encodeURIComponent(orderDetails);

    // Transition to Success step
    setStep('success');

    // Wait a brief second to allow user to see success pane, then trigger WhatsApp
    setTimeout(() => {
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`, '_blank');
      onClearCart();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/85 backdrop-blur-md transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-xl glass-panel-heavy border border-luxury-rosegold/20 rounded-none shadow-2xl overflow-hidden z-10 p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        {step !== 'success' && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 border border-luxury-rosegold/10 text-luxury-champagne/80 hover:text-white hover:border-luxury-rosegold/30 transition-all rounded-full"
          >
            <X size={15} />
          </button>
        )}

        {step === 'billing' ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Header Title */}
            <div className="text-center pb-4 border-b border-luxury-rosegold/10">
              <span className="text-[9px] tracking-[0.3em] uppercase text-luxury-rosegold font-bold block mb-1">Secure Checkout</span>
              <h2 className="font-serif text-lg tracking-widest text-white uppercase font-black">BILLING & DISPATCH</h2>
            </div>

            {/* Segment 1: Contact Details */}
            <div className="space-y-4">
              <h3 className="text-[10px] uppercase tracking-widest text-luxury-rosegold font-bold">1. Delivery Location</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Recipient Full Name</label>
                  <input
                    required
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Eugenia Arthur"
                    className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Delivery Phone Number</label>
                  <input
                    required
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+233 24 000 0000"
                    className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Street Address / Landmark</label>
                  <input
                    required
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Ring Road, East Legon"
                    className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">City / Region</label>
                  <input
                    required
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Accra"
                    className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                  />
                </div>
              </div>
            </div>

            {/* Segment 2: Payment Method Choice */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] uppercase tracking-widest text-luxury-rosegold font-bold">2. Payment Method</h3>
                <span className="flex items-center gap-1 text-[8px] text-luxury-champagne/40 font-mono uppercase">
                  <ShieldCheck size={9} /> Secured SSL Connection
                </span>
              </div>

              {/* Tabs selectors */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('momo')}
                  className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold flex items-center justify-center gap-2 border transition-all ${
                    paymentMethod === 'momo'
                      ? 'bg-luxury-wine/25 text-luxury-gold border-luxury-gold'
                      : 'bg-transparent text-luxury-champagne/50 border-luxury-rosegold/10'
                  }`}
                >
                  <Wallet size={12} />
                  Mobile Money
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold flex items-center justify-center gap-2 border transition-all ${
                    paymentMethod === 'card'
                      ? 'bg-luxury-wine/25 text-luxury-gold border-luxury-gold'
                      : 'bg-transparent text-luxury-champagne/50 border-luxury-rosegold/10'
                  }`}
                >
                  <CreditCard size={12} />
                  Credit / Debit Card
                </button>
              </div>

              {/* Dynamic form sheets based on active tab */}
              {paymentMethod === 'momo' ? (
                <div className="p-4 bg-luxury-black/60 border border-luxury-rosegold/5 space-y-4">
                  {/* Instructions */}
                  <div className="text-[10px] text-luxury-champagne/60 leading-relaxed space-y-1">
                    <p className="font-semibold text-luxury-gold uppercase tracking-wider">MoMo Payment Directions:</p>
                    <p>1. Please transfer absolute GHS total amount to: <strong className="text-white">+233 59 125 9991</strong></p>
                    <p>2. Registered merchant name: <strong className="text-white">Eugenia A.</strong></p>
                    <p>3. Fill in your payment phone details below to submit reference verification.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Network Provider</label>
                      <select
                        name="momoProvider"
                        value={formData.momoProvider}
                        onChange={handleInputChange}
                        className="px-4 py-2 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                      >
                        <option value="MTN">MTN Mobile Money</option>
                        <option value="Telecel">Telecel Cash</option>
                        <option value="AT">AT Cash</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Your MoMo Number</label>
                      <input
                        required={paymentMethod === 'momo'}
                        type="tel"
                        name="momoNumber"
                        value={formData.momoNumber}
                        onChange={handleInputChange}
                        placeholder="024 456 7890"
                        className="px-4 py-2 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-luxury-black/60 border border-luxury-rosegold/5 space-y-4">
                  <div className="text-[9px] text-luxury-champagne/40 uppercase tracking-widest flex items-center gap-1 pb-1 border-b border-white/5">
                    <CreditCard size={10} /> Secure Visa / Mastercard Gateway Placeholder
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Cardholder Name</label>
                    <input
                      required={paymentMethod === 'card'}
                      type="text"
                      name="cardName"
                      value={formData.cardName}
                      onChange={handleInputChange}
                      placeholder="Eugenia Arthur"
                      className="px-4 py-2 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Card Number</label>
                    <input
                      required={paymentMethod === 'card'}
                      type="text"
                      name="cardNumber"
                      value={formData.cardNumber}
                      onChange={handleInputChange}
                      placeholder="4000 1234 5678 9010"
                      className="px-4 py-2 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Expiry Date</label>
                      <input
                        required={paymentMethod === 'card'}
                        type="text"
                        name="cardExpiry"
                        value={formData.cardExpiry}
                        onChange={handleInputChange}
                        placeholder="MM/YY"
                        className="px-4 py-2 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">CVV</label>
                      <input
                        required={paymentMethod === 'card'}
                        type="password"
                        name="cardCvv"
                        value={formData.cardCvv}
                        onChange={handleInputChange}
                        placeholder="***"
                        maxLength="3"
                        className="px-4 py-2 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Checkout Summarizer Panel */}
            <div className="p-4 border border-dashed border-luxury-rosegold/20 bg-luxury-black/30 flex justify-between items-baseline">
              <span className="text-[10px] uppercase tracking-widest text-luxury-champagne/70 font-bold">Total Checkout Price</span>
              <span className="font-serif text-lg font-black text-luxury-gold">GHS {total}.00</span>
            </div>

            {/* Confirm Submission */}
            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white text-xs uppercase tracking-widest font-black flex items-center justify-center gap-2 hover:shadow-[0_0_25px_rgba(183,110,121,0.4)] btn-shimmer transition-all"
            >
              <Send size={12} />
              Confirm & Place Order on WhatsApp
            </button>

          </form>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-luxury-gold/10 border border-luxury-gold flex items-center justify-center text-luxury-gold animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            
            <div className="space-y-2">
              <h2 className="font-serif text-xl tracking-widest uppercase font-black text-white">ORDER TRANSMITTING</h2>
              <p className="text-xs text-luxury-champagne/60 leading-relaxed max-w-sm mx-auto font-light">
                Your luxury fragrance ticket has been initialized. We are currently copying your shopping details and launching WhatsApp to complete delivery processing.
              </p>
            </div>

            <div className="p-3.5 glass-panel-light border border-white/5 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
              <span className="text-[9px] uppercase tracking-widest font-bold text-luxury-gold">Connecting Securely...</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CheckoutModal;
