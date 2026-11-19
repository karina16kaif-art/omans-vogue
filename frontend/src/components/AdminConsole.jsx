import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Banknote, CalendarDays, CheckCircle, Filter, LogOut, Package, ShoppingBag, Truck } from 'lucide-react';
import { api } from '../lib/api';
import AdminProducts from './AdminProducts';
import BrandSettings from './BrandSettings';
import RiderFeeApproval from './DeliveryQuotes';

const ORDER_STATUSES = [
  'Pending Merchant Review', 'Awaiting Delivery Fee', 'Awaiting Payment', 'Payment Verification',
  'Confirmed', 'Processing', 'Ready for Pickup', 'Out for Delivery', 'Delivered', 'Cancelled'
];
const PAYMENT_STATUSES = ['All', 'Pending', 'Paid', 'Failed', 'Cancelled'];
const EMPTY_ANALYTICS = {
  totalOrders: 0,
  ordersToday: 0,
  ordersThisMonth: 0,
  totalRevenue: 0,
  revenueToday: 0,
  revenueThisMonth: 0,
  pendingOrders: 0,
  pendingRequests: 0,
  pendingPayments: 0,
  paidOrders: 0,
  deliveredOrders: 0,
  cancelledOrders: 0,
  bestSellingPerfume: null,
  bestSellingProducts: [],
  productPerformance: [],
  lowStockCount: 0,
  monthlySales: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => ({ month, revenue: 0, orders: 0 })),
  ordersByStatus: ORDER_STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {}),
  collectionSales: { Men: 0, Women: 0 }
};

const currency = (value) => `GH₵  ${Number(value || 0).toFixed(2)}`;

