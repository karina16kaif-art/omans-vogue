require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5001;
const isProduction = process.env.NODE_ENV === 'production';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'concierge';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'omans_secret_key_2026';
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? '' : 'omans_vogue_royal_token_hash');
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'https://omansvogue.netlify.app';
const HUBTEL_CLIENT_ID = process.env.HUBTEL_CLIENT_ID || '';
const HUBTEL_CLIENT_SECRET = process.env.HUBTEL_CLIENT_SECRET || '';
const HUBTEL_MERCHANT_ACCOUNT = process.env.HUBTEL_MERCHANT_ACCOUNT || '';
const HUBTEL_CALLBACK_URL = process.env.HUBTEL_CALLBACK_URL || '';
const HUBTEL_RETURN_URL = process.env.HUBTEL_RETURN_URL || CLIENT_ORIGIN;
const HUBTEL_API_BASE_URL = (process.env.HUBTEL_API_BASE_URL || 'https://api.hubtel.com/v1').replace(/\/+$/, '');
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || [
  CLIENT_ORIGIN,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173'
].join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production.');
}

if (isProduction && JWT_SECRET === 'omans_vogue_royal_token_hash') {
  console.warn('[Oman’s Vogue Server] WARNING: using the development JWT secret in production.');
}

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

// Auth authentication middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

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
  whatsappNumber: '+233591259991'
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
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

const brandUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, BRAND_UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, 'hero-' + uniqueSuffix + ext);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

// Helper to read products
const getProducts = () => {
  const products = readJsonFile(DATA_FILE, []);
  return Array.isArray(products) ? products : [];
};

const normalizeCategory = (category) => {
  if (category === "Women's Collection") return 'Women';
  if (category === "Men's Collection") return 'Men';
  if (category === 'Women' || category === 'Men') return category;
  return '';
};

const normalizeProductInput = (value) => typeof value === 'string' ? value.trim() : value;
const normalizeStoredImage = (image, fallbackImage) => {
  const normalized = normalizeProductInput(image);
  if (!normalized || /^blob:/i.test(normalized)) {
    return fallbackImage;
  }
  return normalized;
};
const ORDER_STATUSES = ['New', 'Processing', 'Out for Delivery', 'Delivered', 'Cancelled'];
const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed', 'Cancelled'];
const normalizeOrderInput = (value) => typeof value === 'string' ? value.trim() : value;

const toGhanaE164 = (phone) => {
  const raw = normalizeOrderInput(phone) || '';
  if (!raw) return '';
  if (raw.startsWith('+')) return raw.replace(/\s+/g, '');
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233')) return `+${digits}`;
  if (digits.startsWith('0')) return `+233${digits.slice(1)}`;
  return `+${digits}`;
};

const createOrderId = () => {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `OV-${stamp}-${suffix}`;
};

const isHubtelConfigured = () => Boolean(
  HUBTEL_CLIENT_ID &&
  HUBTEL_CLIENT_SECRET &&
  HUBTEL_MERCHANT_ACCOUNT &&
  HUBTEL_CALLBACK_URL &&
  HUBTEL_RETURN_URL
);

const getOrders = () => {
  const orders = readJsonFile(ORDERS_FILE, []);
  return Array.isArray(orders) ? orders : [];
};

const saveOrders = (orders) => {
  return writeJsonFile(ORDERS_FILE, Array.isArray(orders) ? orders : []);
};

const normalizeBrandSetting = (value) => typeof value === 'string' ? value.trim() : value;

const getBrandSettings = () => {
  const parsed = readJsonFile(SETTINGS_FILE, DEFAULT_BRAND_SETTINGS);
  return { ...DEFAULT_BRAND_SETTINGS, ...(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) };
};

const saveBrandSettings = (settings) => {
  return writeJsonFile(SETTINGS_FILE, { ...DEFAULT_BRAND_SETTINGS, ...(settings || {}) });
};

const normalizeBrandPayload = (body) => {
  const current = getBrandSettings();
  const updates = {};
  [
    'brandName',
    'heroEyebrow',
    'heroHeadlinePrefix',
    'heroSubtitle',
    'heroBackgroundImage',
    'heroBackgroundWebp',
    'whatsappNumber'
  ].forEach((key) => {
    if (body[key] !== undefined) {
      const nextValue = normalizeBrandSetting(body[key]);
      if ((key === 'heroBackgroundImage' || key === 'heroBackgroundWebp') && /^blob:/i.test(nextValue || '')) {
        updates[key] = current[key] || DEFAULT_BRAND_SETTINGS[key];
      } else {
        updates[key] = nextValue || DEFAULT_BRAND_SETTINGS[key];
      }
    }
  });
  return { ...current, ...updates };
};

