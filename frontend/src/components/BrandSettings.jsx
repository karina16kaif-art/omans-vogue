import React, { useMemo, useState } from 'react';
import { CheckCircle, ImageUp, Save, Sparkles, Upload } from 'lucide-react';
import { api, getAssetUrl, getWebPAssetUrl } from '../lib/api';
import { collectionDefinitions, homepageSections } from '../lib/catalogue';

const DEFAULT_SETTINGS = {
  brandName: "OMAN'S VOGUE",
  heroEyebrow: "L'ART DE LA PARFUMERIE",
  heroHeadlinePrefix: 'WELCOME TO',
  heroSubtitle: '“HERE ARE THE PERFECT COLLECTIONS FOR YOUR PERSONAL INNER GROWTH”',
  heroBackgroundImage: '/images/hero_bg.png',
  heroBackgroundWebp: '/images/hero_bg.webp',
  whatsappNumber: '+233591259991',
  momoNumber: '',
  momoAccountName: '',
  momoPaymentInstructions: '',
  pickupLocation: 'Jean Nelson Hostel, University of Ghana, Legon',
  campusDeliveryFee: 10,
  storefront: {}
};

const BrandSettings = ({ token, brandSettings, onBrandSettingsUpdated, onBrandSettingsRefresh, onAdminTokenUpdated }) => {
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...(brandSettings || {}) });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [conflict, setConflict] = useState(false);
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

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

  const updateSection = (key, field, value) => {
    const storefront = settings.storefront || {};
    handleChange('storefront', {
      ...storefront,
      sections: { ...storefront.sections, [key]: { ...storefront.sections?.[key], [field]: value } }
    });
  };

  const editCollections = (update) => setSettings(previous => ({
    ...previous,
    storefront: {
      ...previous.storefront,
      collectionDefinitions: update(collectionDefinitions(previous.storefront))
    }
  }));

  const editContact = (key, value) => setSettings(previous => ({
    ...previous,
    storefront: { ...previous.storefront, contact: { ...previous.storefront?.contact, [key]: value } }
  }));

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setConflict(false);
    try {
      const response = await api.post('/api/settings', settings, { headers: authHeaders });
      setSettings({ ...DEFAULT_SETTINGS, ...response.data });
      onBrandSettingsUpdated?.(response.data);
      showSuccess('Brand settings saved permanently.');
    } catch (error) {
      console.error('Failed to save brand settings:', error.response?.data || error.message, error);
      showError(getApiErrorMessage(error, 'Brand settings could not be saved. Refresh your admin session and try again.'));
      setConflict(error.response?.status === 409);
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
      setSettings(previous => ({
        ...previous, heroBackgroundImage: nextSettings.heroBackgroundImage,
        heroBackgroundWebp: nextSettings.heroBackgroundWebp, settingsRevision: nextSettings.settingsRevision
      }));
      onBrandSettingsUpdated?.(nextSettings);
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
      {conflict && <button type="button" className="text-sm underline" onClick={() => onBrandSettingsRefresh?.()}>Load current settings</button>}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 glass-panel p-6 sm:p-8 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Website Brand Name" value={settings.brandName} onChange={(value) => handleChange('brandName', value)} />
            <Input label="WhatsApp order number" type="tel" required value={settings.whatsappNumber} onChange={(value) => handleChange('whatsappNumber', value)} />
          </div>
          <Input label="Hero Eyebrow" value={settings.heroEyebrow} onChange={(value) => handleChange('heroEyebrow', value)} />
          <Input label="Hero Headline Prefix" value={settings.heroHeadlinePrefix} onChange={(value) => handleChange('heroHeadlinePrefix', value)} />
          <label className="flex flex-col gap-1 text-sm text-luxury-champagne/80 font-semibold">
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

          <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <legend className="text-sm uppercase tracking-widest text-luxury-rosegold font-bold mb-2">Checkout settings</legend>
            <Input label="MoMo payment number" type="tel" value={settings.momoNumber} onChange={(value) => handleChange('momoNumber', value)} />
            <Input label="MoMo account name" maxLength={120} value={settings.momoAccountName} onChange={(value) => handleChange('momoAccountName', value)} />
            <label className="flex flex-col gap-1 text-sm text-luxury-champagne/80 font-semibold sm:col-span-2">
              MoMo payment instructions
              <textarea
                rows={3}
                maxLength={500}
                value={settings.momoPaymentInstructions}
                onChange={event => handleChange('momoPaymentInstructions', event.target.value)}
                className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none"
              />
              <span className="text-xs font-normal">Optional directions shown to customers at checkout. Use customer-facing text only.</span>
            </label>
            <p className="text-sm text-luxury-champagne/80">Free pickup at {settings.pickupLocation}.</p>
            <p className="text-sm text-luxury-champagne/80">Eligible campus delivery costs GH₵10. Confirm outside-campus fees in Orders.</p>
          </fieldset>

          <fieldset className="space-y-4 pt-2">
            <legend className="text-sm uppercase tracking-widest text-luxury-rosegold font-bold mb-2">Customer contact</legend>
            <Input label="WhatsApp support number" type="tel" value={settings.storefront?.contact?.whatsapp} placeholder="Uses the order number when blank"
              onChange={value => editContact('whatsapp', value)} />
            <Input label="Public support email" type="email" maxLength={254} value={settings.storefront?.contact?.email}
              onChange={value => editContact('email', value)} />
            <Input label="Instagram username" maxLength={30} value={settings.storefront?.contact?.instagram ?? 'Eugeniaa..a'}
              onChange={value => editContact('instagram', value)} />
          </fieldset>

          <fieldset className="space-y-4 pt-2">
            <legend className="text-sm uppercase tracking-widest text-luxury-rosegold font-bold mb-2">Storefront collections</legend>
            <div className="space-y-3">
              {collectionDefinitions(settings.storefront).map(({ id, name, visible }, index) => (
                <div key={id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-2 sm:items-end p-3 border border-luxury-rosegold/15">
                  <Input label={`Collection ${index + 1} name`} maxLength={64} required value={name}
                    onChange={value => editCollections(items => items.map(item => item.id === id ? { ...item, name: value } : item))} />
                  <label className="flex items-center gap-1.5 text-sm pb-2">
                    <input type="checkbox" checked={visible !== false}
                      onChange={event => editCollections(items => items.map(item => item.id === id ? { ...item, visible: event.target.checked } : item))} />
                    Visible
                  </label>
                  <button type="button" aria-label={`Remove collection ${name || index + 1}`} className="justify-self-start text-sm underline pb-2"
                    onClick={() => {
                      if (!name || window.confirm(`Remove ${name} from the storefront? Products and past orders are kept.`)) {
                        editCollections(items => items.filter(item => item.id !== id));
                      }
                    }}>Remove</button>
                </div>
              ))}
            </div>
            <button type="button" className="border border-luxury-rosegold/30 px-4 py-2 text-sm"
              disabled={collectionDefinitions(settings.storefront).length >= 64}
              onClick={() => {
                const entry = { id: `custom-${crypto.randomUUID()}`, name: '', visible: true };
                editCollections(items => [...items, entry]);
              }}>Add collection</button>
            <Input label="Affordable price threshold (GH₵)" type="number" min="0.01" step="0.01"
              value={settings.storefront?.affordableThreshold}
              onChange={value => handleChange('storefront', { ...settings.storefront, affordableThreshold: value })} />
            <p className="text-sm text-luxury-champagne/75">Leave blank to use manual assignments only.</p>
          </fieldset>

          <fieldset className="space-y-3 pt-2">
            <legend className="text-sm uppercase tracking-widest text-luxury-rosegold font-bold mb-2">Homepage content</legend>
            {homepageSections.map(([key, label]) => (
              <details key={key} className="p-4 border border-luxury-rosegold/20">
                <summary className="cursor-pointer text-sm text-white">{label}</summary>
                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm text-luxury-champagne">
                    <input type="checkbox" checked={settings.storefront?.sections?.[key]?.visible !== false}
                      onChange={event => updateSection(key, 'visible', event.target.checked)} />
                    Show section
                  </label>
                  <Input label={`${label} title`} maxLength={100} placeholder={label}
                    value={settings.storefront?.sections?.[key]?.title}
                    onChange={value => updateSection(key, 'title', value)} />
                  <Input label={`${label} description`} maxLength={360}
                    value={settings.storefront?.sections?.[key]?.description}
                    onChange={value => updateSection(key, 'description', value)} />
                </div>
              </details>
            ))}
          </fieldset>

          <div className="pt-4 border-t border-luxury-rosegold/10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <input type="file" accept="image/*" id="hero-settings-upload" onChange={handleHeroUpload} className="hidden" />
            <label htmlFor="hero-settings-upload" className="px-5 py-3 bg-luxury-wine/10 hover:bg-luxury-wine/25 cursor-pointer border border-luxury-rosegold/20 text-luxury-champagne text-xs flex items-center justify-center gap-2 hover:border-luxury-rosegold/50 transition-all rounded-none">
              <Upload size={13} className="text-luxury-rosegold" />
              {uploading ? 'Uploading Hero Image...' : 'Upload Hero Image'}
            </label>
            <button
              type="submit"
              disabled={saving || uploading}
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
      <PasswordSettings authHeaders={authHeaders} onAdminTokenUpdated={onAdminTokenUpdated} />
    </div>
  );
};

const emptyPasswords = { current: '', next: '', confirm: '' };

const PasswordSettings = ({ authHeaders, onAdminTokenUpdated }) => {
  const [passwords, setPasswords] = useState(emptyPasswords);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const savePassword = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (passwords.next !== passwords.confirm) {
      setError('The new passwords must match.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch('/api/auth/password', {
        currentPassword: passwords.current,
        newPassword: passwords.next
      }, { headers: authHeaders });
      onAdminTokenUpdated(data.token);
      setPasswords(emptyPasswords);
      setMessage('Password changed. Other admin sessions have expired.');
    } catch (error) {
      setError(error.response?.data?.error || 'The password could not be changed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={savePassword} className="glass-panel p-6 sm:p-8 space-y-4 max-w-2xl">
      <h3 className="font-serif text-xl tracking-widest text-white uppercase font-bold">Change admin password</h3>
      <p className="text-sm text-luxury-champagne">Use 12–128 characters for your new password.</p>
      <Input label="Current password" type="password" autoComplete="current-password" required maxLength={128} value={passwords.current} onChange={(current) => setPasswords(previous => ({ ...previous, current }))} />
      <Input label="New password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={passwords.next} onChange={(next) => setPasswords(previous => ({ ...previous, next }))} />
      <Input label="Confirm new password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={passwords.confirm} onChange={(confirm) => setPasswords(previous => ({ ...previous, confirm }))} />
      {error && <p role="alert" className="text-sm text-luxury-rosegold">{error}</p>}
      {message && <p role="status" className="text-sm text-green-400">{message}</p>}
      <button type="submit" disabled={saving} className="px-5 py-3 border border-luxury-rosegold/40 text-white hover:border-luxury-rosegold text-sm font-bold disabled:opacity-60">
        {saving ? 'Changing password…' : 'Change password'}
      </button>
    </form>
  );
};

const Input = ({ label, value, onChange, ...props }) => (
  <label className="flex flex-col gap-1 text-sm text-luxury-champagne/80 font-semibold">
    {label}
    <input
      type="text"
      value={value ?? ''}
      {...props}
      onChange={(event) => onChange(event.target.value)}
      className="px-4 py-2.5 bg-luxury-black border border-luxury-rosegold/10 text-white text-xs focus:border-luxury-rosegold focus:outline-none transition-all rounded-none"
    />
  </label>
);

export default React.memo(BrandSettings);
