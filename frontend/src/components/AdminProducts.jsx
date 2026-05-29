import React, { useMemo, useState } from 'react';
import { CheckCircle, Database, Edit2, LogOut, Package, Plus, Sparkles, ToggleLeft, ToggleRight, Trash2, Upload, X } from 'lucide-react';
import { api, getAssetUrl, getWebPAssetUrl } from '../lib/api';

const initialProduct = {
  name: '',
  category: 'Women',
  price: '',
  description: '',
  notes: '',
  image: '/images/products/women_placeholder.png',
  inStock: true
};

const AdminProducts = ({ products, token, onLogout, onProductUpdated, onProductDeleted, onProductAdded, onProductsRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formProduct, setFormProduct] = useState(initialProduct);
  const [uploading, setUploading] = useState(false);
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

  const logApiError = (label, error) => {
    console.error(label, error.response?.data || error.message, error);
  };

  const startCreate = () => {
    setEditingId(null);
    setFormProduct(initialProduct);
    setShowForm(true);
  };

  const startEdit = (product) => {
    setEditingId(product.id);
    setFormProduct({
      name: product.name,
      category: product.category,
      price: product.price,
      description: product.description || '',
      notes: product.notes || '',
      image: product.image || (product.category === 'Women' ? '/images/products/women_placeholder.png' : '/images/products/men_placeholder.png'),
      inStock: product.inStock !== undefined ? product.inStock : true
    });
    setShowForm(true);
  };

  const handleStockToggle = async (product) => {
    try {
      const response = await api.patch(`/api/products/${product.id}`, { inStock: !product.inStock }, { headers: authHeaders });
      onProductUpdated(response.data);
      await onProductsRefresh?.();
      showFeedback('Stock status updated successfully!');
    } catch (error) {
      logApiError('Failed to toggle stock.', error);
      showError('Failed to toggle stock. Session might be expired.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you absolutely sure you want to retire this luxury fragrance from the collections?')) return;
    try {
      await api.delete(`/api/products/${id}`, { headers: authHeaders });
      onProductDeleted(id);
      await onProductsRefresh?.();
      showFeedback('Fragrance retired successfully!');
    } catch (error) {
      logApiError('Failed to delete fragrance.', error);
      showError('Failed to delete fragrance. Session might be expired.');
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    setUploading(true);
    try {
      const response = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data', ...authHeaders }
      });
      const uploadedImage = response.data.imageUrl;
      setFormProduct(prev => ({ ...prev, image: uploadedImage }));

      if (editingId && uploadedImage) {
        const updateResponse = await api.patch(`/api/products/${editingId}`, { image: uploadedImage }, { headers: authHeaders });
        onProductUpdated(updateResponse.data);
        await onProductsRefresh?.();
        showFeedback('Product image uploaded and saved permanently.');
      } else {
        showFeedback('Product image uploaded. Save the product to publish it.');
      }
    } catch (error) {
      logApiError('Image upload failed.', error);
      showError('Image upload failed. Ensure the image is less than 8MB.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    if (!formProduct.name || !formProduct.price) {
      showError('Please enter the fragrance name and GHS price.');
      return;
    }
    const payload = { ...formProduct, price: Number(formProduct.price) };
    try {
      if (editingId) {
        const response = await api.patch(`/api/products/${editingId}`, payload, { headers: authHeaders });
        onProductUpdated(response.data);
        await onProductsRefresh?.();
        showFeedback('Fragrance specifications updated permanently.');
      } else {
        const response = await api.post('/api/products', payload, { headers: authHeaders });
        onProductAdded(response.data);
        await onProductsRefresh?.();
        showFeedback('New fragrance creation launched successfully.');
      }
      setShowForm(false);
      setEditingId(null);
      setFormProduct(initialProduct);
    } catch (error) {
      logApiError('Failed to submit fragrance specs.', error);
      showError('Failed to save changes. Verify security credentials.');
    }
  };

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
                    <span className="px-2 py-0.5 border border-luxury-rosegold/20 bg-luxury-rosegold/10 text-[9px] uppercase tracking-wider font-bold">{product.category}</span>
                  </td>
                  <td className="p-5 font-serif font-black text-white text-sm">GHS {product.price}.00</td>
                  <td className="p-5 text-center">
                    <button onClick={() => handleStockToggle(product)} className="transition-colors hover:text-white">
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
          <div onClick={() => setShowForm(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
          <div className="relative w-full max-w-3xl glass-panel-heavy border border-luxury-rosegold/20 p-6 sm:p-8 z-10 max-h-[92vh] overflow-y-auto">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 p-2 border border-luxury-rosegold/10 text-luxury-champagne hover:text-white rounded-full transition-all"><X size={15} /></button>
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="text-center pb-4 border-b border-luxury-rosegold/10">
                <span className="text-[9px] uppercase tracking-widest text-luxury-gold font-bold">{editingId ? 'Secure Modification Vault' : 'New Product Formulation'}</span>
                <h3 className="font-serif text-lg tracking-widest text-white uppercase font-black">{editingId ? 'EDIT FRAGRANCE SPECIFICATIONS' : 'ADD NEW LUXURY FRAGRANCE'}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-8 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Fragrance Name" value={formProduct.name} onChange={(value) => setFormProduct(prev => ({ ...prev, name: value }))} required />
                    <label className="flex flex-col gap-1 text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">
                      Target Collection
                      <select value={formProduct.category} onChange={(event) => setFormProduct(prev => ({ ...prev, category: event.target.value }))} className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none">
                        <option value="Women">Women's Collection</option>
                        <option value="Men">Men's Collection</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="GHS Price" type="number" value={formProduct.price} onChange={(value) => setFormProduct(prev => ({ ...prev, price: value }))} required />
                    <label className="flex flex-col gap-1 text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">
                      Active Inventory Status
                      <select value={formProduct.inStock ? 'true' : 'false'} onChange={(event) => setFormProduct(prev => ({ ...prev, inStock: event.target.value === 'true' }))} className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none">
                        <option value="true">In Stock</option>
                        <option value="false">Out of Stock</option>
                      </select>
                    </label>
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
                        {getWebPAssetUrl(formProduct.image) && <source srcSet={getWebPAssetUrl(formProduct.image)} type="image/webp" />}
                        <img src={getAssetUrl(formProduct.image)} alt="Form Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" decoding="async" />
                      </picture>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-3">
                        <span className="text-[8px] text-luxury-gold uppercase tracking-widest font-black flex items-center justify-center gap-1"><Sparkles size={8} /> dynamic display <Sparkles size={8} /></span>
                      </div>
                    </div>
                  </div>
                  <input type="file" accept="image/*" id="product-edit-upload" onChange={handleFileChange} className="hidden" />
                  <label htmlFor="product-edit-upload" className="w-full px-4 py-3 bg-luxury-wine/10 hover:bg-luxury-wine/25 cursor-pointer border border-luxury-rosegold/20 text-luxury-champagne text-xs flex items-center justify-center gap-2 hover:border-luxury-rosegold/50 transition-all rounded-none">
                    <Upload size={13} className="text-luxury-rosegold" />
                    {uploading ? 'Uploading File...' : 'Upload Product Picture'}
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-luxury-rosegold/10 flex justify-end gap-4">
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3.5 bg-transparent border border-luxury-rosegold/10 text-luxury-champagne hover:text-white hover:border-luxury-rosegold/30 text-xs uppercase tracking-widest font-bold transition-all rounded-none">Cancel</button>
                <button type="submit" className="px-8 py-3.5 bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white text-xs uppercase tracking-widest font-black flex items-center gap-2 hover:shadow-[0_0_25px_rgba(183,110,121,0.4)] transition-all rounded-none btn-shimmer">
                  {editingId ? 'Save Perfume Specs' : 'Formulate Fragrance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

const Input = ({ label, value, onChange, type = 'text', required = false }) => (
  <label className="flex flex-col gap-1 text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">
    {label}
    <input
      required={required}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
    />
  </label>
);

export default React.memo(AdminProducts);
