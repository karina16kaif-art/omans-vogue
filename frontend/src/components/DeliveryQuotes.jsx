import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

const currency = (amount) => `GH₵${Number(amount).toFixed(2)}`;
const buttonClass = 'px-3 py-2 border border-luxury-rosegold/40 text-sm text-luxury-gold disabled:opacity-50';

const QuoteCard = ({ quote, headers, onApproved }) => {
  const [deliveryFee, setDeliveryFee] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirmFee = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.patch(`/api/admin/delivery-quotes/${encodeURIComponent(quote.id)}/approval`,
        { deliveryFee }, { headers });
      onApproved(data);
    } catch (problem) {
      setError(problem.response?.data?.error || 'The delivery fee could not be confirmed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="space-y-2 border border-luxury-rosegold/20 p-4 text-sm text-luxury-champagne break-words">
      <p className="font-semibold text-white">{quote.customerName} · {quote.customerPhone}</p>
      <p>{quote.area} · {quote.address} · Landmark: {quote.landmark}</p>
      <ul className="space-y-1">
        {quote.items.map(item => <li key={`${item.productId}:${item.variantId || ''}`}>
          {item.quantity} × {item.name}{item.variantLabel ? ` · ${item.variantLabel}` : ''} · {currency(item.unitPrice * item.quantity)}
        </li>)}
      </ul>
      <p>Product subtotal {currency(quote.subtotal)}</p>
      {quote.approved ? (
        <>
          <p>Delivery fee {currency(quote.deliveryFee)} · Total {currency(quote.total)}</p>
          {quote.whatsappUrl ? (
            <a className={`inline-flex ${buttonClass}`} href={quote.whatsappUrl} target="_blank" rel="noopener noreferrer">
              Open WhatsApp to send checkout link
            </a>
          ) : <p>The checkout link has expired.</p>}
        </>
      ) : (
        <form onSubmit={confirmFee} className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1">
            Rider fee (GH₵)
            <input required type="number" min="0" max="9999999.99" step="0.01" value={deliveryFee}
              onChange={event => setDeliveryFee(event.target.value)}
              className="w-32 px-3 py-2 bg-luxury-black border border-luxury-rosegold/20 text-white" />
          </label>
          <button type="submit" className={buttonClass} disabled={busy}>{busy ? 'Confirming…' : 'Confirm delivery fee'}</button>
          {deliveryFee !== '' && Number(deliveryFee) >= 0 && <p className="w-full">Total including rider fee {currency(quote.subtotal + Number(deliveryFee))}</p>}
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </article>
  );
};

export default function DeliveryQuotes({ headers }) {
  const [reviewed, setReviewed] = useState(false);
  const [results, setResults] = useState({ quotes: [], hasMore: false });
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [latestApproved, setLatestApproved] = useState(null);
  const [status, setStatus] = useState('loading');
  const load = useCallback(async (signal) => {
    setStatus('loading');
    try {
      const { data } = await api.get('/api/admin/delivery-quotes', { headers, signal, params: { reviewed, page } });
      if (signal?.aborted) return;
      setResults(data);
      setStatus('ready');
    } catch {
      if (!signal?.aborted) setStatus('error');
    }
  }, [headers, page, reviewed]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, revision]);

  const onApproved = (quote) => {
    setResults(previous => ({ ...previous, quotes: previous.quotes.filter(item => item.id !== quote.id) }));
    setLatestApproved(quote);
    setRevision(previous => previous + 1);
  };

  return (
    <section className="glass-panel p-5 space-y-4" aria-label="Outside-campus delivery quotes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm uppercase tracking-widest text-luxury-gold">Outside-campus delivery quotes</h3>
        <button type="button" className={buttonClass} onClick={() => setRevision(previous => previous + 1)}>Refresh quotes</button>
      </div>
      <label className="text-sm text-luxury-champagne">
        <input type="checkbox" checked={reviewed} onChange={event => { setReviewed(event.target.checked); setPage(0); }}
          className="mr-2 accent-luxury-gold" />
        Show confirmed quotes
      </label>
      {latestApproved && !reviewed && <QuoteCard key={latestApproved.id} quote={latestApproved} headers={headers} onApproved={onApproved} />}
      {status === 'loading' && <p role="status" className="text-sm">Loading delivery quotes…</p>}
      {status === 'error' && <p role="alert" className="text-sm">Delivery quotes could not be loaded. Use Refresh quotes to try again.</p>}
      {status === 'ready' && results.quotes.length === 0 && <p className="text-sm">No {reviewed ? 'confirmed' : 'pending'} delivery quotes on this page.</p>}
      {status === 'ready' && results.quotes.map(quote => <QuoteCard key={quote.id} quote={quote} headers={headers} onApproved={onApproved} />)}
      {(page > 0 || results.hasMore) && <nav className="flex gap-2" aria-label="Delivery quote pages">
        <button type="button" className={buttonClass} disabled={page === 0 || status === 'loading'} onClick={() => setPage(page - 1)}>Previous</button>
        <button type="button" className={buttonClass} disabled={!results.hasMore || status === 'loading'} onClick={() => setPage(page + 1)}>Next</button>
      </nav>}
    </section>
  );
}
