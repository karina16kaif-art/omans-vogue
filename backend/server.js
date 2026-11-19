require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
const createAdminAuth = require('./admin-auth');
const { productPayload, publicProduct, productAvailable, normalizeStorefront, fallbackImage, collectionIds } = require('./catalogue');
const {
  campus, cleanText, toE164, toGhanaPhone, toPesewas, formatCurrency,
  hash, checkoutError, parseItems, parseOrder, buildQuote, buildWhatsAppMessage
} = require('./checkout');
let nodemailer = null;

try {
  nodemailer = require('nodemailer');
} catch (error) {
  nodemailer = null;
}

const app = express();
const PORT = process.env.PORT || 5001;
const isProduction = process.env.NODE_ENV === 'production';
const checkoutEnabled = isProduction
  ? process.env.CHECKOUT_ENABLED === 'true'
  : process.env.CHECKOUT_ENABLED !== 'false';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'concierge';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? '' : crypto.randomBytes(32).toString('hex'));
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'https://omansvogue.netlify.app';
const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || '';
const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
const ADMIN_WHATSAPP_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER || '';
const WHATSAPP_ALERT_WEBHOOK_URL = process.env.WHATSAPP_ALERT_WEBHOOK_URL || '';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || [
  CLIENT_ORIGIN,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173'
].join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

if (isProduction && (JWT_SECRET.length < 32)) {
  throw new Error('Set a JWT_SECRET of at least 32 characters in production.');
}

// Reject the previously bundled password without embedding it in the release.
const legacyAdminPasswordDigest = 'b413cda0432fe4c657f6e08a8a86dd6c8bc2dbdd684c3a961b1014e2426cdd29';
const bootstrapPassword = isProduction && (ADMIN_PASSWORD.length < 12 ||
  crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex') === legacyAdminPasswordDigest)
  ? ''
  : ADMIN_PASSWORD;

const route = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);

// Middlewares
app.disable('x-powered-by');
app.set('trust proxy', 1);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Paths
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const LEGACY_SETTINGS_FILE = path.join(DATA_DIR, 'brand-settings.json');
const BUNDLED_DATA_FILE = path.join(__dirname, 'data', 'products.json');
const UPLOADS_ROOT = path.join(__dirname, 'public', 'uploads');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'public', 'uploads', 'products');
const BRAND_UPLOADS_DIR = process.env.BRAND_UPLOADS_DIR || path.join(__dirname, 'public', 'uploads', 'brand');

const DEFAULT_BRAND_SETTINGS = {
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
  pickupLocation: `Jean Nelson Hostel, ${campus}`,
  campusDeliveryFee: 10
};

const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_SERVER_KEY);
const isCloudinaryConfigured = () => Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
const SUPABASE_MIGRATION = 'supabase/migrations/202611180001_manual_momo_checkout.sql';

const supabaseSetupErrorResponse = (error) => ({
  error: 'Supabase setup error',
  message: error?.message || 'Supabase request failed. Confirm tables exist and the service role key is valid.',
  details: error?.details || null,
  migration: SUPABASE_MIGRATION
});

const logSupabaseError = (label, error) => {
  console.error(`[Oman’s Vogue Server] ${label}`, {
    message: error?.message,
    status: error?.status,
    details: error?.details,
    stack: error?.stack
  });
};

// Ensure directories exist
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const readJsonFile = (filePath, fallbackValue) => {
  try {
    if (!fs.existsSync(filePath)) {
      return fallbackValue;
    }
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) {
      return fallbackValue;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.error(`[Oman’s Vogue Server] Failed to read JSON: ${filePath}`, error);
    return fallbackValue;
  }
};

