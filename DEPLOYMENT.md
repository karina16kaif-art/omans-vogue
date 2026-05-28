# OMAN'S VOGUE Production Deployment Guide

This project uses:

- Netlify for the React frontend: `https://omansvogue.netlify.app`
- Render for the Express backend API
- Render persistent disk storage for `products.json` and uploaded product images

The luxury UI, animations, colors, layout, typography, and branding are frontend-only concerns and do not need to be changed for deployment.

## 1. Render Backend Deployment

1. Push this repository to GitHub.
2. In Render, create a new Blueprint from the repository, or create a Web Service manually.
3. If using the included `render.yaml`, Render will use:
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/api/health`
   - Persistent disk mount path: `/var/data`
4. Set these Render environment variables:

```env
NODE_ENV=production
CLIENT_ORIGIN=https://omansvogue.netlify.app
CORS_ORIGINS=https://omansvogue.netlify.app
ADMIN_USERNAME=concierge
ADMIN_PASSWORD=omans_secret_key_2026
JWT_SECRET=strong_secret_here
DATA_DIR=/var/data/data
UPLOADS_DIR=/var/data/uploads/products
```

Use a long random value for `JWT_SECRET` in production. The Blueprint can generate it automatically.

5. Confirm the backend deploy is healthy by opening:

```text
https://YOUR-RENDER-SERVICE.onrender.com/api/health
```

Expected response:

```json
{ "ok": true, "service": "omans-vogue-api", "environment": "production" }
```

## 2. Netlify Frontend Deployment

The frontend is already hosted at:

```text
https://omansvogue.netlify.app
```

For future Netlify deploys, use:

- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `frontend/dist` if deploying from repo root, or `dist` if Netlify base is `frontend`

The SPA fallback is already configured in:

```text
frontend/public/_redirects
```

with:

```text
/* /index.html 200
```

This keeps `/admin` working on refresh.

## 3. Connect Netlify To Render

In Netlify, add this environment variable:

```env
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

Do not include a trailing slash.

After setting it:

1. Trigger a new Netlify deploy.
2. Open `https://omansvogue.netlify.app`.
3. Confirm products load from Render.
4. Open `https://omansvogue.netlify.app/admin`.
5. Log in with the Render environment credentials.

## 4. Admin Dashboard Usage

Admin URL:

```text
https://omansvogue.netlify.app/admin
```

Login credentials come from Render environment variables:

```env
ADMIN_USERNAME=concierge
ADMIN_PASSWORD=omans_secret_key_2026
```

From the dashboard you can:

- Add products
- Upload real product images
- Preview product image/details before publishing
- Edit name, price, category, stock status, notes, and description
- Delete products
- Mark products in stock or out of stock

Supported categories:

- `Women's Collection`
- `Men's Collection`

## 5. Uploaded Images

Uploaded files are saved on Render under:

```text
/var/data/uploads/products
```

The API exposes them at:

```text
https://YOUR-RENDER-SERVICE.onrender.com/uploads/products/FILENAME
```

The frontend automatically converts backend upload paths like `/uploads/products/file.png` into the full Render URL using `VITE_API_URL`, so uploaded images display correctly on the live Netlify site.

## 6. Product Data

Products are stored at:

```text
/var/data/data/products.json
```

On first Render boot, if the persistent disk is empty, the server seeds this file from:

```text
backend/data/products.json
```

This keeps the existing catalog available after deployment.

## 7. Production Checks

After both services deploy:

1. Visit `https://YOUR-RENDER-SERVICE.onrender.com/api/products`.
2. Visit `https://omansvogue.netlify.app`.
3. Visit `https://omansvogue.netlify.app/admin`.
4. Log in.
5. Upload a test product image.
6. Add a product.
7. Confirm it appears on the public homepage.
8. Edit price/description/stock.
9. Confirm the public homepage updates after refresh.
10. Delete the test product.

## 8. Important Notes

- Render must have a persistent disk for permanent JSON storage and uploaded product images.
- If `VITE_API_URL` is not set on Netlify, the frontend will try same-origin `/api` requests and the live admin dashboard will not reach Render.
- If `CORS_ORIGINS` does not include `https://omansvogue.netlify.app`, browser requests from Netlify will be blocked.
- If `JWT_SECRET` changes, existing admin sessions will be invalidated and the admin must log in again.