const AdminConsole = (props) => {
  const { token, onLogout, brandSettings, onBrandSettingsUpdated, onBrandSettingsRefresh, onAdminTokenUpdated, adminSettingsState } = props;
  const [activeTab, setActiveTab] = useState('products');
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [savingOrders, setSavingOrders] = useState({});
  const ordersRequest = useRef(null);
  const [filters, setFilters] = useState({
    period: 'all',
    paymentStatus: 'All',
    orderStatus: 'All'
  });

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    ordersRequest.current?.abort();
    const request = new AbortController();
    ordersRequest.current = request;
    setOrdersLoading(true);
    setOrdersError('');
    const params = new URLSearchParams();
    if (filters.period !== 'all') params.set('period', filters.period);
    if (filters.paymentStatus !== 'All') params.set('paymentStatus', filters.paymentStatus);
    if (filters.orderStatus !== 'All') params.set('orderStatus', filters.orderStatus);
    params.set('includeAnalytics', 'true');
    params.set('includePurchases', 'true');

    const options = { headers: authHeaders, signal: request.signal };
    try {
      const { data } = await api.get('/api/orders', { ...options, params });
      if (request.signal.aborted) return;
      setOrders(data.orders);
      setAnalytics({ ...EMPTY_ANALYTICS, ...data.analytics });
    } catch {
      if (!request.signal.aborted) {
        setOrders([]);
        setAnalytics(EMPTY_ANALYTICS);
        setOrdersError('Orders could not be loaded. Use Refresh to try again.');
      }
    } finally {
      if (!request.signal.aborted) setOrdersLoading(false);
    }
  }, [authHeaders, filters, token]);

  useEffect(() => {
    if (activeTab !== 'orders') return;
    fetchOrders();
    return () => ordersRequest.current?.abort();
  }, [activeTab, fetchOrders]);

  const updateOrder = async (orderId, route, payload) => {
    setSavingOrders(previous => ({ ...previous, [orderId]: true }));
    setOrdersError('');
    try {
      const collection = orders.find(order => order.id === orderId)?.isPurchaseRequest ? '/api/admin/delivery-quotes' : '/api/orders';
      await api.patch(`${collection}/${encodeURIComponent(orderId)}/${route}`, payload, { headers: authHeaders });
      await fetchOrders();
    } catch (error) {
      setOrdersError(error.response?.data?.error || 'The order update failed. Try again.');
    } finally {
      setSavingOrders(previous => ({ ...previous, [orderId]: false }));
    }
  };

  const verifyPayment = (order) => {
    if (window.confirm(`Have you confirmed receipt of ${currency(order.totalAmount)} for order ${order.orderNumber || order.id}?`)) {
      updateOrder(order.id, 'payment', { paymentStatus: 'Paid' });
    }
  };

  const maxMonthlyRevenue = useMemo(() => {
    const monthly = analytics?.monthlySales || [];
    return Math.max(...monthly.map(item => Number(item.revenue || 0)), 1);
  }, [analytics]);

  const statusEntries = useMemo(
    () => Object.entries(analytics?.ordersByStatus || {}),
    [analytics]
  );

  const collectionTotal = Number(analytics?.collectionSales?.Men || 0) + Number(analytics?.collectionSales?.Women || 0) || 1;

  const summaryCards = [
    ['Total Orders', analytics?.totalOrders || 0, ShoppingBag],
    ['Orders Today', analytics?.ordersToday || 0, CalendarDays],
    ['Orders This Month', analytics?.ordersThisMonth || 0, CalendarDays],
    ['Total Revenue', currency(analytics?.totalRevenue), Banknote],
    ['Revenue Today', currency(analytics?.revenueToday), Banknote],
    ['Revenue This Month', currency(analytics?.revenueThisMonth), Banknote],
    ['Pending Orders', analytics?.pendingOrders || 0, Filter],
    ['Pending Purchase Requests', analytics?.pendingRequests || 0, ShoppingBag],
    ['Pending Payments', analytics?.pendingPayments || 0, Banknote],
    ['Confirmed Paid Orders', analytics?.paidOrders || 0, CheckCircle],
    ['Delivered Orders', analytics?.deliveredOrders || 0, Truck],
    ['Cancelled Orders', analytics?.cancelledOrders || 0, Package],
    ['Best-Selling Perfume', analytics?.bestSellingPerfume?.name || 'No sales yet', BarChart3],
    ['Out of Stock Count', analytics?.lowStockCount ?? 0, Package]
  ];

  return (
    <section className="relative z-10">
      <div className="max-w-7xl mx-auto px-6 md:px-12 pt-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 border-b border-luxury-rosegold/10 pb-6">
          <div className="flex flex-wrap items-center gap-3">
            {['products', 'orders', 'brand'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-[10px] uppercase tracking-widest font-bold border transition-all ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white border-luxury-rosegold/50 shadow-md shadow-luxury-wine/25'
                    : 'bg-transparent text-luxury-champagne/70 border-luxury-rosegold/10 hover:border-luxury-rosegold/30 hover:text-white'
                }`}
              >
                {tab === 'products' ? 'Product Management' : tab === 'orders' ? 'Orders' : 'Brand Settings'}
              </button>
            ))}
          </div>

          {activeTab !== 'products' && (
            <button
              onClick={onLogout}
              className="px-4 py-3 bg-transparent border border-luxury-rosegold/20 text-luxury-champagne hover:text-white hover:border-luxury-rosegold/50 text-xs uppercase tracking-widest font-bold flex items-center gap-2 transition-all rounded-none w-fit"
            >
              <LogOut size={13} className="text-luxury-rosegold" />
              Logout
            </button>
          )}
        </div>
      </div>

      {activeTab === 'products' ? (
        <AdminProducts {...props} />
      ) : activeTab === 'brand' ? (
        adminSettingsState === 'ready' ? <BrandSettings
          token={token}
          brandSettings={brandSettings}
          onBrandSettingsUpdated={onBrandSettingsUpdated}
          onBrandSettingsRefresh={onBrandSettingsRefresh}
          onAdminTokenUpdated={onAdminTokenUpdated}
        /> : <p className="max-w-7xl mx-auto px-6 py-12 text-sm" role="status">
          {adminSettingsState === 'error' ? <>
            Store settings could not be loaded. <button type="button" className="underline" onClick={() => onBrandSettingsRefresh()}>Retry</button>
          </> : 'Loading store settings…'}
        </p>
      ) : (
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 space-y-10">
          <div>
            <span className="text-[10px] tracking-[0.35em] uppercase font-bold text-luxury-gold block mb-2">
              BUSINESS PERFORMANCE
            </span>
            <h2 className="font-serif text-2xl sm:text-4xl tracking-widest uppercase text-white font-extrabold">
              ORDERS & ANALYTICS
            </h2>
          </div>

          {ordersError && (
            <div className="p-4 glass-panel border border-luxury-rosegold/30 bg-luxury-wine/10 text-luxury-rosegold text-xs">
              {ordersError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {summaryCards.map(([label, value, Icon]) => (
              <div key={label} className="p-5 glass-panel border-l-2 border-l-luxury-rosegold flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold block mb-1">
                    {label}
                  </span>
                  <span className="text-lg font-serif font-black text-white leading-tight block">
                    {value}
                  </span>
                </div>
                <Icon size={22} className="text-luxury-gold opacity-40" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-6 glass-panel">
              <h3 className="text-[10px] uppercase tracking-widest text-luxury-rosegold font-bold mb-5">Revenue & Monthly Sales</h3>
              <div className="h-52 flex items-end gap-2">
                {(analytics?.monthlySales || []).map((month) => (
                  <div key={month.month} className="flex-1 h-full flex flex-col justify-end gap-2">
                    <div
                      className="bg-gradient-to-t from-luxury-wine to-luxury-rosegold border border-luxury-gold/20 min-h-[4px]"
                      style={{ height: `${Math.max(4, (Number(month.revenue || 0) / maxMonthlyRevenue) * 100)}%` }}
                      title={`${month.month}: ${currency(month.revenue)}`}
                    />
                    <span className="text-[8px] text-luxury-champagne/50 text-center uppercase">{month.month}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 glass-panel space-y-6">
              <div>
                <h3 className="text-[10px] uppercase tracking-widest text-luxury-rosegold font-bold mb-4">Orders and Requests by Status</h3>
                <div className="space-y-3">
                  {statusEntries.map(([status, count]) => (
                    <div key={status}>
                      <div className="flex justify-between text-[9px] uppercase tracking-widest text-luxury-champagne/60 mb-1">
                        <span>{status}</span>
                        <span>{count}</span>
                      </div>
                      <div className="h-2 bg-luxury-black border border-white/5">
                        <div className="h-full bg-luxury-rosegold" style={{ width: `${Math.min(100, Number(count || 0) * 18)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] uppercase tracking-widest text-luxury-rosegold font-bold mb-4">Collection Sales</h3>
                {['Women', 'Men'].map((collection) => {
                  const sales = Number(analytics?.collectionSales?.[collection] || 0);
                  return (
                    <div key={collection} className="mb-3">
                      <div className="flex justify-between text-[9px] uppercase tracking-widest text-luxury-champagne/60 mb-1">
                        <span>{collection}'s Collection</span>
                        <span>{currency(sales)}</span>
                      </div>
                      <div className="h-2 bg-luxury-black border border-white/5">
                        <div className="h-full bg-luxury-gold" style={{ width: `${(sales / collectionTotal) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 glass-panel">
              <h3 className="text-[10px] uppercase tracking-widest text-luxury-rosegold font-bold mb-5">Orders</h3>
              <div className="h-44 flex items-end gap-2">
                {(analytics?.monthlySales || []).map((month) => {
                  const maxOrders = Math.max(...(analytics?.monthlySales || []).map(item => Number(item.orders || 0)), 1);
                  return (
                    <div key={`orders-${month.month}`} className="flex-1 h-full flex flex-col justify-end gap-2">
                      <div
                        className="bg-luxury-gold/80 border border-luxury-gold/20 min-h-[4px]"
                        style={{ height: `${Math.max(4, (Number(month.orders || 0) / maxOrders) * 100)}%` }}
                        title={`${month.month}: ${month.orders} orders`}
                      />
                      <span className="text-[8px] text-luxury-champagne/50 text-center uppercase">{month.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 glass-panel">
              <h3 className="text-[10px] uppercase tracking-widest text-luxury-rosegold font-bold mb-5">Best-Selling Products</h3>
              <div className="space-y-3">
                {(analytics?.bestSellingProducts || []).length > 0 ? (
                  analytics.bestSellingProducts.map((item) => (
                    <div key={item.key || item.name}>
                      <div className="flex justify-between text-[9px] uppercase tracking-widest text-luxury-champagne/60 mb-1">
                        <span>{item.name}</span>
                        <span>{item.quantity}</span>
                      </div>
                      <div className="h-2 bg-luxury-black border border-white/5">
                        <div
                          className="h-full bg-luxury-rosegold"
                          style={{ width: `${Math.min(100, (Number(item.quantity || 0) / Math.max(Number(analytics.bestSellingProducts[0]?.quantity || 1), 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-xs uppercase tracking-widest text-luxury-champagne/50">
                    No product sales yet.
                  </div>
                )}
              </div>
              {!!analytics?.productPerformance?.length && (
                <details className="mt-5 border-t border-luxury-rosegold/15 pt-4">
                  <summary className="cursor-pointer text-sm text-luxury-champagne">Product performance</summary>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[240px] text-left text-sm mt-3">
                      <thead>
                        <tr><th className="pr-2 pb-2">Product</th><th className="px-2 pb-2 text-right">Units</th><th className="pl-2 pb-2 text-right">Sales</th></tr>
                      </thead>
                      <tbody>
                        {analytics.productPerformance.map(item => (
                          <tr key={item.key} className="border-t border-luxury-rosegold/10">
                            <td className="pr-2 py-2">{item.name}</td>
                            <td className="px-2 py-2 text-right">{item.quantity}</td>
                            <td className="pl-2 py-2 text-right whitespace-nowrap">{currency(item.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          </div>

          <div className="glass-panel p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                value={filters.period}
                onChange={(e) => setFilters(prev => ({ ...prev, period: e.target.value }))}
                className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
              >
                <option value="all">All Orders</option>
                <option value="today">Today</option>
                <option value="month">This Month</option>
              </select>
              <select
                value={filters.paymentStatus}
                onChange={(e) => setFilters(prev => ({ ...prev, paymentStatus: e.target.value }))}
                className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
              >
                {PAYMENT_STATUSES.map(status => <option key={status} value={status}>{status} Payment</option>)}
              </select>
              <select
                value={filters.orderStatus}
                onChange={(e) => setFilters(prev => ({ ...prev, orderStatus: e.target.value }))}
                className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
              >
                <option value="All">All Statuses</option>
                {ORDER_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
              <button
                onClick={fetchOrders}
                className="px-4 py-2.5 bg-transparent border border-luxury-rosegold/20 text-luxury-champagne hover:text-white hover:border-luxury-rosegold/50 text-xs uppercase tracking-widest font-bold transition-all"
              >
                Refresh
              </button>
            </div>

            {ordersLoading ? (
              <div className="py-16 text-center text-[10px] uppercase tracking-[0.4em] text-luxury-rosegold">
                Loading Orders
              </div>
            ) : (
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <div className="py-16 text-center text-xs uppercase tracking-widest text-luxury-champagne/50">
                    No orders found for this filter.
                  </div>
                ) : orders.map((order) => {
                  const paymentVerified = order.paymentStatus === 'Paid' && order.paymentVerifiedAt;
                  const status = order.orderStatus;
                  const allowed = order.allowedStatuses || [status];
                  const feesPending = order.deliveryFee == null && order.isPurchaseRequest;
                  return (
                    <div key={order.id} className="border border-luxury-rosegold/10 bg-luxury-black/40 p-5">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-serif text-white text-base tracking-widest font-black">{order.orderNumber || order.id}</span>
                            {order.isPurchaseRequest && <span className="text-xs text-luxury-gold">Purchase request</span>}
                            <span className="px-2 py-1 border border-luxury-rosegold/20 text-[9px] uppercase tracking-widest text-luxury-rosegold">
                              {paymentVerified ? 'Payment verified' : order.paymentStatus === 'Paid' ? 'Payment needs review' : `Payment ${(order.paymentStatus || 'Pending').toLowerCase()}`}
                            </span>
                            <span className="px-2 py-1 border border-white/10 text-[9px] uppercase tracking-widest text-luxury-champagne/60">
                              {status}
                            </span>
                          </div>
                          <p className="text-sm text-luxury-champagne">{order.customerName} · {order.customerPhone}</p>
                          {order.customerEmail && <p className="text-xs text-luxury-champagne break-all">{order.customerEmail}</p>}
                          {order.deliveryPhone && order.deliveryPhone !== order.customerPhone && (
                            <p className="text-sm text-luxury-champagne">Delivery phone {order.deliveryPhone}</p>
                          )}
                          <p className="text-sm text-luxury-champagne/75 break-words">
                            {order.fulfilmentMethod === 'pickup'
                              ? `Pickup at ${order.pickupLocation}`
                              : [order.area, order.address || order.deliveryAddress, order.landmark && `Landmark: ${order.landmark}`].filter(Boolean).join(' · ')}
                          </p>
                          <p className="text-sm text-luxury-champagne/75">Product subtotal {currency(order.subtotal)}</p>
                          <p className="text-sm text-luxury-champagne/75">Delivery fee {feesPending ? 'Awaiting Merchant Approval' : currency(order.deliveryFee)}</p>
                          {order.momoPhone && <p className="text-sm text-luxury-champagne">MoMo phone {order.momoPhone}</p>}
                          {order.paymentReference && <p className="text-sm text-luxury-champagne break-all">Reference {order.paymentReference}</p>}
                          <p className="text-xs text-luxury-champagne/60">
                            {new Date(order.requestedAt || order.createdAt).toLocaleString('en-GH', { timeZone: 'Africa/Accra' })} · {order.paymentMethod}
                          </p>
                        </div>

                        <div className="flex flex-col gap-3 shrink-0">
                          {order.totalAmount != null && <span className="font-serif text-luxury-gold font-black text-lg">Total {currency(order.totalAmount)}</span>}
                          <label className="flex flex-col gap-1 text-sm text-luxury-champagne">
                            Order status
                            <select
                              value={status}
                              onChange={(event) => updateOrder(order.id, 'status', { orderStatus: event.target.value })}
                              disabled={savingOrders[order.id] || allowed.length === 1}
                              className="px-3 py-2 bg-luxury-black border border-luxury-rosegold/25 text-white text-sm focus:border-luxury-rosegold focus:outline-none rounded-none"
                            >
                              {ORDER_STATUSES.map(option => <option key={option} value={option} disabled={!allowed.includes(option)}>{option}</option>)}
                            </select>
                          </label>
                          {order.canVerifyPayment && (
                            <button
                              type="button"
                              onClick={() => verifyPayment(order)}
                              disabled={savingOrders[order.id]}
                              className="px-3 py-2 border border-luxury-gold/45 hover:border-luxury-gold text-luxury-gold text-sm font-semibold disabled:opacity-50"
                            >
                              Verify payment
                            </button>
                          )}
                          {feesPending && status !== 'Cancelled' && (
                            <RiderFeeApproval order={order} busy={savingOrders[order.id]}
                              onConfirm={deliveryFee => updateOrder(order.id, 'approval', { deliveryFee })} />
                          )}
                          {order.customerWhatsappUrl && (
                            <a href={order.customerWhatsappUrl} target="_blank" rel="noopener noreferrer"
                              className="px-3 py-2 border border-luxury-gold/45 text-center text-sm text-luxury-gold">
                              {order.checkoutUrl ? 'Open WhatsApp to share checkout link' : 'Contact customer via WhatsApp'}
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {order.items.map((item, index) => (
                          <div key={`${order.id}-${item.name}-${index}`} className="flex justify-between gap-3 border border-white/5 p-3">
                            <div>
                              <span className="text-xs text-white font-serif tracking-wider">{item.name}</span>
                              <span className="block text-[9px] uppercase tracking-widest text-luxury-rosegold">{item.variantLabel || (item.sizeMl ? `${item.sizeMl} ml` : item.category)}</span>
                            </div>
                            <div className="text-right">
                              <span className="block text-xs text-luxury-champagne">x{item.quantity}</span>
                              <span className="block text-[10px] text-luxury-gold">{currency(item.unitPrice ?? item.price)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <details className="mt-4 text-sm text-luxury-champagne/80">
                        <summary className="cursor-pointer text-luxury-gold">Order history</summary>
                        {order.history?.length ? <ul className="mt-2 space-y-1">
                          {order.history.map((event, index) => <li key={index}>
                            {new Date(event.at).toLocaleString('en-GH', { timeZone: 'Africa/Accra' })} · {event.actor === 'merchant' ? 'Merchant' : 'Customer'} ·
                            {event.kind === 'delivery fee' ? ` Rider fee approved at ${currency(event.to)}`
                              : ` ${event.from ? `${event.from} → ` : ''}${event.to}`}
                          </li>)}
                        </ul> : <p className="mt-2">No recorded status changes.</p>}
                      </details>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default React.memo(AdminConsole);
