import React from 'react';
import { X, Plus, Minus, Trash2, ShieldCheck } from 'lucide-react';
import StoreImage from './StoreImage';
import { cartKey, optionAvailable, optionPrice } from '../lib/catalogue';

const CartDrawer = ({ isOpen, onClose, cartItems, currentProducts, onUpdateQuantity, onRemoveItem, onCheckout, onResumeOrder }) => {
  if (!isOpen) return null;

  const byId = new Map((currentProducts || []).map(product => [String(product.id), product]));
  const lines = cartItems.map(item => {
    const product = byId.get(String(item.id));
    const option = item.variantId == null
      ? (product?.variants?.length ? null : product)
      : product?.variants?.find(variant => variant.id === item.variantId);
    const available = Boolean(product && option && optionAvailable(product, option));
    return { ...item, available, price: available ? optionPrice(option) : null };
  });
  const canCheckout = currentProducts && lines.every(item => item.available);
  const subtotal = lines.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Drawer Backdrop blur */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300"
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        {/* Sliding Panel */}
        <div className="w-screen max-w-md glass-panel border-l border-luxury-rosegold/15 flex flex-col justify-between h-full shadow-2xl transform transition-transform duration-500 ease-out">
          
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-luxury-rosegold/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-serif tracking-widest text-lg font-bold text-white uppercase">Your Atelier</span>
              <span className="text-[10px] bg-luxury-rosegold/20 text-luxury-rosegold font-bold uppercase tracking-wider px-2 py-0.5 border border-luxury-rosegold/10">
                {cartItems.reduce((acc, item) => acc + item.quantity, 0)} Items
              </span>
            </div>
            <button 
              onClick={onClose}
              aria-label="Close cart"
              className="p-2 border border-luxury-rosegold/10 text-luxury-champagne hover:text-white hover:border-luxury-rosegold/30 rounded-full transition-all"
            >
              <X size={15} />
            </button>
          </div>

          {/* Cart Contents list */}
          <div className="flex-grow overflow-y-auto p-5 sm:p-6 space-y-5 sm:space-y-6">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-luxury-charcoal flex items-center justify-center border border-luxury-rosegold/10 text-luxury-rosegold/50">
                  <ShoppingBagIcon />
                </div>
                <div>
                  <h3 className="font-serif text-sm uppercase tracking-widest text-white mb-2">Cart is empty</h3>
                  <p className="text-xs text-luxury-champagne/50 font-light leading-relaxed max-w-[200px] mx-auto">
                    Fill your closet with our premium collection of fragrances.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-transparent border border-luxury-rosegold/30 hover:border-luxury-rosegold text-luxury-rosegold uppercase tracking-widest text-[10px] font-bold transition-all"
                >
                  Continue Browsing
                </button>
                {onResumeOrder && (
                  <button type="button" onClick={onResumeOrder} className="text-sm text-luxury-champagne underline underline-offset-4">
                    View last order
                  </button>
                )}
              </div>
            ) : (
              lines.map((item) => {

                return (
                  <div
                    key={cartKey(item)}
                    className="flex gap-4 pb-6 border-b border-luxury-rosegold/5 items-start group"
                  >
                    {/* Thumbnail */}
                    <div className="w-20 h-20 bg-luxury-black border border-luxury-rosegold/10 overflow-hidden flex-shrink-0 relative">
                      <StoreImage image={item.image} widths={[160, 240]} sizes="80px" alt={item.name}
                        className="w-full h-full object-cover object-center" />
                    </div>

                    {/* Info details */}
                    <div className="flex-grow flex flex-col justify-between h-20 py-0.5">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-serif text-xs tracking-wider text-white font-bold pr-2 truncate max-w-[160px]">
                            {item.name}
                          </h4>
                          <button
                            onClick={() => onRemoveItem(cartKey(item))}
                            aria-label={`Remove ${item.name} from cart`}
                            className="text-luxury-champagne/40 hover:text-luxury-rosegold transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <span className="text-[9px] uppercase tracking-wider text-luxury-rosegold font-medium">
                          {item.variantLabel || (item.sizeMl ? `${item.sizeMl} ml` : '')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-auto">
                        {/* Quantity Toggles */}
                        <div className="flex items-center border border-luxury-rosegold/15 bg-luxury-black/50">
                          <button
                            onClick={() => onUpdateQuantity(cartKey(item), item.quantity - 1)}
                            aria-label={`Decrease quantity of ${item.name}`}
                            className="px-2 py-1 text-luxury-champagne/60 hover:text-white transition-colors"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="px-2 text-[10px] font-bold text-white font-mono">{item.quantity}</span>
                          <button
                            onClick={() => onUpdateQuantity(cartKey(item), item.quantity + 1)}
                            disabled={!item.available || item.quantity >= Math.min(item.stockQuantity ?? 99, 99)}
                            aria-label={`Increase quantity of ${item.name}`}
                            className="px-2 py-1 text-luxury-champagne/60 hover:text-white transition-colors"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                        {/* Price subtotal */}
                        <span className="font-serif text-xs font-bold text-luxury-gold">{item.price == null ? (currentProducts ? 'Unavailable' : 'Price unavailable') : `GH₵${(item.price * item.quantity).toFixed(2)}`}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Drawer Footer Actions */}
          {cartItems.length > 0 && (
            <div className="p-5 sm:p-6 border-t border-luxury-rosegold/15 bg-luxury-black/90 space-y-5 sm:space-y-6">
              {/* Summary totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-luxury-champagne/60 uppercase tracking-widest font-light">
                  <span>Cart subtotal</span>
                  <span className="font-serif text-lg font-black text-luxury-gold">{canCheckout ? `GH₵${subtotal.toFixed(2)}` : '—'}</span>
                </div>
                <p className="text-sm text-luxury-champagne/75">Choose pickup, campus delivery or an outside-campus quote at checkout.</p>
              </div>

              {!canCheckout && <p className="text-sm">{currentProducts ? 'Remove unavailable items before checkout.' : 'Current prices and availability are temporarily unavailable.'}</p>}
              {/* Checkout buttons */}
              <div className="space-y-3">
                <button
                  onClick={onCheckout}
                  disabled={!canCheckout}
                  className="w-full py-4 bg-white text-luxury-black text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 hover:bg-luxury-gold hover:shadow-lg transition-all duration-300 transform active:scale-95 disabled:opacity-50"
                >
                  <ShieldCheck size={13} />
                  Secure Checkout
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// Simple internal icon definition
const ShoppingBagIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={1.5} 
    stroke="currentColor" 
    className="w-6 h-6"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

export default React.memo(CartDrawer);