const writeJsonFile = (filePath, value) => {
  try {
    ensureDir(path.dirname(filePath));
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (error) {
    console.error(`[Oman’s Vogue Server] Failed to write JSON: ${filePath}`, error);
    return false;
  }
};

const supabaseRequest = async (resource, options = {}) => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${resource}`, {
    signal: AbortSignal.timeout(12000),
    ...options,
    headers: {
      apikey: SUPABASE_SERVER_KEY,
      ...(SUPABASE_SERVER_KEY.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${SUPABASE_SERVER_KEY}` }),
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || data?.error || `Supabase request failed: ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
};

const { authenticateAdmin, login, changePassword } = createAdminAuth({
  username: ADMIN_USERNAME,
  bootstrapPassword,
  secret: JWT_SECRET,
  dataDir: DATA_DIR,
  isSupabaseConfigured,
  supabaseRequest
});

const assertSupabaseTablesReady = async () => {
  await supabaseRequest('brand_settings?select=id,hero_background_image,hero_background_webp&limit=1');
};

const PRODUCT_PROJECTION = 'select=*,product_id_text:id::text';
const productIdValue = (id) => Number.isSafeInteger(Number(id)) ? Number(id) : String(id);
const parseProductId = (id) => {
  const value = String(id ?? '');
  return /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n ? value : null;
};
const optionalNumeric = (value) => value == null ? null : Number(value);

const mapProductFromDb = (row) => {
  const image = row.image_url || row.image || fallbackImage(row.category);
  const images = Array.isArray(row.images) && row.images.length ? row.images : [image];
  return {
    id: productIdValue(row.product_id_text ?? row.id), name: row.name, category: row.category,
    price: Number(row.price || 0), enabled: row.in_stock !== false,
    description: row.description || row.detailed_description || '', notes: row.notes || '',
    image: images[0], images, brand: row.brand || '', collections: row.collections ?? null,
    sizeMl: optionalNumeric(row.size_ml), stockQuantity: optionalNumeric(row.stock_quantity),
    salePrice: optionalNumeric(row.sale_price), variants: Array.isArray(row.variants) ? row.variants : [],
    featured: row.featured === true, newArrival: row.new_arrival === true,
    published: row.published !== false, bestsellerFeatured: row.bestseller_featured === true,
    createdAt: row.created_at, catalogVersion: String(row.catalog_version ?? 0), archivedAt: row.archived_at
  };
};

const mapProductToDb = (product) => ({
  name: product.name, category: product.category, price: product.price,
  in_stock: product.enabled, stock_status: productAvailable(product) ? 'in_stock' : 'out_of_stock',
  description: product.description, notes: product.notes,
  image: product.image, image_url: product.image, images: product.images,
  brand: product.brand, collections: product.collections, size_ml: product.sizeMl,
  stock: product.stockQuantity, stock_quantity: product.stockQuantity, sale_price: product.salePrice, variants: product.variants,
  featured: product.featured, new_arrival: product.newArrival,
  published: product.published, bestseller_featured: product.bestsellerFeatured, updated_at: new Date().toISOString()
});

const localProduct = (product) => ({
  ...product, enabled: product.enabled ?? product.inStock !== false,
  images: product.images?.length ? product.images : (product.image ? [product.image] : []),
  catalogVersion: String(product.catalogVersion ?? 0)
});

// Cast the ID in PostgreSQL before JSON parsing to preserve the full bigint range.
const ORDER_PROJECTION = 'select=*,order_id_text:id::text';

const mapOrderFromDb = (row) => ({
  id: row.order_id_text,
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
  customerEmail: row.customer_email,
  deliveryPhone: row.delivery_phone,
  deliveryAddress: row.delivery_address,
  cityRegion: row.city_region,
  items: Array.isArray(row.items) ? row.items : [],
  totalAmount: Number(row.total ?? row.total_amount ?? 0),
  paymentMethod: row.payment_method,
  paymentStatus: row.admin_payment_verified_at ? 'Paid' : unverifiedPaymentStatus(row),
  paymentVerifiedAt: row.admin_payment_verified_at,
  fulfilmentMethod: row.fulfilment_method,
  pickupLocation: row.pickup_location,
  deliveryFee: row.delivery_fee == null ? null : Number(row.delivery_fee),
  momoPhone: row.momo_phone,
  paymentReference: row.payment_reference,
  orderStatus: orderStatus(
    !row.checkout_request_id && orderStatus(row.status) === 'Pending'
      ? row.order_status ?? row.status
      : row.status ?? row.order_status
  ),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapOrderToDb = (order) => ({
  customer_name: order.customerName,
  ...(order.customerEmail ? { customer_email: order.customerEmail } : {}),
  customer_phone: order.customerPhone,
  delivery_phone: order.deliveryPhone,
  delivery_address: order.deliveryAddress,
  city_region: order.cityRegion,
  items: Array.isArray(order.items) ? order.items : [],
  total: order.totalAmount,
  total_amount: order.totalAmount,
  order_status: 'Pending',
  payment_method: order.paymentMethod,
  fulfilment_method: order.fulfilmentMethod,
  ...(order.pickupLocation ? { pickup_location: order.pickupLocation } : {}),
  delivery_fee: order.deliveryFee,
  momo_phone: order.momoPhone,
  payment_reference: order.paymentReference,
  checkout_request_id: order.requestId,
  checkout_request_hash: order.requestHash,
  whatsapp_number: order.whatsappNumber,
  created_at: order.createdAt,
  updated_at: order.updatedAt
});

const mapSettingsFromDb = (row) => Object.fromEntries(
  Object.entries({
    brandName: row.brand_name || row.hero_title,
    heroEyebrow: row.hero_eyebrow,
    heroHeadlinePrefix: row.hero_headline_prefix || row.hero_prefix,
    heroSubtitle: row.hero_subtitle,
    heroBackgroundImage: row.hero_background_image || row.hero_background_url,
    heroBackgroundWebp: row.hero_background_webp,
    whatsappNumber: row.whatsapp_number,
    momoNumber: row.momo_number,
    momoAccountName: row.momo_account_name,
    momoPaymentInstructions: row.momo_payment_instructions,
    pickupLocation: row.pickup_location,
    campusDeliveryFee: optionalNumeric(row.campus_delivery_fee ?? row.delivery_fee),
    storefront: row.storefront,
    settingsRevision: row.settings_revision
  }).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

const mapSettingsToDb = (settings) => ({
  id: 1,
  brand_name: settings.brandName,
  hero_eyebrow: settings.heroEyebrow,
  hero_headline_prefix: settings.heroHeadlinePrefix,
  hero_subtitle: settings.heroSubtitle,
  hero_background_image: settings.heroBackgroundImage,
  hero_background_webp: settings.heroBackgroundWebp,
  whatsapp_number: settings.whatsappNumber,
  momo_number: settings.momoNumber,
  momo_account_name: settings.momoAccountName,
  momo_payment_instructions: settings.momoPaymentInstructions,
  pickup_location: settings.pickupLocation,
  delivery_fee: settings.campusDeliveryFee,
  storefront: settings.storefront,
  settings_revision: crypto.randomUUID(),
  updated_at: new Date().toISOString()
});

const uploadImageToCloudinary = async ({ filePath, folder, mimeType }) => {
  if (!isCloudinaryConfigured()) {
    return null;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signaturePayload = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');
  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filePath);

  formData.append('file', new Blob([fileBuffer], { type: mimeType || 'image/webp' }), path.basename(filePath));
  formData.append('api_key', CLOUDINARY_API_KEY);
  formData.append('timestamp', String(timestamp));
  formData.append('folder', folder);
  formData.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || 'Cloudinary upload failed');
  }

  return data.secure_url;
};

ensureDir(DATA_DIR);
ensureDir(UPLOADS_ROOT);
ensureDir(UPLOADS_DIR);
ensureDir(BRAND_UPLOADS_DIR);
if (!fs.existsSync(DATA_FILE)) {
  if (fs.existsSync(BUNDLED_DATA_FILE) && path.resolve(DATA_FILE) !== path.resolve(BUNDLED_DATA_FILE)) {
    fs.copyFileSync(BUNDLED_DATA_FILE, DATA_FILE);
  } else {
    writeJsonFile(DATA_FILE, []);
  }
}
if (!fs.existsSync(ORDERS_FILE)) {
  writeJsonFile(ORDERS_FILE, []);
}
if (!fs.existsSync(SETTINGS_FILE)) {
  const legacySettings = readJsonFile(LEGACY_SETTINGS_FILE, null);
  writeJsonFile(SETTINGS_FILE, legacySettings && typeof legacySettings === 'object' ? {
    ...DEFAULT_BRAND_SETTINGS,
    ...legacySettings
  } : DEFAULT_BRAND_SETTINGS);
}

// Serve public static assets
app.use('/uploads/products', express.static(UPLOADS_DIR, {
  maxAge: '30d',
  immutable: true
}));
app.use('/uploads/brand', express.static(BRAND_UPLOADS_DIR, {
  maxAge: '30d',
  immutable: true
}));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d'
}));

// Configure Multer for local product image uploads
const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif', 'image/tiff']);
const imageUpload = (prefix, megabytes) => multer({
  storage: multer.diskStorage({
    destination: tmpdir(),
    filename: (req, file, cb) => cb(null, `${prefix}-${crypto.randomUUID()}`)
  }),
  limits: { fileSize: megabytes * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!supportedImageTypes.has(file.mimetype)) return cb(new Error('Choose a supported product photo.'));
    cb(null, true);
  }
});
const upload = imageUpload('product', 8);
const brandUpload = imageUpload('hero', 10);

const optimizeUpload = async (file, output, width, height, quality) => {
  try {
    await sharp(file.path, { limitInputPixels: 40_000_000 }).rotate()
      .resize({ width, height, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toFile(output);
  } catch {
    fs.unlink(output, () => {});
    throw checkoutError(400, 'Choose a valid, supported image under 40 megapixels.');
  } finally {
    fs.unlink(file.path, () => {});
  }
};

const readLocalProducts = () => {
  const products = readJsonFile(DATA_FILE, []);
  return Array.isArray(products) ? products.map(localProduct) : [];
};

const getProducts = async ({ publishedOnly = false } = {}) => {
  if (!isSupabaseConfigured()) return readLocalProducts().filter(product => !product.archivedAt && (!publishedOnly || product.published !== false));

  const products = [];
  let cursor;
  do {
    const filter = cursor ? `&id=gt.${cursor}` : '';
    const visibility = publishedOnly ? '&published=eq.true' : '';
    const rows = await supabaseRequest(`products?${PRODUCT_PROJECTION}&archived_at=is.null&order=id.asc&limit=250${filter}${visibility}`);
    if (!rows.length) break;
    products.push(...rows.map(mapProductFromDb));
    cursor = rows[rows.length - 1].product_id_text;
  } while (true);
  return products;
};

const readAdminProductPage = async (query) => {
  const limit = Number(query.limit);
  const offset = Number(query.offset ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 48 || !Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) {
    throw checkoutError(400, 'Invalid product page.');
  }
  const search = cleanText(query.search).slice(0, 80);
  let rows;
  if (isSupabaseConfigured()) {
    const params = new URLSearchParams({ archived_at: 'is.null', order: 'id.asc', offset, limit: limit + 1 });
    if (search) {
      const pattern = search.replace(/[\\%_*]/g, '\\$&').replace(/[\\"]/g, '\\$&');
      const value = `"%${pattern}%"`;
      params.set('or', `(name.ilike.${value},brand.ilike.${value})`);
    }
    rows = (await supabaseRequest(`products?${PRODUCT_PROJECTION}&${params}`)).map(mapProductFromDb);
  } else {
    const term = search.toLowerCase();
    rows = readLocalProducts().filter(product => !product.archivedAt &&
      [product.name, product.brand].some(value => String(value ?? '').toLowerCase().includes(term)))
      .slice(offset, offset + limit + 1);
  }
  return { products: rows.slice(0, limit).map(product => publicProduct(product, true)), hasMore: rows.length > limit };
};

const normalizeCategory = (category) => {
  if (category === "Women's Collection") return 'Women';
  if (category === "Men's Collection") return 'Men';
  if (category === 'Women' || category === 'Men') return category;
  return '';
};

const ORDER_STATUSES = ['Pending', 'Processing', 'Delivered', 'Cancelled'];
const LEGACY_ORDER_STATUSES = ['New', 'Out for Delivery'];
const ACCEPTED_ORDER_STATUSES = [...ORDER_STATUSES, ...LEGACY_ORDER_STATUSES];
const isConfirmedPaid = (order) => order.paymentStatus === 'Paid' && Boolean(order.paymentVerifiedAt);

const unverifiedPaymentStatus = (row) => {
  if (row.checkout_request_id) return 'Pending';
  const status = cleanText(row.payment_status ?? row.status).toLowerCase();
  return ['Paid', 'Failed', 'Cancelled'].find(value => value.toLowerCase() === status) || 'Pending';
};

const getOrders = async () => {
  if (!isSupabaseConfigured()) {
    const orders = readJsonFile(ORDERS_FILE, []);
    return Array.isArray(orders) ? orders : [];
  }

  // PostgREST may cap rows per response. A unique cursor visits every page.
  const orders = [];
  let cursor;
  do {
    const query = new URLSearchParams({ order: 'id.asc', limit: '500' });
    if (cursor !== undefined) query.set('id', `gt.${cursor}`);
    const rows = await supabaseRequest(`orders?${ORDER_PROJECTION}&${query}`);
    if (!rows.length) break;
    orders.push(...rows.map(mapOrderFromDb));
    cursor = rows[rows.length - 1].order_id_text;
  } while (true);
  return orders.sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
};

const readSupabaseBrandSettings = async () => {
  const rows = await supabaseRequest('brand_settings?select=*&id=eq.1&limit=1');
  return rows[0] ? mapSettingsFromDb(rows[0]) : null;
};

const getBrandSettings = async ({ strict = false } = {}) => {
  if (isSupabaseConfigured()) {
    try {
      const settings = await readSupabaseBrandSettings();
      if (settings) return { ...DEFAULT_BRAND_SETTINGS, ...settings };

      if (strict) throw new Error('The storefront settings row is missing.');
      await saveBrandSettings(DEFAULT_BRAND_SETTINGS);
      return { ...DEFAULT_BRAND_SETTINGS };
    } catch (error) {
      if (strict) throw error;
      logSupabaseError('Supabase settings read failed, using JSON fallback:', error);
    }
  }

  const parsed = readJsonFile(SETTINGS_FILE, DEFAULT_BRAND_SETTINGS);
  return { ...DEFAULT_BRAND_SETTINGS, ...(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) };
};

const saveBrandSettings = async (settings, revision) => {
  if (isSupabaseConfigured()) {
    try {
      const values = mapSettingsToDb(settings);
      const filter = new URLSearchParams({ id: 'eq.1', settings_revision: `eq.${revision}` });
      const rows = await supabaseRequest(revision ? `brand_settings?${filter}` : 'brand_settings?on_conflict=id', {
        method: revision ? 'PATCH' : 'POST',
        headers: { Prefer: revision ? 'return=representation' : 'resolution=merge-duplicates' },
        body: JSON.stringify(values)
      });
      if (revision && !rows?.length) throw checkoutError(409, 'Store settings changed. Refresh them before saving again.');
      return true;
    } catch (error) {
      if (error.checkoutStatus) throw error;
      logSupabaseError('Supabase settings save failed:', error);
      return false;
    }
  }

  return writeJsonFile(SETTINGS_FILE, { ...await getBrandSettings(), ...settings });
};

const normalizeBrandPayload = (body, storefront) => {
  const updates = {};
  for (const key of [
    'brandName', 'heroEyebrow', 'heroHeadlinePrefix', 'heroSubtitle', 'heroBackgroundImage', 'heroBackgroundWebp'
  ]) {
    if (body[key] !== undefined) {
      const value = typeof body[key] === 'string' ? body[key].trim() : '';
      if ((key === 'heroBackgroundImage' || key === 'heroBackgroundWebp') && /^blob:/i.test(value)) continue;
      updates[key] = value || DEFAULT_BRAND_SETTINGS[key];
    }
  }

  if (body.whatsappNumber !== undefined) {
    const number = toE164(body.whatsappNumber);
    if (!number) throw checkoutError(400, 'Enter a valid WhatsApp order number with its country code.');
    updates.whatsappNumber = number;
  }
  if (body.momoNumber !== undefined) {
    const number = toGhanaPhone(body.momoNumber);
    if (body.momoNumber !== '' && !number) throw checkoutError(400, 'Enter a valid Ghanaian MoMo number.');
    updates.momoNumber = number;
  }
  if (body.momoAccountName !== undefined) {
    const name = cleanText(body.momoAccountName);
    if (name.length > 120) throw checkoutError(400, 'Use up to 120 characters for the MoMo account name.');
    updates.momoAccountName = name;
  }
  if (body.momoPaymentInstructions !== undefined) {
    const instructions = body.momoPaymentInstructions;
    if (typeof instructions !== 'string' || instructions.trim().length > 500) {
      throw checkoutError(400, 'Use up to 500 characters of text for MoMo payment instructions.');
    }
    updates.momoPaymentInstructions = instructions.trim();
  }
  if (body.pickupLocation !== undefined) {
    const location = cleanText(body.pickupLocation);
    if (!location || location.length > 180) throw checkoutError(400, 'Enter a pickup location of up to 180 characters.');
    updates.pickupLocation = location;
  }
  if (body.campusDeliveryFee !== undefined) {
    const fee = String(body.campusDeliveryFee);
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(fee)) {
      throw checkoutError(400, 'Enter a campus delivery fee of zero or more, with up to two decimal places.');
    }
    updates.campusDeliveryFee = Number(fee);
  }

  if (body.storefront !== undefined) updates.storefront = normalizeStorefront(body.storefront, storefront);

  return updates;
};

const buildOrderNotificationText = (order) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const lines = [
    `New OMAN'S VOGUE order: ${order.id}`,
    `Customer: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
    `Fulfilment: ${order.fulfilmentMethod}`,
    order.fulfilmentMethod === 'pickup'
      ? `Pickup: ${order.pickupLocation}`
      : `Delivery: ${order.deliveryAddress}`,
    `Total: ${formatCurrency(order.totalAmount)}`,
    `Payment: ${order.paymentMethod} (${order.paymentStatus})`,
    `Status: ${order.orderStatus}`,
    'Items:',
    ...items.map(item => `- ${item.quantity}x ${item.name} (${item.category}) @ ${formatCurrency(item.unitPrice)}`)
  ];
  return lines.join('\n');
};

const sendGmailOrderNotification = async (order) => {
  if (!nodemailer || !GMAIL_USER || !GMAIL_APP_PASSWORD || !ADMIN_NOTIFICATION_EMAIL) {
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD
    }
  });

  await transporter.sendMail({
    from: `"OMAN'S VOGUE Orders" <${GMAIL_USER}>`,
    to: ADMIN_NOTIFICATION_EMAIL,
    subject: `New OMAN'S VOGUE Order ${order.id}`,
    text: buildOrderNotificationText(order)
  });
};

