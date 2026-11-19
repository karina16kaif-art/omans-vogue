const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');

const scrypt = promisify(crypto.scrypt);
const kdfOptions = { N: 65536, r: 8, p: 2, maxmem: 96 * 1024 * 1024 };
const issuer = 'omans-vogue-admin';
const validPassword = (password) => typeof password === 'string' && password.length > 0 && password.length <= 128;
const digest = (value) => crypto.createHash('sha256').update(value).digest();

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, kdfOptions);
  return `scrypt:${salt}:${hash.toString('hex')}`;
};

const verifyPassword = async (password, storedHash) => {
  const [, salt, hash] = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(storedHash) || [];
  if (!salt) throw new Error('Invalid stored admin credential');
  const candidate = await scrypt(password, salt, 64, kdfOptions);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
};

module.exports = function createAdminAuth({ username, bootstrapPassword, secret, dataDir, isSupabaseConfigured, supabaseRequest }) {
  const credentialsFile = path.join(dataDir, 'admin-credentials.json');
  const credentialFilter = new URLSearchParams({ username: `eq.${username}` });
  const sessionVersion = (hash) => crypto.createHmac('sha256', secret).update(hash).digest('hex');
  const issueToken = (hash) => jwt.sign({ username, version: sessionVersion(hash) }, secret, {
    algorithm: 'HS256',
    issuer,
    expiresIn: '24h'
  });

  const readLocalCredential = () => {
    try {
      const credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
      const stored = Object.hasOwn(credentials, username) ? credentials[username] : null;
      return typeof stored === 'string'
        ? { password_hash: stored, revision: sessionVersion(stored) }
        : stored;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  };

  const readCredential = async () => {
    if (!isSupabaseConfigured()) return readLocalCredential();
    const rows = await supabaseRequest(`admin_credentials?${credentialFilter}&select=password_hash,revision`);
    return rows[0] || null;
  };

  const writeCredential = async (credential, previousRevision) => {
    if (!isSupabaseConfigured()) {
      if ((readLocalCredential()?.revision ?? null) !== previousRevision) return false;
      const tempFile = `${credentialsFile}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify({ [username]: credential }), { mode: 0o600 });
      fs.renameSync(tempFile, credentialsFile);
      return true;
    }

    const resource = previousRevision
      ? `admin_credentials?${credentialFilter}&${new URLSearchParams({ revision: `eq.${previousRevision}` })}`
      : 'admin_credentials?on_conflict=username';
    const rows = await supabaseRequest(resource, {
      method: previousRevision ? 'PATCH' : 'POST',
      headers: { Prefer: previousRevision ? 'return=representation' : 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({
        ...(previousRevision ? {} : { username }),
        ...credential,
        updated_at: new Date().toISOString()
      })
    });
    return Boolean(rows?.length);
  };

  const attempts = new Map();
  const attemptWindow = 15 * 60 * 1000;
  let activeAttempts = 0;
  setInterval(() => {
    const now = Date.now();
    for (const [ip, attempt] of attempts) {
      if (attempt.expiresAt <= now) attempts.delete(ip);
    }
  }, attemptWindow).unref();

  const passwordHandler = (handler) => async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const now = Date.now();
    const existing = attempts.get(req.ip);
    const attempt = existing?.expiresAt > now ? existing : { count: 0, expiresAt: now + attemptWindow };
    if (activeAttempts >= 2) {
      return res.set('Retry-After', '2').status(429).json({ error: 'Another sign-in or password change is in progress. Try again shortly.' });
    }
    if (attempt.count >= 10) {
      return res.set('Retry-After', String(Math.ceil((attempt.expiresAt - now) / 1000)))
        .status(429).json({ error: 'Too many attempts. Try again later.' });
    }

    attempt.count += 1;
    attempts.set(req.ip, attempt);
    activeAttempts += 1;
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    } finally {
      activeAttempts -= 1;
    }
  };

  const authenticateAdmin = async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const token = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '')?.[1];
    let claims;
    try {
      claims = jwt.verify(token, secret, { algorithms: ['HS256'], issuer });
    } catch {
      return res.status(401).json({ error: 'An active admin session is required.' });
    }
    if (claims.username !== username || !claims.version) {
      return res.status(401).json({ error: 'An active admin session is required.' });
    }

    try {
      const credential = await readCredential();
      if (!credential || sessionVersion(credential.password_hash) !== claims.version) {
        return res.status(401).json({ error: 'Your admin session has expired. Sign in again.' });
      }
      req.admin = { username, credential };
      next();
    } catch (error) {
      next(error);
    }
  };

  const login = passwordHandler(async (req, res) => {
    const { username: suppliedUsername, password } = req.body || {};
    if (!validPassword(password) || typeof suppliedUsername !== 'string') {
      return res.status(400).json({ error: 'A username and password are required.' });
    }
    const incorrect = () => res.status(401).json({ error: 'Invalid username or password.' });
    if (suppliedUsername !== username) return incorrect();

    let credential = await readCredential();
    if (!credential) {
      if (!bootstrapPassword) {
        return res.status(503).json({ error: 'Admin sign-in has not been configured.' });
      }
      if (!crypto.timingSafeEqual(digest(password), digest(bootstrapPassword))) return incorrect();

      const initial = { password_hash: await hashPassword(password), revision: crypto.randomUUID() };
      credential = await writeCredential(initial, null) ? initial : await readCredential();
      if (credential !== initial && (!credential || !await verifyPassword(password, credential.password_hash))) return incorrect();
    } else if (!await verifyPassword(password, credential.password_hash)) {
      return incorrect();
    }

    res.json({ token: issueToken(credential.password_hash), username });
  });

  const changePassword = passwordHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!validPassword(currentPassword) || !validPassword(newPassword) || newPassword.length < 12 || currentPassword === newPassword) {
      return res.status(400).json({ error: 'Enter your current password and a different new password of 12–128 characters.' });
    }
    if (!await verifyPassword(currentPassword, req.admin.credential.password_hash)) {
      return res.status(403).json({ error: 'Current password is incorrect.' });
    }

    const credential = { password_hash: await hashPassword(newPassword), revision: crypto.randomUUID() };
    if (!await writeCredential(credential, req.admin.credential.revision)) {
      return res.status(409).json({ error: 'The password changed in another session. Sign in again.' });
    }
    res.json({ token: issueToken(credential.password_hash) });
  });

  return { authenticateAdmin, login, changePassword };
};
