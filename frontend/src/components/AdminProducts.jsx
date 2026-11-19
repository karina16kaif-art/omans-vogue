import React, { useMemo, useState } from 'react';
import { CheckCircle, Database, Edit2, LogOut, Package, Plus, Sparkles, ToggleLeft, ToggleRight, Trash2, Upload, X } from 'lucide-react';
import { api, getAssetUrl, getWebPAssetUrl } from '../lib/api';
import { assignedCollections, collections, currency, displayOption, optionPrice } from '../lib/catalogue';

const initialProduct = {
  name: '',
  category: 'Other',
  price: '',
  description: '',
  notes: '',
  brand: '', collections: [], images: [], variants: [], salePrice: '', sizeMl: '', stockQuantity: '',
  enabled: true, featured: false, newArrival: true
};

const AdminProducts = ({ products, token, onLogout, onProductUpdated, onProductDeleted, onProductAdded, onProductsRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formProduct, setFormProduct] = useState(initialProduct);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const stats = useMemo(() => {
    const total = products.length;
    const inStock = products.filter(product => product.inStock).length;
    return { total, inStock, outOfStock: total - inStock };
  }, [products]);

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
      collections: assignedCollections(product),
      images: product.images?.length ? product.images : [product.image].filter(Boolean),
      variants: product.variants || []
    });
    setShowForm(true);
  };

  const handleStockToggle = async (product) => {
    try {
      const response = await api.patch(`/api/products/${product.id}`, { enabled: !(product.enabled ?? product.inStock), catalogVersion: product.catalogVersion }, { headers: authHeaders });
      onProductUpdated(response.data);
      await onProductsRefresh?.();
      showFeedback('Stock status updated successfully!');
    } catch (error) {
      showError(error.response?.data?.error || 'Could not update stock.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this product from the storefront?')) return;
    try {
      await api.delete(`/api/products/${id}`, { headers: authHeaders });
      onProductDeleted(id);
      await onProductsRefresh?.();
      showFeedback('Fragrance retired successfully!');
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
        const response = await api.patch(`/api/products/${editingId}`, formProduct, { headers: authHeaders });
        onProductUpdated(response.data);
      } else {
        const response = await api.post('/api/products', formProduct, { headers: authHeaders });
        onProductAdded(response.data);
      }
      showFeedback('Product saved.');
      setShowForm(false);
      await onProductsRefresh?.();
    } catch (error) {
      showError(error.response?.data?.error || 'Could not save this product.');
      if (error.response?.status === 409) await onProductsRefresh?.();
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
          <button onClick={startCreate} className="px-5 py-3 bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white text-xs uppercase tracking-widest font-bold flex items-center gap-2 hover:shadow-[0_0_15px_rgba(183,110,121,0.3)] transition-all transform hover:scale-[1.02] rounded-none btn-shimmer">
            <Plus size={14} />
            Create Fragrance
          </button>
          <button onClick={onLogout} className="px-4 py-3 bg-transparent border border-luxury-rosegold/20 text-luxury-champagne hover:text-white hover:border-luxury-rosegold/50 text-xs uppercase tracking-widest font-bold flex items-center gap-2 transition-all rounded-none">
            <LogOut size={13} className="text-luxury-rosegold" />
            Logout
          </button>
        </div>
      </div>

      {successMsg && <div className="mb-6 p-4 glass-panel border border-green-500/20 bg-green-500/5 text-green-400 text-xs flex items-center gap-2"><CheckCircle size={14} />{successMsg}</div>}
      {errorMsg && <div className="mb-6 p-4 glass-panel border border-luxury-rosegold/30 bg-luxury-wine/10 text-luxury-rosegold text-xs">{errorMsg}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
        {[
          ['Total Fragrances', stats.total, Database, 'border-l-luxury-gold'],
          ['Active Stock In', stats.inStock, Package, 'border-l-green-500'],
          ['Out of Stock Count', stats.outOfStock, Package, 'border-l-luxury-rosegold']
        ].map(([label, value, Icon, borderClass]) => (
          <div key={label} className={`p-6 glass-panel border-l-2 ${borderClass} flex items-center justify-between`}>
            <div>
              <span className="text-[10px] uppercase text-luxury-champagne/50 tracking-wider font-semibold block mb-1">{label}</span>
              <span className="text-3xl font-serif font-black text-white">{value}</span>
            </div>
            <Icon size={24} className="text-luxury-gold opacity-30" />
          </div>
        ))}
      </div>

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
              const webPUrl = getWebPAssetUrl(product.image);
              return (
                <tr key={product.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-5">
                    <div className="w-12 h-12 bg-luxury-black border border-luxury-rosegold/10 overflow-hidden">
                      <picture className="block w-full h-full">
                        {webPUrl && <source srcSet={webPUrl} type="image/webp" />}
                        <img src={getAssetUrl(product.image)} alt={product.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      </picture>
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
                    <button onClick={() => handleStockToggle(product)} aria-label={`Pause or enable ${product.name}`} className="transition-colors hover:text-white">
                      {product.inStock ? (
                        <div className="flex items-center justify-center gap-1.5 text-green-500 font-bold tracking-wider uppercase text-[9px]"><ToggleRight size={24} />In Stock</div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 text-luxury-rosegold font-bold tracking-wider uppercase text-[9px] opacity-60"><ToggleLeft size={24} />Out of Stock</div>
                      )}
                    </button>
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => startEdit(product)} className="p-2 border border-luxury-rosegold/10 text-luxury-champagne/60 hover:text-luxury-gold hover:border-luxury-gold/30 rounded-full transition-all"><Edit2 size={13} /></button>
                      <button onClick={() => handleDelete(product.id)} className="p-2 border border-luxury-rosegold/10 text-luxury-champagne/60 hover:text-luxury-rosegold hover:border-luxury-rosegold/30 rounded-full transition-all"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
                    {[['featured', 'Featured product'], ['newArrival', 'Show in New Arrivals']].map(([key, label]) => (
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
                      <picture className="block w-full h-full">
                        {getWebPAssetUrl(primaryImage) && <source srcSet={getWebPAssetUrl(primaryImage)} type="image/webp" />}
                        <img src={getAssetUrl(primaryImage)} alt="Form Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" decoding="async" />
                      </picture>
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
                        <img src={getAssetUrl(image)} alt="" className="w-9 h-9 object-cover" />
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