const normalizeOrderPayload = (body) => {
  const customer = body.customer || {};
  const items = Array.isArray(body.items) ? body.items : [];
  const normalizedItems = items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice ?? item.price);
    return {
      productId: item.productId ?? item.id ?? null,
      name: normalizeOrderInput(item.name) || 'Fragrance',
      category: normalizeCategory(item.category) || normalizeOrderInput(item.category) || '',
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
      image: normalizeOrderInput(item.image) || ''
    };
  }).filter(item => item.name && item.quantity > 0);

  const totalAmount = normalizedItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const paymentMethod = normalizeOrderInput(body.paymentMethod) || 'WhatsApp';

  return {
    customerName: normalizeOrderInput(customer.name || body.customerName),
    customerPhone: normalizeOrderInput(customer.phone || body.customerPhone),
    deliveryPhone: normalizeOrderInput(customer.deliveryPhone || body.deliveryPhone || customer.phone || body.customerPhone),
    deliveryAddress: normalizeOrderInput(customer.deliveryAddress || body.deliveryAddress || body.address),
    cityRegion: normalizeOrderInput(customer.cityRegion || body.cityRegion || body.city),
    items: normalizedItems,
    totalAmount,
    paymentMethod
  };
};

const buildOrderAnalytics = (orders, products) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidOrders = orders.filter(order => order.paymentStatus === 'Paid');
  const revenue = (list) => list.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const productSales = new Map();
  const categorySales = { Men: 0, Women: 0 };
  const monthlyRevenue = Array.from({ length: 12 }, (_, index) => ({
    month: new Date(now.getFullYear(), index, 1).toLocaleString('en', { month: 'short' }),
    revenue: 0,
    orders: 0
  }));
  const ordersByStatus = ORDER_STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {});

  orders.forEach((order) => {
    const created = new Date(order.createdAt);
    if (!Number.isNaN(created.getTime()) && created.getFullYear() === now.getFullYear()) {
      const bucket = monthlyRevenue[created.getMonth()];
      if (bucket) {
        bucket.orders += 1;
        if (order.paymentStatus === 'Paid') {
          bucket.revenue += Number(order.totalAmount || 0);
        }
      }
    }

    const orderStatus = ORDER_STATUSES.includes(order.orderStatus) ? order.orderStatus : 'New';
    ordersByStatus[orderStatus] = (ordersByStatus[orderStatus] || 0) + 1;

    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach((item) => {
      const quantity = Number(item.quantity || 0);
      const sales = Number(item.unitPrice || 0) * quantity;
      const current = productSales.get(item.name) || { name: item.name, quantity: 0, revenue: 0 };
      current.quantity += quantity;
      current.revenue += sales;
      productSales.set(item.name, current);

      if (item.category === 'Men' || item.category === "Men's Collection") {
        categorySales.Men += sales;
      }
      if (item.category === 'Women' || item.category === "Women's Collection") {
        categorySales.Women += sales;
      }
    });
  });

  const ordersToday = orders.filter(order => {
    const created = new Date(order.createdAt);
    return !Number.isNaN(created.getTime()) && created >= startOfToday;
  });
  const ordersThisMonth = orders.filter(order => {
    const created = new Date(order.createdAt);
    return !Number.isNaN(created.getTime()) && created >= startOfMonth;
  });
  const paidToday = ordersToday.filter(order => order.paymentStatus === 'Paid');
  const paidThisMonth = ordersThisMonth.filter(order => order.paymentStatus === 'Paid');
  const bestSellingPerfume = [...productSales.values()].sort((a, b) => b.quantity - a.quantity)[0] || null;

  return {
    totalOrders: orders.length,
    ordersToday: ordersToday.length,
    ordersThisMonth: ordersThisMonth.length,
    totalRevenue: revenue(paidOrders),
    revenueToday: revenue(paidToday),
    revenueThisMonth: revenue(paidThisMonth),
    pendingOrders: orders.filter(order => order.paymentStatus === 'Pending').length,
    paidOrders: paidOrders.length,
    deliveredOrders: orders.filter(order => order.orderStatus === 'Delivered').length,
    cancelledOrders: orders.filter(order => order.orderStatus === 'Cancelled').length,
    bestSellingPerfume,
    lowStockCount: products.filter(product => product.inStock === false).length,
    monthlySales: monthlyRevenue,
    ordersByStatus,
    collectionSales: categorySales
  };
};