const sendWhatsAppOrderNotification = async (order) => {
  if (!WHATSAPP_ALERT_WEBHOOK_URL) {
    return;
  }

  const { momoPhone, paymentReference, customerEmail, ...alertOrder } = order;
  await fetch(WHATSAPP_ALERT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: ADMIN_WHATSAPP_NUMBER,
      orderId: order.id,
      message: buildOrderNotificationText(order),
      order: alertOrder
    })
  });
};

const notifyAdminNewOrder = (order) => {
  Promise.allSettled([
    sendGmailOrderNotification(order),
    sendWhatsAppOrderNotification(order)
  ]).then((results) => {
    results.forEach((result) => {
      if (result.status === 'rejected') {
        console.warn('[Oman’s Vogue Server] Order notification failed:', result.reason?.message || result.reason);
      }
    });
  });
};

const orderStatus = (status) => {
  const normalized = cleanText(status).toLowerCase().replace(/[-_]/g, ' ');
  if (normalized === 'out for delivery') return 'Processing';
  if (normalized === 'canceled') return 'Cancelled';
  return ORDER_STATUSES.find(value => value.toLowerCase() === normalized) || 'Pending';
};

const statusForDb = (status, current) => {
  if (current && current === current.toUpperCase()) return status.toUpperCase();
  if (!current || current === current.toLowerCase()) return status.toLowerCase();
  return status;
};

