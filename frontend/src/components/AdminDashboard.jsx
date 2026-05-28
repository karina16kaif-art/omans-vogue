import React, { useState } from 'react';
import { Package, ToggleLeft, ToggleRight, Trash2, Plus, X, Upload, CheckCircle, Database, Edit2, LogOut, Sparkles } from 'lucide-react';
import { api, getAssetUrl } from '../lib/api';

const AdminDashboard = ({ products, token, onLogout, onProductUpdated, onProductDeleted, onProductAdded }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Default structure
  const initialFormState = {
    name: '',
    category: 'Women',
    price: '',
    description: '',
    notes: '',
    image: '/images/products/women_placeholder.png', // default fallback placeholder
    inStock: true
  };

  const [formProduct, setFormProduct] = useState(initialFormState);

  const authHeaders = { Authorization: `Bearer ${token}` };

  // Toggle stock immediately from the main table
  const handleStockToggle = async (product) => {
    try {
      const updatedStock = !product.inStock;
      const response = await api.patch(
        `/api/products/${product.id}`,
        { inStock: updatedStock },
        { headers: authHeaders }
      );
      if (response.data) {
        onProductUpdated(response.data);
        showFeedback('Stock status updated successfully!');
      }
    } catch (error) {
      console.error('Failed to toggle stock status:', error);
      showError('Failed to toggle stock. Session might be expired.');
    }
  };

  // Delete product
  const handleDelete = async (id) => {
    if (window.confirm("Are you absolutely sure you want to retire this luxury fragrance from the collections?")) {
      try {
        const response = await api.delete(`/api/products/${id}`, { headers: authHeaders });
        if (response.data) {
          onProductDeleted(id);
          showFeedback('Fragrance retired successfully!');
        }
      } catch (error) {
        console.error('Failed to delete fragrance:', error);
        showError('Failed to delete fragrance. Session might be expired.');
      }
    }
  };

  // Handle uploading product image
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    setUploading(true);
    setErrorMsg('');
    try {
      const res = await api.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...authHeaders
        }
      });
      if (res.data && res.data.imageUrl) {
        setFormProduct(prev => ({ ...prev, image: res.data.imageUrl }));
        showFeedback('Product image uploaded successfully!');
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      showError('Image upload failed. Ensure the image is less than 50MB and file permissions are writable.');
    } finally {
      setUploading(false);
    }
  };

  // Initiate edit mode
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

  // Initiate create mode
  const startCreate = () => {
    setEditingId(null);
    setFormProduct(initialFormState);
    setShowForm(true);
  };

  // Helper feedbacks
  const showFeedback = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
  };

  // Unified Form submission
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formProduct.name || !formProduct.price) {
      showError("Please enter the fragrance name and GHS price.");
      return;
    }

    try {
      const payload = {
        ...formProduct,
        price: Number(formProduct.price)
      };

      if (editingId) {
        // Edit flow
        const response = await api.patch(
          `/api/products/${editingId}`,
          payload,
          { headers: authHeaders }
        );
        if (response.data) {
          onProductUpdated(response.data);
          setShowForm(false);
          setFormProduct(initialFormState);
          showFeedback('Fragrance specifications updated permanently.');
        }
      } else {
        // Create flow
        const response = await api.post(
          '/api/products',
          payload,
          { headers: authHeaders }
        );
        if (response.data) {
          onProductAdded(response.data);
          setShowForm(false);
          setFormProduct(initialFormState);
          showFeedback('New fragrance creation launched successfully.');
        }
      }
    } catch (error) {
      console.error('Failed to submit fragrance specs:', error);
      showError('Failed to save changes. Verify security credentials.');
    }
  };

  // Calculations for stats
  const totalFragrances = products.length;
  const inStockCount = products.filter(p => p.inStock).length;
  const outOfStockCount = totalFragrances - inStockCount;

  return (
    <section id="admin" className="relative max-w-7xl mx-auto px-6 md:px-12 py-24 z-10 border-t border-luxury-rosegold/5">
      
      {/* Upper bar with logout and main stats */}
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
          <button
            onClick={startCreate}
            className="px-5 py-3 bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white text-xs uppercase tracking-widest font-bold flex items-center gap-2 hover:shadow-[0_0_15px_rgba(183,110,121,0.3)] transition-all transform hover:scale-[1.02] rounded-none btn-shimmer"
          >
            <Plus size={14} />
            Create Fragrance
          </button>
          
          <button
            onClick={onLogout}
            className="px-4 py-3 bg-transparent border border-luxury-rosegold/20 text-luxury-champagne hover:text-white hover:border-luxury-rosegold/50 text-xs uppercase tracking-widest font-bold flex items-center gap-2 transition-all rounded-none"
            title="Secure Logout"
          >
            <LogOut size={13} className="text-luxury-rosegold" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Message feedback strips */}
      {successMsg && (
        <div className="mb-6 p-4 glass-panel border border-green-500/20 bg-green-500/5 text-green-400 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle size={14} />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 glass-panel border border-luxury-rosegold/30 bg-luxury-wine/10 text-luxury-rosegold text-xs flex items-center gap-2 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-luxury-rosegold animate-ping" />
          {errorMsg}
        </div>
      )}

      {/* Analytics Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
        <div className="p-6 glass-panel border-l-2 border-l-luxury-gold flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase text-luxury-champagne/50 tracking-wider font-semibold block mb-1">Total Fragrances</span>
            <span className="text-3xl font-serif font-black text-white">{totalFragrances}</span>
          </div>
          <Database size={24} className="text-luxury-gold opacity-30" />
        </div>
        <div className="p-6 glass-panel border-l-2 border-l-green-500 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase text-luxury-champagne/50 tracking-wider font-semibold block mb-1">Active Stock In</span>
            <span className="text-3xl font-serif font-black text-white">{inStockCount}</span>
          </div>
          <Package size={24} className="text-green-500 opacity-30" />
        </div>
        <div className="p-6 glass-panel border-l-2 border-l-luxury-rosegold flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase text-luxury-champagne/50 tracking-wider font-semibold block mb-1">Out of Stock Count</span>
            <span className="text-3xl font-serif font-black text-white">{outOfStockCount}</span>
          </div>
          <Package size={24} className="text-luxury-rosegold opacity-30" />
        </div>
      </div>

      {/* Catalog Table */}
      <div className="glass-panel overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-luxury-rosegold/10 text-luxury-champagne/60 uppercase tracking-widest text-[9px] font-bold">
              <th className="p-5 font-bold">Preview</th>
              <th className="p-5 font-bold">Fragrance Name</th>
              <th className="p-5 font-bold">Collection</th>
              <th className="p-5 font-bold">GHS Price</th>
              <th className="p-5 font-bold text-center">Stock status</th>
              <th className="p-5 font-bold text-right">Inventory Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-luxury-rosegold/5">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-white/[0.02] transition-colors">
                {/* Image */}
                <td className="p-5">
                  <div className="w-12 h-12 bg-luxury-black border border-luxury-rosegold/10 overflow-hidden relative">
                    <img 
                      src={getAssetUrl(product.image)} 
                      alt={product.name} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = product.category === 'Women' 
                          ? '/images/products/women_placeholder.png' 
                          : '/images/products/men_placeholder.png';
                      }}
                    />
                  </div>
                </td>
                {/* Name */}
                <td className="p-5 font-serif text-sm font-bold text-white tracking-wide">
                  {product.name}
                  <span className="text-[9px] text-luxury-champagne/40 block mt-1 line-clamp-1 max-w-[250px] font-sans font-light">
                    {product.notes}
                  </span>
                </td>
                {/* Cat */}
                <td className="p-5 text-luxury-champagne">
                  <span className="px-2 py-0.5 border border-luxury-rosegold/20 bg-luxury-rosegold/10 text-[9px] uppercase tracking-wider font-bold">
                    {product.category}
                  </span>
                </td>
                {/* Price */}
                <td className="p-5 font-serif font-black text-white text-sm">
                  GHS {product.price}.00
                </td>
                {/* Stock Toggle */}
                <td className="p-5 text-center">
                  <button
                    onClick={() => handleStockToggle(product)}
                    className="transition-colors hover:text-white"
                  >
                    {product.inStock ? (
                      <div className="flex items-center justify-center gap-1.5 text-green-500 font-bold tracking-wider uppercase text-[9px]">
                        <ToggleRight size={24} />
                        <span>In Stock</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 text-luxury-rosegold font-bold tracking-wider uppercase text-[9px] opacity-60">
                        <ToggleLeft size={24} />
                        <span>Out of Stock</span>
                      </div>
                    )}
                  </button>
                </td>
                {/* Delete/Edit actions */}
                <td className="p-5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => startEdit(product)}
                      title="Edit specifications"
                      className="p-2 border border-luxury-rosegold/10 text-luxury-champagne/60 hover:text-luxury-gold hover:border-luxury-gold/30 rounded-full transition-all"
                    >
                      <Edit2 size={13} />
                    </button>
                    
                    <button
                      onClick={() => handleDelete(product.id)}
                      title="Retire fragrance"
                      className="p-2 border border-luxury-rosegold/10 text-luxury-champagne/60 hover:text-luxury-rosegold hover:border-luxury-rosegold/30 rounded-full transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Creation & Editing Modal Form Panel */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowForm(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
          
          <div className="relative w-full max-w-3xl glass-panel-heavy border border-luxury-rosegold/20 p-6 sm:p-8 z-10 max-h-[92vh] overflow-y-auto">
            <button 
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 p-2 border border-luxury-rosegold/10 text-luxury-champagne hover:text-white rounded-full transition-all"
            >
              <X size={15} />
            </button>

            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="text-center pb-4 border-b border-luxury-rosegold/10">
                <span className="text-[9px] uppercase tracking-widest text-luxury-gold font-bold">
                  {editingId ? 'Secure Modification Vault' : 'New Product Formulation'}
                </span>
                <h3 className="font-serif text-lg tracking-widest text-white uppercase font-black">
                  {editingId ? 'EDIT FRAGRANCE SPECIFICATIONS' : 'ADD NEW LUXURY FRAGRANCE'}
                </h3>
              </div>

              {/* Grid showcasing details form alongside dynamic visual preview */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                
                {/* Left Side: Inputs (8 cols) */}
                <div className="md:col-span-8 space-y-5">
                  {/* Name & Collection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Fragrance Name</label>
                      <input
                        required
                        type="text"
                        placeholder="Signature Oud"
                        value={formProduct.name}
                        onChange={(e) => setFormProduct(prev => ({ ...prev, name: e.target.value }))}
                        className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Target Collection</label>
                      <select
                        value={formProduct.category}
                        onChange={(e) => {
                          const cat = e.target.value;
                          setFormProduct(prev => ({ ...prev, category: cat }));
                        }}
                        className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                      >
                        <option value="Women">Women's Collection</option>
                        <option value="Men">Men's Collection</option>
                      </select>
                    </div>
                  </div>

                  {/* Price & Stock Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">GHS Price</label>
                      <input
                        required
                        type="number"
                        placeholder="180"
                        value={formProduct.price}
                        onChange={(e) => setFormProduct(prev => ({ ...prev, price: e.target.value }))}
                        className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Active Inventory Status</label>
                      <select
                        value={formProduct.inStock ? "true" : "false"}
                        onChange={(e) => setFormProduct(prev => ({ ...prev, inStock: e.target.value === "true" }))}
                        className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                      >
                        <option value="true">In Stock</option>
                        <option value="false">Out of Stock</option>
                      </select>
                    </div>
                  </div>

                  {/* Fragrance Notes */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Fragrance Notes (comma separated)</label>
                    <input
                      type="text"
                      placeholder="White Jasmine, Amberwood, Italian Clementine"
                      value={formProduct.notes}
                      onChange={(e) => setFormProduct(prev => ({ ...prev, notes: e.target.value }))}
                      className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                    />
                  </div>

                  {/* Description */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">Detailed Description</label>
                    <textarea
                      rows="3"
                      placeholder="An exquisite signature fragrance crafted with royal patchouli..."
                      value={formProduct.description}
                      onChange={(e) => setFormProduct(prev => ({ ...prev, description: e.target.value }))}
                      className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
                    />
                  </div>
                </div>

                {/* Right Side: Upload and Immediate Preview (4 cols) */}
                <div className="md:col-span-4 flex flex-col items-center justify-between border-t md:border-t-0 md:border-l border-luxury-rosegold/10 pt-6 md:pt-0 md:pl-8">
                  
                  <div className="w-full text-center mb-4">
                    <label className="text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold block mb-2">Visual Showcase Preview</label>
                    <div className="w-full aspect-[4/5] bg-luxury-black border border-luxury-rosegold/10 overflow-hidden relative group">
                      <img 
                        src={getAssetUrl(formProduct.image)} 
                        alt="Form Preview" 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                        onError={(e) => {
                          e.target.src = formProduct.category === 'Women' 
                            ? '/images/products/women_placeholder.png' 
                            : '/images/products/men_placeholder.png';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-3">
                        <span className="text-[8px] text-luxury-gold uppercase tracking-widest font-black flex items-center justify-center gap-1">
                          <Sparkles size={8} /> dynamic display <Sparkles size={8} />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Upload button wrapper */}
                  <div className="w-full">
                    <input
                      type="file"
                      accept="image/*"
                      id="product-edit-upload"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="product-edit-upload"
                      className="w-full px-4 py-3 bg-luxury-wine/10 hover:bg-luxury-wine/25 cursor-pointer border border-luxury-rosegold/20 text-luxury-champagne text-xs flex items-center justify-center gap-2 hover:border-luxury-rosegold/50 transition-all rounded-none"
                    >
                      <Upload size={13} className="text-luxury-rosegold" />
                      {uploading ? 'Uploading File...' : 'Upload Product Picture'}
                    </label>
                  </div>

                </div>

              </div>

              {/* Submit btn */}
              <div className="pt-4 border-t border-luxury-rosegold/10 flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-3.5 bg-transparent border border-luxury-rosegold/10 text-luxury-champagne hover:text-white hover:border-luxury-rosegold/30 text-xs uppercase tracking-widest font-bold transition-all rounded-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3.5 bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white text-xs uppercase tracking-widest font-black flex items-center gap-2 hover:shadow-[0_0_25px_rgba(183,110,121,0.4)] transition-all rounded-none btn-shimmer"
                >
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

export default AdminDashboard;
