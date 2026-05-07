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

console.log('--- Sawyer Ship Standalone Server ---');
console.log(`Node Version: ${process.version}`);
console.log(`Working Directory: ${process.cwd()}`);
console.log(`Storage Path: ${CREDS_FILE}`);
console.log('-------------------------------------');

app.use(cors());
app.use(express.json());

// --- Encryption Utility ---
function getEncryptionKey() {
  const key = process.env.SERVER_STORAGE_KEY || 'sawyer-ship-secure-v2-dev-key-32ch';
  // Normalize key to exactly 32 bytes using SHA-256 to avoid "Invalid key length" errors
  return crypto.createHash('sha256').update(String(key)).digest();
}

function encrypt(text) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('[Encryption] Encrypt failed:', error.message);
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

function decrypt(text) {
  try {
    const textParts = text.split(':');
    const ivStr = textParts.shift();
    if (!ivStr) throw new Error('Invalid encrypted format');
    const iv = Buffer.from(ivStr, 'hex');
    const key = getEncryptionKey();
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
async function saveCredentials(data) {
  console.log('[Storage] Saving credentials to disk...');
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  const encrypted = encrypt(JSON.stringify(data));
  await fs.writeFile(CREDS_FILE, encrypted, 'utf8');
  console.log('[Storage] Success: Credentials saved.');
}

async function loadCredentials() {
  try {
    if (!(await fs.access(CREDS_FILE).then(() => true).catch(() => false))) {
      return null;
    }
    const encrypted = await fs.readFile(CREDS_FILE, 'utf8');
    return JSON.parse(decrypt(encrypted));
  } catch (err) {
    console.error('[Storage] Load Error:', err.message);
    return null;
  }
}

// --- UPS Client Implementation ---
class UPSClient {
  constructor(apiKey, secretKey, accountNumber, isSandbox) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.accountNumber = accountNumber;
    this.baseUrl = isSandbox ? 'https://sandbox.api.ups.com' : 'https://api.ups.com';
  }

  async getAccessToken() {
    const auth = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64');
    console.log(`[UPS] Requesting OAuth token (${this.baseUrl})...`);
    const response = await fetch(`${this.baseUrl}/security/v1/oauth/token`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials' })
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`[UPS] Auth failed: ${response.status}`, text);
      throw new Error(`UPS Auth Failed (${response.status}): ${text}`);
    }
    const data = await response.json();
    return data.access_token;
  }

  async request(endpoint, options = {}) {
    try {
      const token = await this.getAccessToken();
      console.log(`[UPS] Request: ${options.method || 'GET'} ${endpoint}`);
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(this.accountNumber ? { 'x-merchant-id': this.accountNumber } : {}),
          'transId': `sawyer-${Date.now()}`,
          'transactionSrc': 'sawyer-ship',
          ...options.headers
        }
      });

      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = { message: await response.text() };
      }

      if (!response.ok) {
        console.error(`[UPS] API Error (${response.status}):`, data);
        const errMsg = data?.response?.errors?.[0]?.message || data?.errors?.[0]?.message || data?.message || 'UPS API Error';
        throw new Error(errMsg);
      }
      return data;
    } catch (error) {
      console.error(`[UPS] Request failed:`, error.message);
      throw error;
    }
  }
}

// --- FedEx Client Implementation ---
class FedExClient {
  constructor(apiKey, secretKey, accountNumber, isSandbox) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.accountNumber = accountNumber;
    this.baseUrl = isSandbox ? 'https://apis-sandbox.fedex.com' : 'https://apis.fedex.com';
  }

  async getAccessToken() {
    try {
      console.log(`[FedEx] Requesting OAuth token (${this.baseUrl})...`);
      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ 
          grant_type: 'client_credentials', 
          client_id: this.apiKey, 
          client_secret: this.secretKey 
        })
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`[FedEx] Auth failed: ${response.status}`, text);
        throw new Error(`FedEx Auth Failed (${response.status}): ${text}`);
      }
      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error(`[FedEx] OAuth failed:`, error.message);
      throw error;
    }
  }

  async request(endpoint, options = {}) {
    try {
      const token = await this.getAccessToken();
      console.log(`[FedEx] Request: ${options.method || 'GET'} ${endpoint}`);
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = { message: await response.text() };
      }

      if (!response.ok) {
        console.error(`[FedEx] API Error (${response.status}):`, data);
        const errMsg = data?.errors?.[0]?.message || data?.message || 'FedEx API Error';
        throw new Error(errMsg);
      }
      return data;
    } catch (error) {
      console.error(`[FedEx] Request failed:`, error.message);
      throw error;
    }
  }
}

