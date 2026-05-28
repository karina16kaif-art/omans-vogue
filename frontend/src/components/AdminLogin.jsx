import React, { useState } from 'react';
import { Lock, User, ShieldAlert, Sparkles } from 'lucide-react';
import { api } from '../lib/api';

const AdminLogin = ({ onLoginSuccess, onCancel }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all security fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/api/auth/login', { username, password });
      if (response.data && response.data.token) {
        onLoginSuccess(response.data.token);
      }
    } catch (err) {
      console.error('Authentication failure:', err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('Connection to security vault failed. Verify backend services are active.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-luxury-black relative flex flex-col justify-center items-center px-4 overflow-hidden">
      {/* Absolute Decorative Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-luxury-wine/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-luxury-rosegold/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Main Luxury Container */}
      <div className="w-full max-w-md relative z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-8 space-y-2">
          <span className="text-[10px] tracking-[0.6em] uppercase font-bold text-luxury-rosegold block mb-1">ATELIER PRIVÉ</span>
          <h1 className="font-serif text-3xl tracking-[0.2em] text-white uppercase font-black">
            OMAN'S VOGUE
          </h1>
          <div className="w-16 h-[1px] bg-gradient-to-r from-luxury-gold to-luxury-rosegold mx-auto mt-3" />
        </div>

        {/* Login Form Panel */}
        <div className="glass-panel-heavy border border-luxury-rosegold/20 p-8 sm:p-10 shadow-2xl relative">
          
          <div className="absolute -top-3 -right-3 p-2 bg-gradient-to-r from-luxury-wine to-luxury-rosegold border border-luxury-rosegold/30 rounded-full text-white">
            <Lock size={16} />
          </div>

          <div className="mb-8">
            <h2 className="font-serif text-lg tracking-widest text-white uppercase font-bold mb-2">SECURE CONCIERGE LOCK</h2>
            <p className="text-[11px] text-luxury-champagne/60 leading-relaxed font-sans font-light">
              Access to this terminal is strictly restricted to authorized fragrances directors.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 border border-luxury-rosegold/35 bg-luxury-wine/20 text-luxury-rosegold text-xs flex items-start gap-2.5">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase text-luxury-champagne/60 tracking-widest font-semibold flex items-center gap-1.5">
                <User size={10} className="text-luxury-gold" />
                Director Username
              </label>
              <input
                required
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
                className="w-full px-4 py-3 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold/50 focus:outline-none transition-all rounded-none font-sans"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase text-luxury-champagne/60 tracking-widest font-semibold flex items-center gap-1.5">
                <Lock size={10} className="text-luxury-gold" />
                Security Password
              </label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••••"
                className="w-full px-4 py-3 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold/50 focus:outline-none transition-all rounded-none font-sans"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white text-xs uppercase tracking-widest font-black flex items-center justify-center gap-2 hover:shadow-[0_0_25px_rgba(183,110,121,0.4)] disabled:opacity-50 transition-all cursor-pointer rounded-none btn-shimmer"
              >
                {loading ? 'Verifying Safe Vault...' : 'Unlock Console'}
              </button>
              
              <button
                type="button"
                onClick={onCancel}
                className="w-full py-3 bg-transparent border border-luxury-rosegold/10 text-luxury-champagne/60 hover:text-white hover:border-luxury-rosegold/30 text-xs uppercase tracking-widest font-bold transition-all rounded-none"
              >
                Return to Store
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[9px] text-luxury-champagne/30 uppercase tracking-[0.2em] flex items-center justify-center gap-1 font-serif">
            OMAN'S VOGUE <Sparkles size={8} className="text-luxury-rosegold" /> ROYAL CHRONICLES
          </p>
        </div>

      </div>
    </div>
  );
};

export default AdminLogin;
