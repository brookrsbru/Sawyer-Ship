import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

/**
 * STANDALONE SAWYER SHIP SERVER (Node.js ESM)
 * Port: 3000
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const STORAGE_DIR = path.join(process.cwd(), 'storage');
const CREDS_FILE = path.join(STORAGE_DIR, 'carrier-credentials.enc');
const APP_DATA_FILE = path.join(STORAGE_DIR, 'app-data.enc');

// --- Encryption Utility (Inline for self-containment) ---
const ENCRYPTION_KEY = process.env.SERVER_STORAGE_KEY || 'sawyer-ship-secure-v2-dev-key-32ch';
const IV_LENGTH = 16;

function getEncryptionKey(customPassword = null) {
  const baseKey = process.env.SERVER_STORAGE_KEY || 'sawyer-ship-secure-v2-dev-key-32ch';
  const finalKey = customPassword ? `${baseKey}:${customPassword}` : baseKey;
  return crypto.createHash('sha256').update(String(finalKey)).digest();
}

function encrypt(text: string, password: any = null) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey(password);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string, password: any = null) {
  const textParts = text.split(':');
  const ivHex = textParts.shift();
  if (!ivHex) throw new Error('Invalid format');
  const iv = Buffer.from(ivHex, 'hex');
  const key = getEncryptionKey(password);
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// --- Storage Logic ---
async function writeStore(filePath: string, data: any, password: any = null) {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  const encrypted = encrypt(JSON.stringify(data), password);
  await fs.writeFile(filePath, encrypted, 'utf8');
}

async function readStore(filePath: string, password: any = null) {
  try {
    const encrypted = await fs.readFile(filePath, 'utf8');
    return JSON.parse(decrypt(encrypted, password));
  } catch (err) {
    return null;
  }
}

async function loadCredentials() {
  return await readStore(CREDS_FILE);
}

async function saveCredentials(data: any) {
  await writeStore(CREDS_FILE, data);
}

// --- Token Cache for Carriers ---
const TOKEN_CACHE = {
  ups: { token: null as string | null, expires: 0 },
  fedex: { token: null as string | null, expires: 0 }
};

// --- Client Implementations ---
class UPSClient {
  baseUrl: string;
  constructor(public apiKey: string, public secretKey: string, public accountNumber: string, public isSandbox: boolean) {
    this.baseUrl = isSandbox ? 'https://sandbox.api.ups.com' : 'https://api.ups.com';
  }
  async getAccessToken() {
    if (TOKEN_CACHE.ups.token && Date.now() < TOKEN_CACHE.ups.expires) return TOKEN_CACHE.ups.token;
    const auth = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64');
    const res = await fetch(`${this.baseUrl}/security/v1/oauth/token`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials' })
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(`UPS Auth Failed: ${JSON.stringify(data)}`);
    TOKEN_CACHE.ups.token = data.access_token;
    TOKEN_CACHE.ups.expires = Date.now() + (parseInt(data.expires_in || '3600') * 1000) - 60000;
    return data.access_token;
  }
  async request(endpoint: string, options: any = {}) {
    const token = await this.getAccessToken();
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
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || 'UPS API Error');
    return data;
  }
}

class FedExClient {
  baseUrl: string;
  constructor(public apiKey: string, public secretKey: string, public accountNumber: string, public isSandbox: boolean) {
    this.baseUrl = isSandbox ? 'https://apis-sandbox.fedex.com' : 'https://apis.fedex.com';
  }
  async getAccessToken() {
    if (TOKEN_CACHE.fedex.token && Date.now() < TOKEN_CACHE.fedex.expires) return TOKEN_CACHE.fedex.token;
    const res = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: this.apiKey, client_secret: this.secretKey })
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(`FedEx Auth Failed: ${JSON.stringify(data)}`);
    TOKEN_CACHE.fedex.token = data.access_token;
    TOKEN_CACHE.fedex.expires = Date.now() + (parseInt(data.access_token_expires_in || '3600') * 1000) - 60000;
    return data.access_token;
  }
  async request(endpoint: string, options: any = {}) {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || 'FedEx API Error');
    return data;
  }
}

class MagentoClient {
  baseUrl: string;
  constructor(baseUrl: string, public token: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }
  async fetch(endpoint: string, options: any = {}) {
    const response = await fetch(`${this.baseUrl}/rest/V1/${endpoint}`, {
      ...options,
      headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json', ...options.headers }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Magento API Error');
    return data;
  }
  normalizeOrder(order: any) {
    if (!order) return order;
    let sa = order.extension_attributes?.shipping_assignments?.[0]?.shipping?.address || order.extension_attributes?.shipping_address || order.shipping_address || order.billing_address || {};
    let street = sa.street || [];
    if (typeof street === 'string') street = [street];
    else if (street && typeof street === 'object' && !Array.isArray(street)) street = Object.values(street);
    return { ...order, shipping_address: { ...sa, street: street.filter((s: any) => typeof s === 'string') } };
  }
}

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  const SERVER_VERSION = '4.1.0';

  // API Routes
  app.get('/api/health', (req, res) => res.json({ status: 'ok', version: SERVER_VERSION }));

  app.post('/api/settings/credentials', async (req, res) => {
    try {
      await saveCredentials(req.body.credentials);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/settings/credentials', async (req, res) => {
    try {
      const creds = await loadCredentials();
      res.json({ credentials: creds });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/magento/:action', async (req, res) => {
    try {
      const creds = await loadCredentials();
      if (!creds?.magento) throw new Error('Magento not configured');
      const magento = new MagentoClient(creds.magento.url || creds.magento.baseUrl, creds.magento.token);
      const { action } = req.params;
      const { params } = req.body;
      let result;

      if (action === 'orders') {
        const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=increment_id&searchCriteria[filter_groups][0][filters][0][value]=%25${params.query}%25&searchCriteria[filter_groups][0][filters][0][condition_type]=like`;
        const data = await magento.fetch(`orders?${searchCriteria}`);
        if (data.items) data.items = data.items.map((i: any) => magento.normalizeOrder(i));
        result = data;
      } else if (action === 'order') {
        try {
          const data = await magento.fetch(`orders/${params.id}`);
          result = magento.normalizeOrder(data);
        } catch (e) {
          const sc = `searchCriteria[filter_groups][0][filters][0][field]=increment_id&searchCriteria[filter_groups][0][filters][0][value]=${params.id}&searchCriteria[filter_groups][0][filters][0][condition_type]=eq`;
          const data = await magento.fetch(`orders?${sc}`);
          if (data.items?.length > 0) result = magento.normalizeOrder(data.items[0]);
          else throw e;
        }
      } else if (action === 'products') {
        const sc = `searchCriteria[filter_groups][0][filters][0][field]=sku&searchCriteria[filter_groups][0][filters][0][value]=${params.skus.join(',')}&searchCriteria[filter_groups][0][filters][0][condition_type]=in`;
        result = await magento.fetch(`products?${sc}`);
      } else if (action === 'ship') {
        result = await magento.fetch(`order/${params.orderId}/ship`, {
          method: 'POST',
          body: JSON.stringify({
            items: [], notify: true, appendComment: true,
            comment: { extension_attributes: {}, comment: `Shipment via Sawyer-Ship v${SERVER_VERSION}`, is_visible_on_front: 1 },
            tracks: params.tracks
          })
        });
      } else if (action === 'attribute-options') {
        result = await magento.fetch(`products/attributes/${params.attributeCode}/options`);
      } else throw new Error(`Unknown: ${action}`);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/ups/:action', async (req, res) => {
    try {
      const creds = await loadCredentials();
      if (!creds?.ups) throw new Error('UPS missing');
      const ups = new UPSClient(creds.ups.apiKey, creds.ups.secretKey, creds.ups.accountNumber, creds.ups.isSandbox);
      const { action } = req.params;
      const { params } = req.body;
      let result;
      if (action === 'rates') result = await ups.request('/api/rating/v1/shop', { method: 'POST', body: JSON.stringify(params) });
      else if (action === 'ship') result = await ups.request('/api/shipments/v1/ship', { method: 'POST', body: JSON.stringify(params) });
      else if (action === 'track') result = await ups.request(`/api/track/v1/details/${params.trackingNumber}?locale=en_US`);
      else if (action === 'cancel') result = await ups.request(`/api/shipments/v1/void/cancel/${params.trackingNumber}`, { method: 'PUT' });
      else if (action === 'validate-address') result = await ups.request('/api/addressvalidation/v1/1', { method: 'POST', body: JSON.stringify(params) });
      else throw new Error(`Unknown: ${action}`);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/fedex/:action', async (req, res) => {
    try {
      const creds = await loadCredentials();
      if (!creds?.fedex) throw new Error('FedEx missing');
      const isSandbox = creds.fedex.isSandbox === true || String(creds.fedex.isSandbox) === 'true';
      const acct = isSandbox ? (creds.fedex.domesticAccountNumber || creds.fedex.globalAccountNumber || creds.fedex.accountNumber || '') : (creds.fedex.productionAccountNumber || creds.fedex.accountNumber || '');
      const fedex = new FedExClient(isSandbox ? (creds.fedex.sandboxApiKey || creds.fedex.apiKey) : (creds.fedex.productionApiKey || creds.fedex.apiKey), isSandbox ? (creds.fedex.sandboxSecretKey || creds.fedex.secretKey) : (creds.fedex.productionSecretKey || creds.fedex.secretKey), acct.trim(), isSandbox);
      const { action } = req.params;
      const { params } = req.body;
      if (fedex.accountNumber) {
        params.accountNumber = { value: fedex.accountNumber };
        if (params.requestedShipment) {
          const rs = params.requestedShipment;
          if (rs.shipper) rs.shipper.accountNumber = { value: fedex.accountNumber };
          if (rs.shippingChargesPayment?.payor?.responsibleParty) rs.shippingChargesPayment.payor.responsibleParty.accountNumber = { value: fedex.accountNumber };
        }
      }
      const headers = { 'x-customer-transaction-id': `sawyer-${Date.now()}`, 'x-locale': 'en_US' };
      let result;
      if (action === 'rates') result = await fedex.request('/rate/v1/rates/quotes', { method: 'POST', headers, body: JSON.stringify(params) });
      else if (action === 'ship') result = await fedex.request('/ship/v1/shipments', { method: 'POST', headers, body: JSON.stringify(params) });
      else if (action === 'track') result = await fedex.request('/track/v1/trackingnumbers', { method: 'POST', headers, body: JSON.stringify({ trackingInfo: [{ trackingNumberInfo: { trackingNumber: params.trackingNumber }, ...(fedex.accountNumber ? { accountNumber: fedex.accountNumber } : {}) }], includeDetailedScans: true }) });
      else if (action === 'cancel') result = await fedex.request('/ship/v1/shipments/cancel', { method: 'PUT', headers, body: JSON.stringify({ accountNumber: { value: fedex.accountNumber }, trackingNumber: params.trackingNumber }) });
      else if (action === 'validate-address') result = await fedex.request('/address/v1/addresses/resolve', { method: 'POST', headers, body: JSON.stringify(params) });
      else throw new Error(`Unknown: ${action}`);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/data/save', async (req, res) => {
    try {
      await writeStore(APP_DATA_FILE, req.body.data, req.body.password);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/data/load', async (req, res) => {
    try {
      const data = await readStore(APP_DATA_FILE, req.body.password);
      res.json({ data });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sawyer Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