// --- API Routes ---
app.get('/api/health', (req, res) => {
  console.log('[Server] Health check ping');
  res.json({ status: 'ok', version: '3.0.0' });
});

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

app.post('/api/ups/:action', async (req, res) => {
  const { action } = req.params;
  try {
    console.log(`[UPS Proxy] Starting action: ${action}`);
    const creds = await loadCredentials();
    if (!creds?.ups) throw new Error('UPS credentials not configured on server');
    
    const ups = new UPSClient(creds.ups.apiKey, creds.ups.secretKey, creds.ups.accountNumber, creds.ups.isSandbox);
    let result;
    const { params } = req.body;

    if (action === 'rates') result = await ups.request('/api/rating/v1/shop', { method: 'POST', body: JSON.stringify(params) });
    else if (action === 'ship') result = await ups.request('/api/shipments/v1/ship', { method: 'POST', body: JSON.stringify(params) });
    else if (action === 'track') {
      const trackingNum = params.trackingNumber || params;
      result = await ups.request(`/api/track/v1/details/${trackingNum}?locale=en_US`);
    }
    else if (action === 'cancel') result = await ups.request(`/api/shipments/v1/void/cancel/${params.trackingNumber}`, { method: 'PUT' });
    else if (action === 'validate-address') result = await ups.request('/api/addressvalidation/v1/1', { method: 'POST', body: JSON.stringify(params) });
    else throw new Error(`Unknown UPS action: ${action}`);

    res.json(result);
  } catch (e) {
    console.error(`[UPS Proxy] Action ${action} failed:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/fedex/:action', async (req, res) => {
  const { action } = req.params;
  try {
    console.log(`[FedEx Proxy] Starting action: ${action}`);
    const creds = await loadCredentials();
    if (!creds?.fedex) throw new Error('FedEx credentials not configured on server');
    
    const fedex = new FedExClient(
      creds.fedex.isSandbox ? creds.fedex.sandboxApiKey : creds.fedex.apiKey,
      creds.fedex.isSandbox ? creds.fedex.sandboxSecretKey : creds.fedex.secretKey,
      creds.fedex.accountNumber,
      creds.fedex.isSandbox
    );
    let result;
    const { params } = req.body;

    if (action === 'rates') result = await fedex.request('/rate/v1/rates/quotes', { method: 'POST', body: JSON.stringify(params) });
    else if (action === 'ship') result = await fedex.request('/ship/v1/shipments', { method: 'POST', body: JSON.stringify(params) });
    else if (action === 'track') {
      const trackingNum = params.trackingNumber || params;
      result = await fedex.request('/track/v1/trackingnumbers', { method: 'POST', body: JSON.stringify({ trackingInfo: [{ trackingNumberInfo: { trackingNumber: trackingNum } }], includeDetailedScans: true }) });
    }
    else if (action === 'cancel') result = await fedex.request('/ship/v1/shipments/cancel', { method: 'PUT', body: JSON.stringify({ accountNumber: { value: creds.fedex.accountNumber }, trackingNumber: params.trackingNumber }) });
    else if (action === 'validate-address') result = await fedex.request('/address/v1/addresses/resolve', { method: 'POST', body: JSON.stringify(params) });
    else throw new Error(`Unknown FedEx action: ${action}`);

    res.json(result);
  } catch (e) {
    console.error(`[FedEx Proxy] Action ${action} failed:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Standalone Sawyer Server running on port ${PORT}`));