// Helper to write products
const saveProducts = (products) => {
  return writeJsonFile(DATA_FILE, Array.isArray(products) ? products : []);
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
app.get(['/api/brand-settings', '/api/settings'], (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(getBrandSettings());
});

// API: Update brand settings
const updateBrandSettings = (req, res) => {
  const settings = normalizeBrandPayload(req.body || {});
  if (!saveBrandSettings(settings)) {
    return res.status(500).json({ error: 'Failed to save brand settings' });
  }
  res.json(settings);
};

app.patch(['/api/brand-settings', '/api/settings'], authenticateAdmin, updateBrandSettings);
app.post(['/api/brand-settings', '/api/settings'], authenticateAdmin, updateBrandSettings);

// API: Upload hero background image
app.post(['/api/brand-settings/hero', '/api/settings/hero'], authenticateAdmin, (req, res) => {
  brandUpload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Hero image upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let savedFilename = req.file.filename;

    try {
      const parsed = path.parse(req.file.filename);
      const webpFilename = `${parsed.name}.webp`;
      const webpPath = path.join(BRAND_UPLOADS_DIR, webpFilename);

      await sharp(req.file.path)
        .rotate()
        .resize({ width: 2200, height: 1400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84, effort: 5 })
        .toFile(webpPath);

      fs.unlink(req.file.path, () => {});
      savedFilename = webpFilename;
    } catch (conversionError) {
      console.warn('[Oman’s Vogue Server] Hero image optimization failed, using original upload.', conversionError);
    }

    const imageUrl = `/uploads/brand/${savedFilename}`;
    const settings = {
      ...getBrandSettings(),
      heroBackgroundImage: imageUrl,
      heroBackgroundWebp: imageUrl.endsWith('.webp') ? imageUrl : ''
    };

    if (!saveBrandSettings(settings)) {
      return res.status(500).json({ error: 'Hero image uploaded, but settings could not be saved' });
    }

    res.json({ imageUrl, settings });
  });
});

// API: Admin Authentication (Login)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username });
  } else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

// API: Verify Admin Token
app.get('/api/auth/verify', authenticateAdmin, (req, res) => {
  res.json({ valid: true, username: req.admin.username });
});

// API: Get all products
app.get('/api/products', (req, res) => {
  const wantsFresh = req.query.fresh === '1' || Boolean(req.headers.authorization);
  res.set(
    'Cache-Control',
    wantsFresh ? 'no-store' : 'public, max-age=30, s-maxage=300, stale-while-revalidate=600'
  );
  const products = getProducts();
  res.json(products);
});

// API: Add new product
app.post('/api/products', authenticateAdmin, (req, res) => {
  const { name, category, price, inStock, description, notes, image } = req.body;
  
  const normalizedName = normalizeProductInput(name);
  const normalizedCategory = normalizeCategory(category);
  const numericPrice = Number(price);

  if (!normalizedName || !normalizedCategory || !Number.isFinite(numericPrice) || numericPrice <= 0) {
    return res.status(400).json({ error: 'Name, valid category, and positive price are required' });
  }

  const products = getProducts();
  const nextId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;

  const newProduct = {
    id: nextId,
    name: normalizedName,
    category: normalizedCategory,
    price: numericPrice,
    inStock: inStock === undefined ? true : inStock === true || inStock === 'true',
    description: normalizeProductInput(description) || '',
    notes: normalizeProductInput(notes) || '',
    image: normalizeStoredImage(image, normalizedCategory === 'Women' ? '/images/products/women_placeholder.png' : '/images/products/men_placeholder.png')
  };

  products.push(newProduct);
  const success = saveProducts(products);

  if (success) {
    res.status(201).json(newProduct);
  } else {
    res.status(500).json({ error: 'Failed to write to database' });
  }
});

