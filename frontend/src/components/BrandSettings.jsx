import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, ImageUp, Save, Sparkles, Upload } from 'lucide-react';
import { api, getAssetUrl, getWebPAssetUrl } from '../lib/api';

const DEFAULT_SETTINGS = {
  brandName: "OMAN'S VOGUE",
  heroEyebrow: "L'ART DE LA PARFUMERIE",
  heroHeadlinePrefix: 'WELCOME TO',
  heroSubtitle: '“HERE ARE THE PERFECT COLLECTIONS FOR YOUR PERSONAL INNER GROWTH”',
  heroBackgroundImage: '/images/hero_bg.png',
  heroBackgroundWebp: '/images/hero_bg.webp',
  whatsappNumber: '+233591259991'
};

const BrandSettings = ({ token, brandSettings, onBrandSettingsUpdated, onBrandSettingsRefresh }) => {
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...(brandSettings || {}) });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    setSettings({ ...DEFAULT_SETTINGS, ...(brandSettings || {}) });
  }, [brandSettings]);

  const showSuccess = (message) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const showError = (message) => {
    setErrorMsg(message);
    setTimeout(() => setErrorMsg(''), 5000);
  };

  const getApiErrorMessage = (error, fallback) => {
    const data = error.response?.data;
    return data?.message || data?.error || fallback;
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      const response = await api.post('/api/settings', settings, { headers: authHeaders });
      onBrandSettingsUpdated?.(response.data);
      await onBrandSettingsRefresh?.();
      showSuccess('Brand settings saved permanently.');
    } catch (error) {
      console.error('Failed to save brand settings:', error.response?.data || error.message, error);
      showError(getApiErrorMessage(error, 'Brand settings could not be saved. Refresh your admin session and try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleHeroUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);
    setUploading(true);
    setErrorMsg('');

    try {
      const response = await api.post('/api/settings/hero', formData, {
        headers: { 'Content-Type': 'multipart/form-data', ...authHeaders }
      });
      const nextSettings = response.data?.settings || {
        ...settings,
        heroBackgroundImage: response.data?.imageUrl || settings.heroBackgroundImage,
        heroBackgroundWebp: response.data?.imageUrl || settings.heroBackgroundWebp
      };
      setSettings(nextSettings);
      onBrandSettingsUpdated?.(nextSettings);
      await onBrandSettingsRefresh?.();
      showSuccess('Hero background image updated.');
    } catch (error) {
      console.error('Hero background upload failed:', error.response?.data || error.message, error);
      showError(getApiErrorMessage(error, 'Hero image upload failed. Use an image below 10MB.'));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const heroWebP = settings.heroBackgroundWebp || getWebPAssetUrl(settings.heroBackgroundImage);

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 space-y-8">
      <div>
        <span className="text-[10px] tracking-[0.35em] uppercase font-bold text-luxury-gold block mb-2">
          BRAND ATELIER
        </span>
        <h2 className="font-serif text-2xl sm:text-4xl tracking-widest uppercase text-white font-extrabold">
          BRAND SETTINGS
        </h2>
      </div>

      {successMsg && (
        <div className="p-4 glass-panel border border-green-500/20 bg-green-500/5 text-green-400 text-xs flex items-center gap-2">
          <CheckCircle size={14} />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-4 glass-panel border border-luxury-rosegold/30 bg-luxury-wine/10 text-luxury-rosegold text-xs">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 glass-panel p-6 sm:p-8 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Website Brand Name" value={settings.brandName} onChange={(value) => handleChange('brandName', value)} />
            <Input label="WhatsApp Number" value={settings.whatsappNumber} onChange={(value) => handleChange('whatsappNumber', value)} />
          </div>
          <Input label="Hero Eyebrow" value={settings.heroEyebrow} onChange={(value) => handleChange('heroEyebrow', value)} />
          <Input label="Hero Headline Prefix" value={settings.heroHeadlinePrefix} onChange={(value) => handleChange('heroHeadlinePrefix', value)} />
          <label className="flex flex-col gap-1 text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">
            Hero Subtitle
            <textarea
              rows="4"
              value={settings.heroSubtitle}
              onChange={(event) => handleChange('heroSubtitle', event.target.value)}
              className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
            />
          </label>
          <Input label="Hero Background Image URL" value={settings.heroBackgroundImage} onChange={(value) => handleChange('heroBackgroundImage', value)} />
          <Input label="Hero WebP Image URL" value={settings.heroBackgroundWebp} onChange={(value) => handleChange('heroBackgroundWebp', value)} />

          <div className="pt-4 border-t border-luxury-rosegold/10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <input type="file" accept="image/*" id="hero-settings-upload" onChange={handleHeroUpload} className="hidden" />
            <label htmlFor="hero-settings-upload" className="px-5 py-3 bg-luxury-wine/10 hover:bg-luxury-wine/25 cursor-pointer border border-luxury-rosegold/20 text-luxury-champagne text-xs flex items-center justify-center gap-2 hover:border-luxury-rosegold/50 transition-all rounded-none">
              <Upload size={13} className="text-luxury-rosegold" />
              {uploading ? 'Uploading Hero Image...' : 'Upload Hero Image'}
            </label>
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-gradient-to-r from-luxury-wine to-luxury-rosegold text-white text-xs uppercase tracking-widest font-black flex items-center justify-center gap-2 hover:shadow-[0_0_25px_rgba(183,110,121,0.4)] transition-all rounded-none btn-shimmer disabled:opacity-60"
            >
              <Save size={13} />
              {saving ? 'Saving Settings...' : 'Save Brand Settings'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 glass-panel p-6 sm:p-8">
          <div className="text-center mb-4">
            <span className="text-[9px] uppercase tracking-widest text-luxury-gold font-bold flex items-center justify-center gap-1">
              <Sparkles size={10} />
              Public Hero Preview
            </span>
          </div>
          <div className="relative aspect-[4/5] bg-luxury-black overflow-hidden border border-luxury-rosegold/10">
            <picture className="absolute inset-0 block">
              {heroWebP && <source srcSet={getAssetUrl(heroWebP)} type="image/webp" />}
              <img src={getAssetUrl(settings.heroBackgroundImage)} alt="Hero background preview" className="w-full h-full object-cover scale-105" />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-t from-luxury-black via-luxury-black/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-center">
              <span className="text-[8px] tracking-[0.3em] uppercase font-bold text-luxury-rosegold block mb-2">
                {settings.heroEyebrow}
              </span>
              <h3 className="font-serif text-xl tracking-widest uppercase text-white font-black leading-tight">
                <span className="block">{settings.heroHeadlinePrefix}</span>
                <span className="block text-gold-gradient">{settings.brandName}</span>
              </h3>
              <p className="mt-3 text-[10px] text-luxury-champagne/75 leading-relaxed">
                {settings.heroSubtitle}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-[9px] uppercase tracking-widest text-luxury-champagne/40">
            <ImageUp size={11} className="text-luxury-rosegold" />
            Hero image changes appear after public refresh.
          </div>
        </div>
      </form>
    </div>
  );
};

const Input = ({ label, value, onChange }) => (
  <label className="flex flex-col gap-1 text-[9px] uppercase text-luxury-champagne/50 tracking-wider font-semibold">
    {label}
    <input
      type="text"
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
    />
  </label>
);

export default React.memo(BrandSettings);
