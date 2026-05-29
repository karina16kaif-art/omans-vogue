import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://omans-vogue.onrender.com';
const NORMALIZED_API_BASE_URL = API_BASE_URL.replace(/\/+$/, '');

export const api = axios.create({
  baseURL: NORMALIZED_API_BASE_URL,
  timeout: 20000
});

export const getAssetUrl = (assetPath) => {
  if (!assetPath) return '';
  if (/^https?:\/\//i.test(assetPath) || assetPath.startsWith('data:')) {
    return assetPath;
  }
  if (assetPath.startsWith('/uploads') && NORMALIZED_API_BASE_URL) {
    return `${NORMALIZED_API_BASE_URL}${assetPath}`;
  }
  return assetPath;
};

export const getWebPAssetUrl = (assetPath) => {
  if (!assetPath || /^https?:\/\//i.test(assetPath) || assetPath.startsWith('data:')) {
    return '';
  }
  if (assetPath.startsWith('/images/') && /\.(png|jpe?g)$/i.test(assetPath)) {
    return assetPath.replace(/\.(png|jpe?g)$/i, '.webp');
  }
  return '';
};

export { API_BASE_URL };
