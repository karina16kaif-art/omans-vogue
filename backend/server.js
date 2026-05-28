require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5001;
const isProduction = process.env.NODE_ENV === 'production';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'concierge';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'omans_secret_key_2026';
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? '' : 'omans_vogue_royal_token_hash');
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'https://omansvogue.netlify.app';
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
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }
  const token = authHeader.split(' ')[1];
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
const BUNDLED_DATA_FILE = path.join(__dirname, 'data', 'products.json');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'public', 'uploads', 'products');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  if (fs.existsSync(BUNDLED_DATA_FILE) && path.resolve(DATA_FILE) !== path.resolve(BUNDLED_DATA_FILE)) {
    fs.copyFileSync(BUNDLED_DATA_FILE, DATA_FILE);
  } else {
    fs.writeFileSync(DATA_FILE, '[]', 'utf8');
  }
}

// Serve public static assets
app.use('/uploads/products', express.static(UPLOADS_DIR, {
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

// Helper to read products
const getProducts = () => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading products JSON:', error);
    return [];
  }
};

const normalizeCategory = (category) => {
  if (category === "Women's Collection") return 'Women';
  if (category === "Men's Collection") return 'Men';
  if (category === 'Women' || category === 'Men') return category;
  return '';
};

const normalizeProductInput = (value) => typeof value === 'string' ? value.trim() : value;

// Helper to write products
const saveProducts = (products) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing products JSON:', error);
    return false;
  }
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
  res.set('Cache-Control', 'no-store');
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
    image: normalizeProductInput(image) || (normalizedCategory === 'Women' ? '/images/products/women_placeholder.png' : '/images/products/men_placeholder.png')
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
    updatedProduct.image = normalizeProductInput(updates.image) || (updatedProduct.category === 'Women' ? '/images/products/women_placeholder.png' : '/images/products/men_placeholder.png');
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
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Image upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/products/${req.file.filename}`;
    res.json({ imageUrl: fileUrl });
  });
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