const dateRanges = (now = new Date()) => ({
  startOfToday: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
  startOfMonth: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
});

const buildOrderAnalytics = (orders, products) => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const { startOfToday, startOfMonth } = dateRanges(now);
  const paidOrders = orders.filter(isConfirmedPaid);
  const revenue = (list) => list.reduce((sum, order) => sum + toPesewas(order.totalAmount), 0) / 100;
  const productSales = new Map();
  const categorySales = { Men: 0, Women: 0 };
  const monthlyRevenue = Array.from({ length: 12 }, (_, index) => ({
    month: new Date(Date.UTC(year, index, 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' }),
    revenue: 0,
    orders: 0
  }));
  const ordersByStatus = Object.fromEntries(ORDER_STATUSES.map(status => [status, 0]));

  for (const order of orders) {
    const created = new Date(order.createdAt);
    if (created.getUTCFullYear() === year) monthlyRevenue[created.getUTCMonth()].orders += 1;
    ordersByStatus[orderStatus(order.orderStatus)] += 1;
  }

  for (const order of paidOrders) {
    const verified = new Date(order.paymentVerifiedAt);
    if (verified.getUTCFullYear() === year) {
      monthlyRevenue[verified.getUTCMonth()].revenue += toPesewas(order.totalAmount);
    }

    for (const item of order.items || []) {
      const quantity = Number(item?.quantity);
      const price = toPesewas(item?.unitPrice ?? item?.price ?? 0);
      if (!Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isSafeInteger(price) || price < 0) continue;
      const sales = price * quantity;
      const productId = item.productId ?? item.id ?? null;
      const key = productId == null ? `name:${item.name}` : `id:${productId}`;
      const current = productSales.get(key) || { key, productId, name: item.name, quantity: 0, revenue: 0 };
      current.quantity += quantity;
      current.revenue += sales;
      productSales.set(key, current);

      const category = normalizeCategory(item.category);
      if (category) categorySales[category] += sales;
    }
  }

  const productPerformance = [...productSales.values()].sort((a, b) => b.quantity - a.quantity)
    .map(product => ({ ...product, revenue: product.revenue / 100 }));
  const bestSellingProducts = productPerformance.slice(0, 5);
  return {
    totalOrders: orders.length,
    ordersToday: orders.filter(order => new Date(order.createdAt) >= startOfToday).length,
    ordersThisMonth: orders.filter(order => new Date(order.createdAt) >= startOfMonth).length,
    totalRevenue: revenue(paidOrders),
    revenueToday: revenue(paidOrders.filter(order => new Date(order.paymentVerifiedAt) >= startOfToday)),
    revenueThisMonth: revenue(paidOrders.filter(order => new Date(order.paymentVerifiedAt) >= startOfMonth)),
    pendingOrders: ordersByStatus.Pending,
    pendingPayments: orders.filter(order => !isConfirmedPaid(order) && orderStatus(order.orderStatus) !== 'Cancelled' &&
      ['Pending', 'Paid'].includes(order.paymentStatus)).length,
    paidOrders: paidOrders.length,
    deliveredOrders: ordersByStatus.Delivered,
    cancelledOrders: ordersByStatus.Cancelled,
    bestSellingPerfume: bestSellingProducts[0] || null,
    bestSellingProducts,
    productPerformance,
    lowStockCount: products.filter(product => !productAvailable(product)).length,
    monthlySales: monthlyRevenue.map(month => ({ ...month, revenue: month.revenue / 100 })),
    ordersByStatus,
    collectionSales: { Men: categorySales.Men / 100, Women: categorySales.Women / 100 }
  };
};

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'omans-vogue-api',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// API: Public brand settings
app.get(['/api/brand-settings', '/api/settings'], async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { momoNumber, momoAccountName, momoPaymentInstructions, settingsRevision, ...publicSettings } = await getBrandSettings();
  res.json(publicSettings);
});

