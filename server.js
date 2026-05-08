import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

/**
 * STANDALONE SAWYER SHIP SERVER (Node.js ESM)
 * Port: 3000 (Configurable)
 * Dependencies: express, cors (npm install express cors)
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ENCRYPTION_KEY = process.env.SERVER_STORAGE_KEY || 'sawyer-ship-secure-v2-dev-key-32ch';
const IV_LENGTH = 16;
const STORAGE_DIR = path.join(__dirname, 'storage');
const CREDS_FILE = path.join(STORAGE_DIR, 'carrier-credentials.enc');
const APP_DATA_FILE = path.join(STORAGE_DIR, 'app-data.enc');

console.log('--- Sawyer Ship Standalone Server ---');
console.log(`Node Version: ${process.version}`);
console.log(`Working Directory: ${process.cwd()}`);
console.log(`Storage Path: ${STORAGE_DIR}`);
console.log('-------------------------------------');

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for full data sync

// --- Encryption Utility ---
function getEncryptionKey(customPassword = null) {
  const baseKey = process.env.SERVER_STORAGE_KEY || 'sawyer-ship-secure-v2-dev-key-32ch';
  const finalKey = customPassword ? `${baseKey}:${customPassword}` : baseKey;
  // Normalize key to exactly 32 bytes using SHA-256 to avoid "Invalid key length" errors
  return crypto.createHash('sha256').update(String(finalKey)).digest();
}

function encrypt(text, password = null) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKey(password);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('[Encryption] Encrypt failed:', error.message);
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

function decrypt(text, password = null) {
  try {
    const textParts = text.split(':');
    const ivStr = textParts.shift();
    if (!ivStr) throw new Error('Invalid encrypted format');
    const iv = Buffer.from(ivStr, 'hex');
    const key = getEncryptionKey(password);
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('[Encryption] Decrypt failed:', error.message);
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

// --- Storage Logic ---
async function writeStore(filePath, data, password = null) {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  const encrypted = encrypt(JSON.stringify(data), password);
  await fs.writeFile(filePath, encrypted, 'utf8');
}

async function readStore(filePath, password = null) {
  if (!(await fs.access(filePath).then(() => true).catch(() => false))) {
    return null;
  }
  const encrypted = await fs.readFile(filePath, 'utf8');
  return JSON.parse(decrypt(encrypted, password));
}

async function saveCredentials(data) {
  console.log('[Storage] Saving credentials to disk...');
  await writeStore(CREDS_FILE, data);
  console.log('[Storage] Success: Credentials saved.');
}

async function loadCredentials() {
  try {
    return await readStore(CREDS_FILE);
  } catch (err) {
    console.error('[Storage] Load Credentials Error:', err.message);
    return null;
  }
}

// --- Token Cache for Carriers ---
const TOKEN_CACHE = {
  ups: { token: null, expires: 0 },
  fedex: { token: null, expires: 0 }
};

// --- API Proxy Implementation ---
async function handleProxy(req, res) {
  const { service } = req.params;
  const endpoint = req.params[0]; // Captures the '*' part of the route
  const creds = await loadCredentials();

  if (!creds || !creds[service]) {
    return res.status(400).json({ error: `Credentials for ${service} not configured on server.` });
  }

  try {
    let targetUrl = '';
    const headers = { 'Content-Type': 'application/json' };
    const method = req.method;
    const body = method !== 'GET' && Object.keys(req.body).length > 0 ? JSON.stringify(req.body.params || req.body) : null;

    if (service === 'magento') {
      const config = creds.magento;
      const baseUrl = (config.url || config.baseUrl || '').replace(/\/+$/, '');
      targetUrl = `${baseUrl}/rest/V1/${endpoint}`;
      headers['Authorization'] = `Bearer ${config.token}`;
    } 
    else if (service === 'ups') {
      const config = creds.ups;
      const baseUrl = config.isSandbox ? 'https://sandbox.api.ups.com' : 'https://api.ups.com';
      targetUrl = `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
      
      // Handle OAuth
      let token = TOKEN_CACHE.ups.token;
      if (!token || Date.now() > TOKEN_CACHE.ups.expires) {
        console.log('[UPS Proxy] Requesting new OAuth token...');
        const auth = Buffer.from(`${config.apiKey}:${config.secretKey}`).toString('base64');
        const tokenRes = await fetch(`${baseUrl}/security/v1/oauth/token`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'client_credentials' })
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(`UPS Auth Failed: ${JSON.stringify(tokenData)}`);
        TOKEN_CACHE.ups.token = tokenData.access_token;
        TOKEN_CACHE.ups.expires = Date.now() + (parseInt(tokenData.expires_in || '3600') * 1000) - 60000;
        token = TOKEN_CACHE.ups.token;
      }
      
      headers['Authorization'] = `Bearer ${token}`;
      if (config.accountNumber) headers['x-merchant-id'] = config.accountNumber;
      headers['transId'] = `sawyer-${Date.now()}`;
      headers['transactionSrc'] = 'sawyer-ship';
    }
    else if (service === 'fedex') {
      const config = creds.fedex;
      const isSandbox = config.isSandbox === true || config.isSandbox === 'true';
      const baseUrl = isSandbox ? 'https://apis-sandbox.fedex.com' : 'https://apis.fedex.com';
      targetUrl = `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

      // Handle OAuth
      let token = TOKEN_CACHE.fedex.token;
      if (!token || Date.now() > TOKEN_CACHE.fedex.expires) {
        console.log('[FedEx Proxy] Requesting new OAuth token...');
        const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ 
            grant_type: 'client_credentials', 
            client_id: isSandbox ? (config.sandboxApiKey || config.apiKey) : (config.productionApiKey || config.apiKey), 
            client_secret: isSandbox ? (config.sandboxSecretKey || config.secretKey) : (config.productionSecretKey || config.secretKey)
          })
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(`FedEx Auth Failed: ${JSON.stringify(tokenData)}`);
        TOKEN_CACHE.fedex.token = tokenData.access_token;
        TOKEN_CACHE.fedex.expires = Date.now() + (parseInt(tokenData.access_token_expires_in || '3600') * 1000) - 60000;
        token = TOKEN_CACHE.fedex.token;
      }

      headers['Authorization'] = `Bearer ${token}`;
      headers['x-customer-transaction-id'] = `sawyer-${Date.now()}`;
      headers['x-locale'] = 'en_US';
    }

    console.log(`[Proxy] ${method} ${targetUrl}`);
    const apiResponse = await fetch(targetUrl, { method, headers, body });
    
    // Transparently return content-type and status
    const data = await apiResponse.json().catch(() => ({}));
    res.status(apiResponse.status).json(data);

  } catch (error) {
    console.error(`[Proxy Error] ${service}:`, error.message);
    res.status(500).json({ error: error.message });
  }
}

// --- API Routes ---
app.all('/api/proxy/:service/*', handleProxy);


app.post('/api/settings/credentials', async (req, res) => {
  try {
    console.log('[Server] Received credential sync request');
    await saveCredentials(req.body.credentials);
    res.json({ success: true });
  } catch (e) {
    console.error('[Server] Sync failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/settings/credentials', async (req, res) => {
  try {
    const creds = await loadCredentials();
    res.json({ credentials: creds });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/data/save', async (req, res) => {
  try {
    const { data, password } = req.body;
    console.log('[Server] Saving full application data...');
    await writeStore(APP_DATA_FILE, data, password);
    res.json({ success: true });
  } catch (e) {
    console.error('[Server] Data save failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/data/load', async (req, res) => {
  try {
    const { password } = req.body;
    console.log('[Server] Loading full application data...');
    const data = await readStore(APP_DATA_FILE, password);
    res.json({ data });
  } catch (e) {
    console.error('[Server] Data load failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Standalone Sawyer Server running on http://0.0.0.0:${PORT}`));
