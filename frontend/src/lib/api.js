const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://omans-vogue.onrender.com';
const NORMALIZED_API_BASE_URL = API_BASE_URL.replace(/\/+$/, '');

async function request(method, path, body, { headers, params, signal } = {}) {
  const url = new URL(`${NORMALIZED_API_BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of new URLSearchParams(params)) url.searchParams.append(key, value);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, body instanceof FormData ? 90000 : 20000);
  const multipart = body instanceof FormData;
  const requestHeaders = new Headers(headers);
  if (multipart) requestHeaders.delete('Content-Type');
  else if (body !== undefined) requestHeaders.set('Content-Type', 'application/json');
  try {
    const response = await fetch(url, {
      method, headers: requestHeaders, signal: controller.signal,
      body: multipart ? body : JSON.stringify(body)
    });
    const data = response.headers.get('Content-Type')?.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw Object.assign(new Error(data?.error || `Request failed (${response.status}).`), {
      response: { data, status: response.status }
    });
    return { data, status: response.status };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export const api = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body, options) => request('POST', path, body, options),
  patch: (path, body, options) => request('PATCH', path, body, options),
  delete: (path, options) => request('DELETE', path, undefined, options)
};

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