// API: Update product (e.g. toggle stock, edit details)
app.patch('/api/products/:id', authenticateAdmin, (req, res) => {
  const productId = Number(req.params.id);
  const updates = req.body;
  
  const products = getProducts();
  const index = products.findIndex(p => p.id === productId);

  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const updatedProduct = { ...products[index], ...updates };

  if (updates.name !== undefined) {
    const normalizedName = normalizeProductInput(updates.name);
    if (!normalizedName) {
      return res.status(400).json({ error: 'Name is required' });
    }
    updatedProduct.name = normalizedName;
  }

  if (updates.category !== undefined) {
    const normalizedCategory = normalizeCategory(updates.category);
    if (!normalizedCategory) {
      return res.status(400).json({ error: 'Valid category is required' });
    }
    updatedProduct.category = normalizedCategory;
  }

  if (updates.price !== undefined) {
    const numericPrice = Number(updates.price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number' });
    }
    updatedProduct.price = numericPrice;
  }

  if (updates.inStock !== undefined) {
    updatedProduct.inStock = updates.inStock === true || updates.inStock === 'true';
  }

  if (updates.description !== undefined) {
    updatedProduct.description = normalizeProductInput(updates.description) || '';
  }

  if (updates.notes !== undefined) {
    updatedProduct.notes = normalizeProductInput(updates.notes) || '';
  }

  if (updates.image !== undefined) {
    updatedProduct.image = normalizeStoredImage(updates.image, products[index].image || (updatedProduct.category === 'Women' ? '/images/products/women_placeholder.png' : '/images/products/men_placeholder.png'));
  }

  products[index] = updatedProduct;
  const success = saveProducts(products);

  if (success) {
    res.json(updatedProduct);
  } else {
    res.status(500).json({ error: 'Failed to update database' });
  }
});

// API: Delete product
app.delete('/api/products/:id', authenticateAdmin, (req, res) => {
  const productId = Number(req.params.id);
  const products = getProducts();
  
  const filtered = products.filter(p => p.id !== productId);
  if (products.length === filtered.length) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const success = saveProducts(filtered);
  if (success) {
    res.json({ message: 'Product deleted successfully', id: productId });
  } else {
    res.status(500).json({ error: 'Failed to save database' });
  }
});

// API: Handle image upload
app.post('/api/upload', authenticateAdmin, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Image upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let savedFilename = req.file.filename;

    try {
      const parsed = path.parse(req.file.filename);
      const webpFilename = `${parsed.name}.webp`;
      const webpPath = path.join(UPLOADS_DIR, webpFilename);

      await sharp(req.file.path)
        .rotate()
        .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 })
        .toFile(webpPath);

      fs.unlink(req.file.path, () => {});
      savedFilename = webpFilename;
    } catch (conversionError) {
      console.warn('[Oman’s Vogue Server] Image optimization failed, using original upload.', conversionError);
    }

    const fileUrl = `/uploads/products/${savedFilename}`;
    res.json({ imageUrl: fileUrl });
  });
});

// API: Create customer order
app.post('/api/orders', (req, res) => {
  const normalized = normalizeOrderPayload(req.body || {});

  if (
    !normalized.customerName ||
    !normalized.customerPhone ||
    !normalized.deliveryPhone ||
    !normalized.deliveryAddress ||
    !normalized.cityRegion ||
    normalized.items.length === 0 ||
    normalized.totalAmount <= 0
  ) {
    return res.status(400).json({ error: 'Customer details, delivery details, and ordered items are required' });
  }

  const now = new Date().toISOString();
  const order = {
    id: createOrderId(),
    customerName: normalized.customerName,
    customerPhone: normalized.customerPhone,
    deliveryPhone: normalized.deliveryPhone,
    deliveryAddress: normalized.deliveryAddress,
    cityRegion: normalized.cityRegion,
    items: normalized.items,
    totalAmount: normalized.totalAmount,
    paymentMethod: normalized.paymentMethod,
    paymentStatus: 'Pending',
    orderStatus: 'New',
    createdAt: now,
    updatedAt: now,
    hubtel: null
  };

  const orders = getOrders();
  orders.unshift(order);

  if (!saveOrders(orders)) {
    return res.status(500).json({ error: 'Failed to save order' });
  }

  return res.status(201).json({
    order,
    hubtelConfigured: isHubtelConfigured()
  });
});

// API: Admin get orders with filters
app.get('/api/orders', authenticateAdmin, (req, res) => {
  const { period, paymentStatus, orderStatus } = req.query;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let orders = getOrders();

  if (period === 'today') {
    orders = orders.filter(order => new Date(order.createdAt) >= startOfToday);
  }
  if (period === 'month') {
    orders = orders.filter(order => new Date(order.createdAt) >= startOfMonth);
  }
  if (paymentStatus && paymentStatus !== 'All') {
    orders = orders.filter(order => order.paymentStatus === paymentStatus);
  }
  if (orderStatus && orderStatus !== 'All') {
    orders = orders.filter(order => order.orderStatus === orderStatus);
  }

  res.set('Cache-Control', 'no-store');
  res.json(orders);
});

// API: Admin analytics
app.get(['/api/orders/analytics', '/api/analytics'], authenticateAdmin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(buildOrderAnalytics(getOrders(), getProducts()));
});