app.get('/api/admin/settings', authenticateAdmin, route(async (req, res) => {
  res.json(await getBrandSettings({ strict: true }));
}));

// API: Update brand settings
const updateBrandSettings = route(async (req, res) => {
  const revision = req.body?.settingsRevision;
  if (revision != null && (typeof revision !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(revision))) {
    throw checkoutError(400, 'Invalid settings revision.');
  }
  const stored = req.body?.storefront === undefined ? undefined : (await getBrandSettings({ strict: true })).storefront;
  const updates = normalizeBrandPayload(req.body || {}, stored);
  if (!await saveBrandSettings(updates, revision)) {
    return res.status(500).json({ error: 'Failed to save brand settings' });
  }
  res.json(await getBrandSettings());
});

app.patch(['/api/brand-settings', '/api/settings'], authenticateAdmin, updateBrandSettings);
app.post(['/api/brand-settings', '/api/settings'], authenticateAdmin, updateBrandSettings);

// API: Upload hero background image
app.post(['/api/brand-settings/hero', '/api/settings/hero'], authenticateAdmin, async (req, res) => {
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({
      error: 'Cloudinary is not configured',
      message: 'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on Render before uploading hero images.'
    });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      error: 'Supabase is not configured',
      message: 'Set SUPABASE_URL and a backend Supabase key on Render before uploading hero images.',
      migration: SUPABASE_MIGRATION
    });
  }

  try {
    await assertSupabaseTablesReady();
  } catch (setupError) {
    console.error('[Oman’s Vogue Server] Supabase setup check failed for hero upload:', setupError.details || setupError.message);
    return res.status(424).json(supabaseSetupErrorResponse(setupError));
  }

  brandUpload.single('image')(req, res, async (err) => {
    if (err) {
      console.error('[Oman’s Vogue Server] Hero multer upload failed:', err);
      return res.status(400).json({ error: err.message || 'Hero image upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const savedFilename = `${req.file.filename}.webp`;
    const uploadPath = path.join(BRAND_UPLOADS_DIR, savedFilename);
    try {
      await optimizeUpload(req.file, uploadPath, 2200, 1400, 84);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    let imageUrl = '';

    try {
      const cloudinaryUrl = await uploadImageToCloudinary({
        filePath: uploadPath,
        folder: 'omans-vogue/brand',
        mimeType: 'image/webp'
      });
      imageUrl = cloudinaryUrl;
      fs.unlink(uploadPath, () => {});
    } catch (cloudinaryError) {
      fs.unlink(uploadPath, () => {});
      console.error('[Oman’s Vogue Server] Cloudinary hero upload failed:', {
        message: cloudinaryError.message,
        cloudNameConfigured: Boolean(CLOUDINARY_CLOUD_NAME),
        apiKeyConfigured: Boolean(CLOUDINARY_API_KEY),
        apiSecretConfigured: Boolean(CLOUDINARY_API_SECRET),
        file: savedFilename
      });
      return res.status(502).json({
        error: 'Cloudinary hero image upload failed',
        message: cloudinaryError.message || 'Cloudinary rejected the hero image upload. Check Cloudinary credentials on Render.'
      });
    }

    try {
      const currentSettings = await getBrandSettings({ strict: true });
      if (!await saveBrandSettings({ heroBackgroundImage: imageUrl, heroBackgroundWebp: imageUrl }, currentSettings.settingsRevision)) {
        return res.status(424).json({
          error: 'Hero image uploaded, but Supabase settings save failed',
          message: 'Cloudinary upload succeeded, but brand_settings could not be updated. Confirm the brand_settings table exists and service role key is valid.',
          imageUrl,
          migration: SUPABASE_MIGRATION
        });
      }

      return res.json({ imageUrl, settings: await getBrandSettings() });
    } catch (settingsError) {
      if (settingsError.checkoutStatus) return res.status(settingsError.checkoutStatus).json({ error: settingsError.message });
      console.error('[Oman’s Vogue Server] Hero settings save crashed:', settingsError.details || settingsError.message, settingsError);
      return res.status(424).json({
        ...supabaseSetupErrorResponse(settingsError),
        imageUrl
      });
    }
  });
});

// API: Admin Authentication (Login)
app.post('/api/auth/login', login);
app.patch('/api/auth/password', authenticateAdmin, changePassword);

app.get('/api/auth/verify', authenticateAdmin, (req, res) => {
  res.json({ valid: true, username: req.admin.username });
});

// Public catalogue and confirmed sales rankings.
app.get('/api/products', route(async (req, res) => {
  res.json((await getProducts({ publishedOnly: true })).map(product => publicProduct(product)));
}));

app.get('/api/admin/products', authenticateAdmin, route(async (req, res) => {
  if (req.query.limit !== undefined) return res.json(await readAdminProductPage(req.query));
  res.json((await getProducts()).map(product => publicProduct(product, true)));
}));

const readBestsellers = async () => {
  if (!isSupabaseConfigured()) return [];
  const ranks = await supabaseRequest('rpc/omans_confirmed_bestsellers');
  return ranks.map(row => ({ productId: row.product_id, units: Number(row.units) }));
};

app.get('/api/storefront/best-sellers', route(async (req, res) => {
  res.json(await readBestsellers());
}));

app.get('/api/storefront/catalogue', route(async (req, res) => {
  const [products, settings, bestSellers] = await Promise.all([
    getProducts({ publishedOnly: true }), getBrandSettings({ strict: true }), readBestsellers().catch(() => [])
  ]);
  const { momoNumber, momoAccountName, momoPaymentInstructions, settingsRevision, ...publicSettings } = settings;
  res.json({ products: products.map(product => publicProduct(product)), settings: publicSettings, bestSellers });
}));

const saveLocalCatalogue = (products) => {
  if (!writeJsonFile(DATA_FILE, products)) throw new Error('Failed to save products');
};

app.post('/api/products', authenticateAdmin, route(async (req, res) => {
  const body = req.body || {};
  const allowed = body.collections === undefined ? undefined : collectionIds((await getBrandSettings({ strict: true })).storefront);
  const product = productPayload(body, {}, allowed);
  if (isSupabaseConfigured()) {
    const [row] = await supabaseRequest(`products?${PRODUCT_PROJECTION}`, {
      method: 'POST',
      headers: { Prefer: 'return=representation,missing=default' },
      body: JSON.stringify(mapProductToDb(product))
    });
    return res.status(201).json(publicProduct(mapProductFromDb(row), true));
  }

  const products = readLocalProducts();
  const id = Math.max(0, ...products.map(product => Number(product.id))) + 1;
  const added = { ...product, id, createdAt: new Date().toISOString(), catalogVersion: '0' };
  saveLocalCatalogue([...products, added]);
  return res.status(201).json(publicProduct(added, true));
}));

const updateProduct = async (id, body, archive = false) => {
  const productId = parseProductId(id);
  if (!productId) return null;
  const stamp = new Date().toISOString();
  const allowed = body.collections === undefined ? undefined : collectionIds((await getBrandSettings({ strict: true })).storefront);
  const checkVersion = (current) => {
    if (body.catalogVersion !== undefined && String(body.catalogVersion) !== current.catalogVersion) {
      throw checkoutError(409, 'This product changed. Reopen it with the latest stock and try again.');
    }
  };

  if (isSupabaseConfigured()) {
    const resource = `products?${PRODUCT_PROJECTION}&id=eq.${productId}&archived_at=is.null`;
    const [existing] = await supabaseRequest(resource);
    if (!existing) return null;
    const current = mapProductFromDb(existing);
    checkVersion(current);
    let values = { archived_at: stamp, updated_at: stamp };
    if (!archive) {
      const previous = mapProductToDb(current);
      const next = mapProductToDb(productPayload(body, current, allowed));
      values = Object.fromEntries(Object.entries(next).filter(([key, value]) =>
        key === 'updated_at' || JSON.stringify(value) !== JSON.stringify(previous[key])
      ));
    }
    const [row] = await supabaseRequest(`${resource}&catalog_version=eq.${current.catalogVersion}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(values)
    });
    if (!row) throw checkoutError(409, 'This product changed. Refresh the catalogue and try again.');
    return mapProductFromDb(row);
  }

  const products = readLocalProducts();
  const index = products.findIndex(product => String(product.id) === productId && !product.archivedAt);
  if (index < 0) return null;
  const current = products[index];
  checkVersion(current);
  const updated = archive ? { ...current, archivedAt: stamp } : productPayload(body, current, allowed);
  updated.catalogVersion = String(BigInt(current.catalogVersion) + 1n);
  products[index] = updated;
  saveLocalCatalogue(products);
  return updated;
};

app.patch('/api/products/:id', authenticateAdmin, route(async (req, res) => {
  const product = await updateProduct(req.params.id, req.body || {});
  return product ? res.json(publicProduct(product, true)) : res.status(404).json({ error: 'Product not found.' });
}));

app.delete('/api/products/:id', authenticateAdmin, route(async (req, res) => {
  const product = await updateProduct(req.params.id, {}, true);
  return product ? res.json({ id: product.id }) : res.status(404).json({ error: 'Product not found.' });
}));

// API: Handle image upload
app.post('/api/upload', authenticateAdmin, (req, res) => {
  if (isProduction && !isCloudinaryConfigured()) {
    return res.status(503).json({ error: 'Image uploads are temporarily unavailable.' });
  }
  upload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Image upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const savedFilename = `${req.file.filename}.webp`;
    const uploadPath = path.join(UPLOADS_DIR, savedFilename);

    try {
      await optimizeUpload(req.file, uploadPath, 1400, 1400, 82);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    let fileUrl = `/uploads/products/${savedFilename}`;

    if (isCloudinaryConfigured()) {
      try {
        const cloudinaryUrl = await uploadImageToCloudinary({
          filePath: uploadPath,
          folder: 'omans-vogue/products',
          mimeType: 'image/webp'
        });
        if (cloudinaryUrl) {
          fileUrl = cloudinaryUrl;
          fs.unlink(uploadPath, () => {});
        }
      } catch (cloudinaryError) {
        fs.unlink(uploadPath, () => {});
        console.error('[Oman’s Vogue Server] Cloudinary product upload failed:', cloudinaryError.message);
        return res.status(502).json({ error: 'Cloudinary product image upload failed' });
      }
    }

    res.json({ imageUrl: fileUrl });
  });
});

const requireCheckoutStorage = () => {
  if (!isSupabaseConfigured()) {
    throw checkoutError(503, 'Checkout is temporarily unavailable. Please try again later.');
  }
};

const quoteCart = async (items) => {
  requireCheckoutStorage();
  if (!checkoutEnabled) throw checkoutError(503, 'Checkout is temporarily paused. Please try again later.');
  const productIds = [...new Set(items.map(item => item.productId))].join(',');
  const [settings, rows, customerEmailRequired] = await Promise.all([
    readSupabaseBrandSettings(),
    supabaseRequest(`products?${PRODUCT_PROJECTION}&archived_at=is.null&published=eq.true&id=in.(${productIds})`),
    supabaseRequest('rpc/omans_checkout_requires_email')
  ]);
  if (typeof customerEmailRequired !== 'boolean') throw new Error('Checkout email requirement is unavailable');
  return buildQuote(items, rows.map(mapProductFromDb), { ...settings, customerEmailRequired });
};

app.post('/api/checkout/quote', route(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await quoteCart(parseItems(req.body?.items)));
}));

const findCheckout = async (requestId) => {
  const rows = await supabaseRequest(`orders?${ORDER_PROJECTION}&checkout_request_id=eq.${requestId}&limit=1`);
  return rows[0];
};

const checkoutReceipt = (row, requestHash) => {
  if (row.checkout_request_hash !== requestHash) {
    throw checkoutError(409, 'This submission was already used for different order details.');
  }
  const order = mapOrderFromDb(row);
  const number = row.whatsapp_number.slice(1);
  return {
    orderId: order.id,
    whatsappUrl: `https://wa.me/${number}?text=${encodeURIComponent(buildWhatsAppMessage(order))}`
  };
};

app.post('/api/orders', route(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  requireCheckoutStorage();
  const submission = parseOrder(req.body || {});
  const requestHash = hash(submission);
  const existing = await findCheckout(submission.requestId);
  if (existing) return res.json(checkoutReceipt(existing, requestHash));

  const quote = await quoteCart(submission.items);
  if (quote.quoteKey !== submission.quoteKey) {
    throw checkoutError(409, 'Checkout details changed. Review the updated total and payment instructions before submitting.');
  }

  if (quote.customerEmailRequired && !submission.customerEmail) {
    throw checkoutError(400, 'Enter a valid contact email for your order.');
  }

  const delivery = submission.fulfilmentMethod === 'delivery';
  const deliveryFee = delivery ? quote.campusDeliveryFee : 0;
  const now = new Date().toISOString();
  const order = {
    customerName: submission.customerName,
    customerEmail: submission.customerEmail,
    customerPhone: submission.customerPhone,
    fulfilmentMethod: submission.fulfilmentMethod,
    pickupLocation: delivery ? null : quote.pickupLocation,
    deliveryPhone: delivery ? submission.customerPhone : '',
    deliveryAddress: delivery ? `${submission.campusDestination}, ${campus} · ${submission.addressDetails}` : '',
    cityRegion: delivery ? 'Legon' : '',
    deliveryFee,
    items: quote.items,
    totalAmount: (toPesewas(quote.subtotal) + toPesewas(deliveryFee)) / 100,
    momoPhone: submission.momoPhone,
    paymentReference: submission.paymentReference,
    paymentMethod: 'Mobile Money',
    whatsappNumber: quote.whatsappNumber,
    requestId: submission.requestId,
    requestHash,
    createdAt: now,
    updatedAt: now
  };

  let inserted;
  try {
    [inserted] = await supabaseRequest(`orders?${ORDER_PROJECTION}&on_conflict=checkout_request_id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation,missing=default' },
      body: JSON.stringify(mapOrderToDb(order))
    });
  } catch (error) {
    if (error.details?.code !== '23505' || !error.message.includes('omans_orders_momo_reference_key')) throw error;

    const saved = await findCheckout(submission.requestId);
    if (saved) return res.json(checkoutReceipt(saved, requestHash));
    throw checkoutError(409, 'An order already used this Mobile Money reference. Use your saved WhatsApp receipt or contact support before paying again.');
  }

  if (!inserted) {
    const saved = await findCheckout(submission.requestId);
    if (!saved) throw new Error('Order receipt unavailable after insert');
    return res.json(checkoutReceipt(saved, requestHash));
  }

  notifyAdminNewOrder(mapOrderFromDb(inserted));
  return res.status(201).json(checkoutReceipt(inserted, requestHash));
}));

const filterOrders = (orders, { period, paymentStatus, orderStatus: status }) => {
  const { startOfToday, startOfMonth } = dateRanges();

  if (period === 'today') orders = orders.filter(order => new Date(order.createdAt) >= startOfToday);
  if (period === 'month') orders = orders.filter(order => new Date(order.createdAt) >= startOfMonth);
  if (paymentStatus === 'Paid') {
    orders = orders.filter(isConfirmedPaid);
  } else if (paymentStatus === 'Pending') {
    orders = orders.filter(order => !isConfirmedPaid(order) && ['Pending', 'Paid'].includes(order.paymentStatus));
  } else if (paymentStatus && paymentStatus !== 'All') {
    orders = orders.filter(order => order.paymentStatus === paymentStatus);
  }
  if (status && status !== 'All') {
    orders = orders.filter(order => orderStatus(order.orderStatus) === orderStatus(status));
  }
  return orders;
};

// The order list and analytics can share the same fresh order snapshot.
app.get('/api/orders', authenticateAdmin, route(async (req, res) => {
  if (req.query.includeAnalytics !== 'true') return res.json(filterOrders(await getOrders(), req.query));
  const [orders, products] = await Promise.all([getOrders(), getProducts()]);
  res.json({ orders: filterOrders(orders, req.query), analytics: buildOrderAnalytics(orders, products) });
}));

app.get(['/api/orders/analytics', '/api/analytics'], authenticateAdmin, route(async (req, res) => {
  const [orders, products] = await Promise.all([getOrders(), getProducts()]);
  res.json(buildOrderAnalytics(orders, products));
}));

const updateOrder = async (id, changes, verifyPayment = false) => {
  if (!isSupabaseConfigured()) {
    const orders = readJsonFile(ORDERS_FILE, []);
    const index = orders.findIndex(order => String(order.id) === id);
    if (index === -1) return null;
    if (verifyPayment && isConfirmedPaid(orders[index])) return orders[index];
    const { status, admin_payment_verified_at, updated_at } = changes;
    const order = {
      ...orders[index],
      ...(status ? { orderStatus: status } : {}),
      ...(admin_payment_verified_at ? { paymentStatus: 'Paid', paymentVerifiedAt: admin_payment_verified_at } : {}),
      updatedAt: updated_at
    };
    orders[index] = order;
    if (!writeJsonFile(ORDERS_FILE, orders)) throw new Error('Failed to update local orders');
    return order;
  }

  if (!/^-?\d{1,19}$/.test(id) || BigInt(id) < -9223372036854775808n || BigInt(id) > 9223372036854775807n) {
    return null;
  }

  const filter = new URLSearchParams({ id: `eq.${id}` });
  const resource = `orders?${ORDER_PROJECTION}&${filter}`;
  if (changes.status || verifyPayment) {
    const [current] = await supabaseRequest(`orders?${filter}&select=status,order_status,payment_status&limit=1`);
    if (!current) return null;
    if (changes.status) {
      changes = {
        ...changes,
        order_status: statusForDb(changes.status, current.order_status || 'Pending'),
        status: statusForDb(changes.status, current.status)
      };
    } else {
      changes = { ...changes, payment_status: statusForDb('Paid', current.payment_status || 'Pending') };
    }
  }

  const [updated] = await supabaseRequest(`${resource}${verifyPayment ? '&admin_payment_verified_at=is.null' : ''}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(changes)
  });
  if (updated) return mapOrderFromDb(updated);
  if (!verifyPayment) return null;

  const [existing] = await supabaseRequest(`${resource}&limit=1`);
  return existing ? mapOrderFromDb(existing) : null;
};

app.patch('/api/orders/:id/status', authenticateAdmin, route(async (req, res) => {
  const nextStatus = cleanText(req.body?.orderStatus);
  if (!ACCEPTED_ORDER_STATUSES.includes(nextStatus)) {
    return res.status(400).json({ error: 'Invalid order status.' });
  }
  const order = await updateOrder(req.params.id, { status: orderStatus(nextStatus), updated_at: new Date().toISOString() });
  return order ? res.json(order) : res.status(404).json({ error: 'Order not found.' });
}));

app.patch('/api/orders/:id/payment', authenticateAdmin, route(async (req, res) => {
  if (req.body?.paymentStatus !== 'Paid') {
    return res.status(400).json({ error: 'Confirm that you have verified the payment.' });
  }
  const now = new Date().toISOString();
  const order = await updateOrder(req.params.id, {
    admin_payment_verified_at: now,
    updated_at: now
  }, true);
  return order ? res.json(order) : res.status(404).json({ error: 'Order not found.' });
}));

// Serve frontend static build files in production mode
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'dist');
if (process.env.SERVE_FRONTEND === 'true' && fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      ok: true,
      service: 'Oman’s Vogue Luxury Perfume API',
      frontend: CLIENT_ORIGIN
    });
  });
}

app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith('CORS blocked origin')) {
    return res.status(403).json({ error: 'Origin not allowed by CORS policy' });
  }
  if (err.checkoutStatus) return res.status(err.checkoutStatus).json({ error: err.message });
  if (err.message === 'omans_checkout_catalogue_changed') {
    return res.status(409).json({ error: 'An item changed or sold out before the order could be saved. Review your cart.' });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON request.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  console.error('[Oman’s Vogue Server] Request failed:', err.message);
  return res.status(500).json({ error: 'The request could not be completed. Please try again.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Oman’s Vogue Server] Server is running on port ${PORT}`);
  console.log(`[Oman’s Vogue Server] Data file: ${DATA_FILE}`);
  console.log(`[Oman’s Vogue Server] Uploads directory: ${UPLOADS_DIR}`);
  console.log(`[Oman’s Vogue Server] Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
