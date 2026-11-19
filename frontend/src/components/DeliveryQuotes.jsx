import React, { useState } from 'react';

export default function RiderFeeApproval({ order, onConfirm, busy }) {
  const [fee, setFee] = useState('');
  return (
    <form className="grid gap-2 text-sm" onSubmit={event => { event.preventDefault(); onConfirm(fee); }}>
      <label className="flex flex-col gap-1 text-luxury-champagne">
        Rider fee (GH₵)
        <input required type="number" min="0" max="9999999.99" step="0.01" value={fee}
          onChange={event => setFee(event.target.value)} disabled={busy}
          className="w-full px-3 py-2 bg-luxury-black border border-luxury-rosegold/20 text-white" />
      </label>
      {fee !== '' && Number(fee) >= 0 && <p>Total including rider fee GH₵{(order.subtotal + Number(fee)).toFixed(2)}</p>}
      <button type="submit" disabled={busy} className="px-3 py-2 border border-luxury-gold/45 text-luxury-gold disabled:opacity-50">
        {busy ? 'Confirming…' : 'Confirm delivery fee'}
      </button>
    </form>
  );
}
