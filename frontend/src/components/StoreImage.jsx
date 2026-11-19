import React, { useState } from 'react';
import { getAssetUrl, getWebPAssetUrl } from '../lib/api';

function cloudinarySource(image, width) {
  // Signed, private, and already-transformed URLs retain their original access and format.
  const match = /^(https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\/)(v\d+\/[^?#]+)$/.exec(image);
  return match ? `${match[1]}c_limit,w_${width}/q_auto/f_auto/${match[2]}` : '';
}

export default function StoreImage({ image, webp, mobileWebp, widths, sizes, alt = '', className, eager = false }) {
  const [failedSource, setFailedSource] = useState('');
  const source = getAssetUrl(image);
  const transformed = source !== failedSource && widths?.map(width => cloudinarySource(source, width));
  const useResponsive = transformed?.[0];
  const modern = !useResponsive && source !== failedSource && (webp || getWebPAssetUrl(image));
  return (
    <picture className="block w-full h-full">
      {modern && mobileWebp && <source media="(max-width: 639px)" srcSet={mobileWebp} type="image/webp" />}
      {modern && <source srcSet={getAssetUrl(modern)} type="image/webp" />}
      <img src={useResponsive ? transformed.at(-1) : source}
        srcSet={useResponsive ? transformed.map((url, index) => `${url} ${widths[index]}w`).join(', ') : undefined}
        sizes={useResponsive ? sizes : undefined} alt={alt} className={className}
        loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined}
        decoding="async" onError={() => setFailedSource(source)} />
    </picture>
  );
}