// API: Admin update delivery/order status
app.patch('/api/orders/:id/status', authenticateAdmin, (req, res) => {
  const nextStatus = normalizeOrderInput(req.body?.orderStatus);
  if (!ORDER_STATUSES.includes(nextStatus)) {
    return res.status(400).json({ error: 'Invalid order status' });
  }

  const orders = getOrders();
  const index = orders.findIndex(order => order.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  orders[index] = {
    ...orders[index],
    orderStatus: nextStatus,
    updatedAt: new Date().toISOString()
  };

  if (!saveOrders(orders)) {
    return res.status(500).json({ error: 'Failed to update order' });
  }

  res.json(orders[index]);
});

// API: Hubtel payment initiation
app.post('/api/payments/hubtel/initiate', async (req, res) => {
  if (!isHubtelConfigured()) {
    return res.json({ configured: false, message: 'Hubtel credentials are not configured' });
  }

  const { orderId } = req.body || {};
  const orders = getOrders();
  const index = orders.findIndex(order => order.id === orderId);
  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const order = orders[index];
  const customerPhone = toGhanaE164(order.customerPhone || order.deliveryPhone);
  const payload = {
    amount: Number(order.totalAmount),
    title: "OMAN'S VOGUE Order",
    description: `Payment for order ${order.id}`,
    clientReference: order.id,
    merchantAccountNumber: HUBTEL_MERCHANT_ACCOUNT,
    callbackUrl: HUBTEL_CALLBACK_URL,
    returnUrl: HUBTEL_RETURN_URL,
    cancellationUrl: HUBTEL_RETURN_URL
  };

  try {
    const auth = Buffer.from(`${HUBTEL_CLIENT_ID}:${HUBTEL_CLIENT_SECRET}`).toString('base64');
    const response = await fetch(`${HUBTEL_API_BASE_URL}/request-money/${encodeURIComponent(customerPhone)}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.data?.paylinkUrl) {
      orders[index] = {
        ...order,
        hubtel: {
          ...(order.hubtel || {}),
          lastError: data?.message || 'Hubtel payment initiation failed',
          lastResponse: data,
          attemptedAt: new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      };
      saveOrders(orders);
      return res.status(502).json({ error: 'Hubtel payment initiation failed', details: data });
    }

    orders[index] = {
      ...order,
      paymentMethod: 'Hubtel',
      paymentStatus: 'Pending',
      hubtel: {
        paylinkId: data.data.paylinkId || '',
        paylinkUrl: data.data.paylinkUrl,
        expiresAt: data.data.expiresAt || null,
        clientReference: data.data.clientReference || order.id,
        initiatedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    };
    saveOrders(orders);

    return res.json({
      configured: true,
      paymentUrl: data.data.paylinkUrl,
      order: orders[index]
    });
  } catch (error) {
    console.error('Hubtel initiation error:', error);
    return res.status(502).json({ error: 'Hubtel payment service unavailable' });
  }
});

// API: Hubtel webhook callback
app.post('/api/payments/hubtel/webhook', (req, res) => {
  const payload = req.body || {};
  const data = payload.data || {};
  const clientReference = data.clientReference || payload.clientReference;

  if (!clientReference) {
    return res.status(400).json({ error: 'Missing clientReference' });
  }

  const orders = getOrders();
  const index = orders.findIndex(order => order.id === clientReference);
  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const statusText = String(data.status || payload.status || '').toLowerCase();
  const responseCode = String(payload.responseCode || '').toLowerCase();
  const isPaid = statusText.includes('paid') || statusText.includes('success') || responseCode === '0000';
  const isCancelled = statusText.includes('cancel');
  const isFailed = statusText.includes('fail');
  const paymentStatus = isPaid ? 'Paid' : isCancelled ? 'Cancelled' : isFailed ? 'Failed' : orders[index].paymentStatus;

  orders[index] = {
    ...orders[index],
    paymentStatus,
    hubtel: {
      ...(orders[index].hubtel || {}),
      paymentType: data.paymentType || '',
      paidPhoneNumber: data.phoneNumber || '',
      paylinkId: data.paylinkId || orders[index].hubtel?.paylinkId || '',
      callbackAmount: data.amount ?? null,
      callbackPayload: payload,
      callbackReceivedAt: new Date().toISOString()
    },
    updatedAt: new Date().toISOString()
  };

  saveOrders(orders);
  res.json({ ok: true });
});

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
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Oman’s Vogue Server] Server is running on port ${PORT}`);
  console.log(`[Oman’s Vogue Server] Data file: ${DATA_FILE}`);
  console.log(`[Oman’s Vogue Server] Uploads directory: ${UPLOADS_DIR}`);
  console.log(`[Oman’s Vogue Server] Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
