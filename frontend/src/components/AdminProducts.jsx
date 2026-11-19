import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Edit2, LogOut, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { api } from '../lib/api';
import StoreImage from './StoreImage';
import { assignedCollections, collectionDefinitions, currency, displayOption, optionPrice } from '../lib/catalogue';

const initialProduct = {
  name: '',
  category: 'Other',
  price: '',
  description: '',
  notes: '',
  brand: '', collections: [], images: [], variants: [], salePrice: '', sizeMl: '', stockQuantity: '',
  enabled: true, published: false, bestsellerFeatured: false, featured: false, newArrival: true
};

const pageSize = 24;

const AdminProducts = ({ token, onLogout, brandSettings, adminSettingsState, onBrandSettingsRefresh }) => {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [pageState, setPageState] = useState('loading');
  const [refresh, setRefresh] = useState(0);
  const collections = collectionDefinitions(brandSettings.storefront || {}).map(({ id, name }) => [id, name]);
  const reload = () => setRefresh(current => current + 1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formProduct, setFormProduct] = useState(initialProduct);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    const request = new AbortController();
    const timeout = setTimeout(async () => {
      setPageState('loading');
      try {
        const { data } = await api.get('/api/admin/products', {
          headers: authHeaders, signal: request.signal,
          params: { limit: pageSize, offset: page * pageSize, search: query.trim() }
        });
        if (request.signal.aborted) return;
        if (!Array.isArray(data?.products)) throw new Error('Invalid product page.');
        if (page > 0 && !data.products.length) {
          setPage(previous => previous - 1);
          return;
        }
        setProducts(data.products);
        setHasMore(data.hasMore);
        setPageState('ready');
      } catch {
        if (!request.signal.aborted) setPageState('error');
      }
    }, query ? 240 : 0);
    return () => { clearTimeout(timeout); request.abort(); };
  }, [authHeaders, page, query, refresh]);

  const showFeedback = (message) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const showError = (message) => {
    setErrorMsg(message);
    setTimeout(() => setErrorMsg(''), 5000);
  };

  const startCreate = () => {
    setEditingId(null);
    setFormProduct(initialProduct);
    setShowForm(true);
  };

  const startEdit = (product) => {
    setEditingId(product.id);
    setFormProduct({
      ...product,
      enabled: product.enabled ?? product.inStock !== false,
      collections: assignedCollections(product).filter(id => collections.some(([key]) => id === key)),
      images: product.images?.length ? product.images : [product.image].filter(Boolean),
      variants: product.variants || []
    });
    setShowForm(true);
  };

  const handleAvailabilityToggle = async (product, key) => {
    try {
      const { data } = await api.patch(`/api/products/${product.id}`, {
        [key]: product[key] === false, catalogVersion: product.catalogVersion
      }, { headers: authHeaders });
      setProducts(current => current.map(item => item.id === data.id ? data : item));
      showFeedback(key === 'published' ? (data.published ? 'Product published.' : 'Product unpublished.') : 'Availability updated.');
    } catch (error) {
      showError(error.response?.data?.error || 'Could not update the product.');
      if (error.response?.status === 409) reload();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this product from the storefront? Past orders will keep its details.')) return;
    try {
      await api.delete(`/api/products/${id}`, { headers: authHeaders });
      reload();
      showFeedback('Product removed from the catalogue.');
    } catch (error) {
      showError(error.response?.data?.error || 'Could not remove this product.');
    }
  };

  const setField = (key, value) => setFormProduct(previous => ({ ...previous, [key]: value }));
  const toggleCollection = (key) => setFormProduct(previous => ({
    ...previous,
    collections: previous.collections.includes(key)
      ? previous.collections.filter(value => value !== key)
      : [...previous.collections, key]
  }));
  const updateVariant = (id, key, value) => setFormProduct(previous => ({
    ...previous, variants: previous.variants.map(option => option.id === id ? { ...option, [key]: value } : option)
  }));

  const handleFileChange = async (event) => {
    const files = [...event.target.files];
    event.target.value = '';
    if (!files.length) return;
    if (files.length + formProduct.images.length > 12) return showError('A product can have up to 12 images.');
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);
        const { data } = await api.post('/api/upload', formData, { headers: authHeaders });
        setFormProduct(previous => ({ ...previous, images: [...new Set([...previous.images, data.imageUrl])] }));
      }
      showFeedback('Images uploaded. Save the product to publish the gallery.');
    } catch (error) {
      showError(error.response?.data?.error || 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      if (editingId) {
        await api.patch(`/api/products/${editingId}`, formProduct, { headers: authHeaders });
      } else {
        const { data } = await api.post('/api/products', formProduct, { headers: authHeaders });
        setPage(0);
        setQuery(data.name.slice(0, 80));
      }
      showFeedback('Product saved.');
      setShowForm(false);
      reload();
    } catch (error) {
      showError(error.response?.data?.error || 'Could not save this product.');
      if (error.response?.status === 409) reload();
    } finally {
      setSaving(false);
    }
  };

  const closeForm = () => {
    if (!saving && !uploading) setShowForm(false);
  };

  const primaryImage = formProduct.images[0] || (formProduct.category === 'Men'
    ? '/images/products/men_placeholder.png' : '/images/products/women_placeholder.png');

  return (
    <section id="admin" className="relative max-w-7xl mx-auto px-6 md:px-12 py-12 z-10 border-t border-luxury-rosegold/5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 border-b border-luxury-rosegold/10 pb-8">
        <div>
          <span className="text-[10px] tracking-[0.35em] uppercase font-bold text-luxury-gold block mb-2">
            ATELIER DIRECTION CONSOLE
          </span>
          <h2 className="font-serif text-2xl sm:text-4xl tracking-widest uppercase text-white font-extrabold">
            PRODUCT MANAGEMENT
          </h2>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <button onClick={startCreate} disabled={adminSettingsState !== 'ready'} className="px-5 py-3 bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white text-xs uppercase tracking-widest font-bold flex items-center gap-2 hover:shadow-[0_0_15px_rgba(183,110,121,0.3)] transition-all transform hover:scale-[1.02] rounded-none btn-shimmer">
            <Plus size={14} />
            Add product
          </button>
          <button onClick={onLogout} className="px-4 py-3 bg-transparent border border-luxury-rosegold/20 text-luxury-champagne hover:text-white hover:border-luxury-rosegold/50 text-xs uppercase tracking-widest font-bold flex items-center gap-2 transition-all rounded-none">
            <LogOut size={13} className="text-luxury-rosegold" />
            Logout
          </button>
        </div>
      </div>

      {successMsg && <div className="mb-6 p-4 glass-panel border border-green-500/20 bg-green-500/5 text-green-400 text-xs flex items-center gap-2"><CheckCircle size={14} />{successMsg}</div>}
      {errorMsg && <div className="mb-6 p-4 glass-panel border border-luxury-rosegold/30 bg-luxury-wine/10 text-luxury-rosegold text-xs">{errorMsg}</div>}

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="block flex-1 min-w-40 text-sm">
          Search products
          <input type="search" value={query} maxLength={80} onChange={event => {
            setQuery(event.target.value);
            setPage(0);
          }} className="mt-1 block w-full border border-luxury-rosegold/25 bg-luxury-black px-3 py-2 text-sm" />
        </label>
        <button type="button" onClick={reload} className="border border-luxury-rosegold/25 px-3 py-2 text-sm">Refresh products</button>
      </div>
      {adminSettingsState === 'error' && <p role="alert" className="mb-4 text-sm">
        Store settings could not be loaded. <button type="button" className="underline" onClick={() => onBrandSettingsRefresh()}>Retry store settings</button>
      </p>}
      {pageState === 'loading' && <p role="status" className="mb-4 text-sm">Loading products…</p>}
      {pageState === 'error' && <p role="alert" className="mb-4 text-sm">Products could not be loaded. Use Refresh products to retry.</p>}
      {pageState === 'ready' && !products.length && <p className="mb-4 text-sm">No matching products.</p>}
      <div className="glass-panel overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-luxury-rosegold/10 text-luxury-champagne/60 uppercase tracking-widest text-[9px] font-bold">
              <th className="p-5">Preview</th>
              <th className="p-5">Fragrance Name</th>
              <th className="p-5">Collection</th>
              <th className="p-5">GHS Price</th>
              <th className="p-5 text-center">Stock status</th>
              <th className="p-5 text-right">Inventory Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-luxury-rosegold/5">
            {products.map((product) => {
              return (
                <tr key={product.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-5">
                    <div className="w-12 h-12 bg-luxury-black border border-luxury-rosegold/10 overflow-hidden">
                      <StoreImage image={product.image} widths={[96, 144]} sizes="48px" alt="" className="w-full h-full object-cover" />
                    </div>
                  </td>
                  <td className="p-5 font-serif text-sm font-bold text-white tracking-wide">
                    {product.name}
                    <span className="text-[9px] text-luxury-champagne/40 block mt-1 line-clamp-1 max-w-[250px] font-sans font-light">{product.notes}</span>
                  </td>
                  <td className="p-5 text-luxury-champagne">
                    <span className="px-2 py-0.5 border border-luxury-rosegold/20 bg-luxury-rosegold/10 text-[9px] uppercase tracking-wider font-bold">{(assignedCollections(product).map(key => collections.find(([id]) => id === key)?.[1]).filter(Boolean).join(', ') || product.category)}</span>
                  </td>
                  <td className="p-5 font-serif font-black text-white text-sm">{currency(optionPrice(displayOption(product)))}</td>
                  <td className="p-5 text-center">
                    <div className="text-xs">{product.inStock ? 'In stock' : 'Out of stock'}</div>
                    <button type="button" onClick={() => handleAvailabilityToggle(product, 'enabled')}
                      aria-label={`${product.enabled !== false ? 'Pause' : 'Enable'} purchasing for ${product.name}`}
                      className="mt-2 text-xs underline">{product.enabled !== false ? 'Pause purchasing' : 'Enable purchasing'}</button>
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button type="button" onClick={() => handleAvailabilityToggle(product, 'published')}
                        aria-label={`${product.published !== false ? 'Unpublish' : 'Publish'} ${product.name}`}
                        className="text-xs underline">{product.published !== false ? 'Unpublish' : 'Publish'}</button>
                      <button aria-label={`Edit ${product.name}`} onClick={() => startEdit(product)} disabled={adminSettingsState !== 'ready'} className="p-2 border border-luxury-rosegold/10 text-luxury-champagne/60 hover:text-luxury-gold hover:border-luxury-gold/30 rounded-full transition-all"><Edit2 size={13} /></button>
                      <button aria-label={`Remove ${product.name}`} onClick={() => handleDelete(product.id)} className="p-2 border border-luxury-rosegold/10 text-luxury-champagne/60 hover:text-luxury-rosegold hover:border-luxury-rosegold/30 rounded-full transition-all"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav aria-label="Product pages" className="mt-5 flex items-center justify-between gap-3 text-sm">
        <button type="button" onClick={() => setPage(page - 1)} disabled={page === 0 || pageState !== 'ready'} className="border px-3 py-2 disabled:opacity-40">Previous</button>
        <span aria-live="polite">Page {page + 1}</span>
        <button type="button" onClick={() => setPage(page + 1)} disabled={!hasMore || pageState !== 'ready'} className="border px-3 py-2 disabled:opacity-40">Next</button>
      </nav>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={closeForm} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
          <div role="dialog" aria-modal="true" aria-labelledby="edit-product-title" className="relative w-full max-w-4xl glass-panel-heavy border border-luxury-rosegold/20 p-6 sm:p-8 z-10 max-h-[92vh] overflow-y-auto">
            <button aria-label="Close product editor" onClick={closeForm} className="absolute top-4 right-4 p-2 border border-luxury-rosegold/10 text-luxury-champagne hover:text-white rounded-full transition-all"><X size={15} /></button>
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="text-center pb-4 border-b border-luxury-rosegold/10">
                <span className="text-[9px] uppercase tracking-widest text-luxury-gold font-bold">{editingId ? 'Secure Modification Vault' : 'New Product Formulation'}</span>
                <h3 id="edit-product-title" className="font-serif text-lg tracking-widest text-white uppercase font-black">{editingId ? 'EDIT FRAGRANCE SPECIFICATIONS' : 'ADD NEW LUXURY FRAGRANCE'}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-8 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Fragrance Name" value={formProduct.name} onChange={(value) => setFormProduct(prev => ({ ...prev, name: value }))} required />
                    <label className="flex flex-col gap-1 text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">
                      Catalogue category
                      <select value={formProduct.category} onChange={(event) => setFormProduct(prev => ({ ...prev, category: event.target.value }))} className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none">
                        <option value="Women">Women's Collection</option>
                        <option value="Men">Men's Collection</option>
                        <option value="Unisex">Unisex</option>
                        <option value="Other">Other</option>
                        {!['Women', 'Men', 'Unisex', 'Other'].includes(formProduct.category) && <option value={formProduct.category}>{formProduct.category || 'Unspecified'}</option>}
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Regular price (GH₵)" type="number" min="0.01" step="0.01" value={formProduct.price}
                      onChange={value => setField('price', value)} required={!formProduct.variants.length} />
                    <label className="flex flex-col gap-1 text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">
                      Product availability
                      <select value={formProduct.enabled ? 'true' : 'false'} onChange={(event) => setField('enabled', event.target.value === 'true')} className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none">
                        <option value="true">Enabled</option>
                        <option value="false">Paused</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Brand" value={formProduct.brand} onChange={value => setField('brand', value)} />
                    {!formProduct.variants.length && <>
                      <Input label="Size (ml)" type="number" min="0.01" step="0.01" value={formProduct.sizeMl} onChange={value => setField('sizeMl', value)} />
                      <Input label="Sale price (GH₵)" type="number" min="0.01" step="0.01" value={formProduct.salePrice} onChange={value => setField('salePrice', value)} />
                      <Input label="Stock quantity" type="number" min="0" step="1" value={formProduct.stockQuantity} onChange={value => setField('stockQuantity', value)} placeholder="Leave blank to use availability only" />
                    </>}
                  </div>
                  <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <legend className="text-sm text-luxury-gold mb-2">Collections</legend>
                    {collections.map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-luxury-champagne">
                        <input type="checkbox" checked={formProduct.collections.includes(key)} onChange={() => toggleCollection(key)} />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  <div className="flex flex-wrap gap-4">
                    {[['published', 'Publish on storefront'], ['featured', 'Featured product'], ['newArrival', 'Show in New Arrivals'], ['bestsellerFeatured', 'Include in Best Sellers as a store pick']].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-luxury-champagne">
                        <input type="checkbox" checked={Boolean(formProduct[key])} onChange={event => setField(key, event.target.checked)} />
                        {label}
                      </label>
                    ))}
                  </div>
                  <Input label="Fragrance Notes (comma separated)" value={formProduct.notes} onChange={(value) => setFormProduct(prev => ({ ...prev, notes: value }))} />
                  <label className="flex flex-col gap-1 text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">
                    Detailed Description
                    <textarea rows="3" value={formProduct.description} onChange={(event) => setFormProduct(prev => ({ ...prev, description: event.target.value }))} className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none" />
                  </label>
                </div>

                <div className="md:col-span-4 flex flex-col items-center justify-between border-t md:border-t-0 md:border-l border-luxury-rosegold/10 pt-6 md:pt-0 md:pl-8">
                  <div className="w-full text-center mb-4">
                    <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold block mb-2">Visual Showcase Preview</label>
                    <div className="w-full aspect-[4/5] bg-luxury-black border border-luxury-rosegold/10 overflow-hidden relative group">
                      <StoreImage image={primaryImage} widths={[320, 640]} sizes="(min-width: 768px) 260px, 85vw"
                        alt="Form preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-3">
                        <span className="text-[8px] text-luxury-gold uppercase tracking-widest font-black flex items-center justify-center gap-1"><Sparkles size={8} /> dynamic display <Sparkles size={8} /></span>
                      </div>
                    </div>
                  </div>
                  <input type="file" multiple accept="image/*" id="product-edit-upload" onChange={handleFileChange} className="hidden" />
                  <label htmlFor="product-edit-upload" className="w-full px-4 py-3 bg-luxury-wine/10 hover:bg-luxury-wine/25 cursor-pointer border border-luxury-rosegold/20 text-luxury-champagne text-xs flex items-center justify-center gap-2 hover:border-luxury-rosegold/50 transition-all rounded-none">
                    <Upload size={13} className="text-luxury-rosegold" />
                    {uploading ? 'Uploading File...' : 'Upload product images'}
                  </label>
                  <ul className="w-full mt-3 space-y-2">
                    {formProduct.images.map((image, index) => (
                      <li key={image} className="flex items-center gap-2 text-xs">
                        <span className="w-9 h-9"><StoreImage image={image} widths={[72, 144]} sizes="36px" className="w-full h-full object-cover" /></span>
                        <button type="button" disabled={index === 0} className="flex-1 text-left text-luxury-gold disabled:text-luxury-champagne/70"
                          onClick={() => setField('images', [image, ...formProduct.images.filter(value => value !== image)])}>
                          {index === 0 ? 'Cover image' : 'Make cover'}
                        </button>
                        <button type="button" aria-label={`Remove image ${index + 1}`} onClick={() => setField('images', formProduct.images.filter(value => value !== image))}><X size={15} /></button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <fieldset className="space-y-3 border-t border-luxury-rosegold/15 pt-4">
                <legend className="text-sm text-luxury-gold">Variants</legend>
                {formProduct.variants.map((variant, index) => (
                  <div key={variant.id} className="glass-panel p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white">{variant.label || 'New variant'}</span>
                      <button type="button" className="text-sm text-luxury-rosegold" onClick={() => setField('variants', formProduct.variants.filter(value => value.id !== variant.id))}>Remove variant</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <Input label={`Variant ${index + 1} name`} required value={variant.label} onChange={value => updateVariant(variant.id, 'label', value)} />
                      <Input label={`Variant ${index + 1} size (ml)`} type="number" min="0.01" step="0.01" value={variant.sizeMl} onChange={value => updateVariant(variant.id, 'sizeMl', value)} />
                      <Input label={`Variant ${index + 1} regular price (GH₵)`} type="number" required min="0.01" step="0.01" value={variant.price} onChange={value => updateVariant(variant.id, 'price', value)} />
                      <Input label={`Variant ${index + 1} sale price (GH₵)`} type="number" min="0.01" step="0.01" value={variant.salePrice} onChange={value => updateVariant(variant.id, 'salePrice', value)} />
                      <Input label={`Variant ${index + 1} stock quantity`} type="number" required min="0" step="1" value={variant.stockQuantity} onChange={value => updateVariant(variant.id, 'stockQuantity', value)} />
                    </div>
                  </div>
                ))}
                <button type="button" disabled={formProduct.variants.length >= 30} className="border border-luxury-rosegold/25 px-4 py-2 text-sm text-luxury-gold"
                  onClick={() => setField('variants', [...formProduct.variants, { id: crypto.randomUUID(), label: '', sizeMl: '', price: '', salePrice: '', stockQuantity: '' }])}>Add variant</button>
              </fieldset>

              {errorMsg && <p role="alert" className="text-sm text-luxury-rosegold">{errorMsg}</p>}
              <div className="pt-4 border-t border-luxury-rosegold/10 flex justify-end gap-4">
                <button type="button" onClick={closeForm} className="px-6 py-3.5 bg-transparent border border-luxury-rosegold/10 text-luxury-champagne hover:text-white hover:border-luxury-rosegold/30 text-xs uppercase tracking-widest font-bold transition-all rounded-none">Cancel</button>
                <button type="submit" disabled={saving || uploading} className="px-8 py-3.5 bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white text-xs uppercase tracking-widest font-black flex items-center gap-2 hover:shadow-[0_0_25px_rgba(183,110,121,0.4)] transition-all rounded-none btn-shimmer">
                  {saving ? 'Saving…' : 'Save product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

const Input = ({ label, value, onChange, type = 'text', required = false, ...props }) => (
  <label className="flex flex-col gap-1 text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">
    {label}
    <input
      required={required}
      type={type}
      value={value ?? ''}
      {...props}
      onChange={(event) => onChange(event.target.value)}
      className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
    />
  </label>
);

export default React.memo(AdminProducts);
