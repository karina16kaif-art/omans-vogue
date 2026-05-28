import axios from 'axios';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export const api = axios.create({
  baseURL: API_BASE_URL || undefined,
  timeout: 20000
});

export const getAssetUrl = (assetPath) => {
  if (!assetPath) return '';
  if (/^https?:\/\//i.test(assetPath) || assetPath.startsWith('data:')) {
    return assetPath;
  }
  if (assetPath.startsWith('/uploads') && API_BASE_URL) {
    return `${API_BASE_URL}${assetPath}`;
  }
  return assetPath;
};
