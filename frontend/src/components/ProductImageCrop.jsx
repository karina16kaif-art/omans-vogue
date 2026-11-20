import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const center = { x: 0.5, y: 0.5 };
const clamp = (value) => Math.min(1, Math.max(0, value));
const cropSize = (image, zoom) => Math.min(image.naturalWidth, image.naturalHeight) / zoom;

function drawCrop(canvas, image, zoom, position) {
  const size = cropSize(image, zoom);
  const x = (image.naturalWidth - size) * position.x;
  const y = (image.naturalHeight - size) * position.y;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, x, y, size, size, 0, 0, canvas.width, canvas.height);
}

const encodeCrop = (canvas) => new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.92));

export default function ProductImageCrop({ file, remaining, uploading, onUpload, onSkip }) {
  const [image, setImage] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState(center);
  const [error, setError] = useState('');
  const preview = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const source = new Image();
    source.onload = () => setImage(source);
    source.onerror = () => setError('This image could not be opened. Skip it and try a JPG, PNG or WebP image.');
    source.src = url;
    return () => {
      source.onload = null;
      source.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useLayoutEffect(() => {
    if (image) drawCrop(preview.current, image, zoom, position);
  }, [image, zoom, position]);

  const startDrag = (event) => {
    if (uploading || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const reposition = (event) => {
    if (drag.current?.id !== event.pointerId || uploading) return;
    const { width } = event.currentTarget.getBoundingClientRect();
    const size = cropSize(image, zoom);
    const dx = (event.clientX - drag.current.x) * size / width;
    const dy = (event.clientY - drag.current.y) * size / width;
    const availableX = image.naturalWidth - size;
    const availableY = image.naturalHeight - size;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    setPosition(previous => ({
      x: availableX ? clamp(previous.x - dx / availableX) : previous.x,
      y: availableY ? clamp(previous.y - dy / availableY) : previous.y
    }));
  };

  const prepareCrop = async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = Math.max(1, Math.min(1200, Math.floor(cropSize(image, zoom))));
      drawCrop(canvas, image, zoom, position);
      const blob = await encodeCrop(canvas);
      if (!blob) throw new Error('Image encoding failed');
      const extension = blob.type === 'image/webp' ? 'webp' : 'png';
      return new File([blob], `product-crop.${extension}`, { type: blob.type });
    } catch {
      throw Object.assign(new Error('The crop could not be prepared. Adjust the image or choose another file.'), { name: 'CropError' });
    }
  };

  return (
    <section aria-label="Crop product image" className="w-full mt-4 space-y-3 border border-luxury-rosegold/25 p-3 text-sm text-luxury-champagne">
      <h4 className="font-semibold text-white">Crop product image</h4>
      <p className="break-all text-xs">{file.name}{remaining > 1 && ` · ${remaining} images left`}</p>
      {error && <p role="alert" className="text-luxury-rosegold">{error}</p>}
      {!image && !error && <p role="status">Opening image…</p>}
      {image && <>
        <canvas ref={preview} width="360" height="360" role="img" aria-label="Square crop preview"
          className="block w-full aspect-square touch-none cursor-grab active:cursor-grabbing bg-luxury-black"
          onPointerDown={startDrag} onPointerMove={reposition} onLostPointerCapture={() => { drag.current = null; }} />
        <p className="text-xs">Drag the preview or use the position sliders.</p>
        <label className="block">Zoom
          <input type="range" className="block w-full accent-luxury-rosegold" min="1" max="4" step="0.05" value={zoom}
            disabled={uploading} onChange={event => setZoom(Number(event.target.value))} />
        </label>
        {[['x', 'Horizontal position'], ['y', 'Vertical position']].map(([axis, label]) => (
          <label key={axis} className="block">{label}
            <input type="range" className="block w-full accent-luxury-rosegold" min="0" max="100" step="1"
              value={Math.round(position[axis] * 100)} disabled={uploading}
              onChange={event => setPosition(previous => ({ ...previous, [axis]: Number(event.target.value) / 100 }))} />
          </label>
        ))}
        <button type="button" disabled={uploading} className="text-xs underline" onClick={() => { setZoom(1); setPosition(center); }}>Reset crop</button>
      </>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={uploading} className="border border-luxury-rosegold/25 px-2 py-1" onClick={onSkip}>Skip image</button>
        <button type="button" disabled={uploading || !image} className="border border-luxury-gold/50 px-2 py-1 text-luxury-gold disabled:opacity-50"
          onClick={() => onUpload(prepareCrop)}>{uploading ? 'Uploading…' : 'Use square crop'}</button>
      </div>
    </section>
  );
}
