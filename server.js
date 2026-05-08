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

// --- Magento Client Implementation ---
class MagentoClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
  }

  async fetch(endpoint, options = {}) {
    const url = `${this.baseUrl}/rest/V1/${endpoint}`;
    console.log(`[Magento] Request: ${options.method || 'GET'} ${url}`);
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data.message || response.statusText || 'Magento API Error';
      throw new Error(`Magento Error (${response.status}): ${msg}`);
    }
    return data;
  }

  normalizeOrder(order) {
    if (!order) return order;
    
    // Debug log for order structure if needed (server-side only)
    // console.log(`[Magento Normalize] Processing order: ${order.increment_id}`);

    // Magento 2 orders often have shipping address in extension_attributes
    // We try multiple paths to find the most populated address object
    let shippingAddress = {};
    
    if (order.extension_attributes?.shipping_assignments?.[0]?.shipping?.address) {
      shippingAddress = order.extension_attributes.shipping_assignments[0].shipping.address;
    } else if (order.extension_attributes?.shipping_address) {
      // Some Magento versions/modules put it here
      shippingAddress = order.extension_attributes.shipping_address;
    } else if (order.extension_attributes?.shipping_address_id) {
       // If it's just an ID, we might have a problem, but let's hope one of the other fallbacks works
       if (order.shipping_address) shippingAddress = order.shipping_address;
    } else if (order.shipping_address && (order.shipping_address.street || order.shipping_address.city)) {
      shippingAddress = order.shipping_address;
    } else if (order.billing_address) {
      shippingAddress = order.billing_address;
    }

    // Double check: if shippingAddress is still mostly empty, check billing_address again explicitly
    if (!shippingAddress.street && order.billing_address) {
      shippingAddress = order.billing_address;
    }

    // Ensure street is an array
    let street = shippingAddress.street || [];
    if (typeof street === 'string') {
      street = [street];
    }

    // Combine into a clean object the frontend expects
    return {
      ...order,
      // Ensure top-level customer names are from the shipping address if available
      customer_firstname: shippingAddress.firstname || order.customer_firstname || '',
      customer_lastname: shippingAddress.lastname || order.customer_lastname || '',
      shipping_address: {
        firstname: shippingAddress.firstname || order.customer_firstname || '',
        lastname: shippingAddress.lastname || order.customer_lastname || '',
        company: shippingAddress.company || '',
        street: street,
        city: shippingAddress.city || '',
        region: shippingAddress.region || '',
        postcode: shippingAddress.postcode || '',
        country_id: shippingAddress.country_id || '',
        telephone: shippingAddress.telephone || '',
      }
    };
  }
}

// --- API Routes ---
app.get('/api/health', (req, res) => {
  console.log('[Server] Health check ping');
  res.json({ status: 'ok', version: '4.0.0' });
});

app.post('/api/magento/:action', async (req, res) => {
  const { action } = req.params;
  try {
    console.log(`[Magento Proxy] Starting action: ${action}`);
    const creds = await loadCredentials();
    if (!creds?.magento) throw new Error('Magento credentials not configured on server');
    
    const magentoUrl = creds.magento.url || creds.magento.baseUrl || creds.magento.baseUrl;
    const magento = new MagentoClient(magentoUrl, creds.magento.token);
    let result;
    const { params } = req.body;

    if (action === 'orders') {
      const { query } = params;
      const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=increment_id&searchCriteria[filter_groups][0][filters][0][value]=%25${query}%25&searchCriteria[filter_groups][0][filters][0][condition_type]=like`;
      const data = await magento.fetch(`orders?${searchCriteria}`);
      if (data.items) {
        data.items = data.items.map(item => magento.normalizeOrder(item));
      }
      result = data;
    } 
    else if (action === 'order') {
      const { id } = params;
      try {
        const data = await magento.fetch(`orders/${id}`);
        result = magento.normalizeOrder(data);
      } catch (e) {
        if (e.message.includes('404')) {
          const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=increment_id&searchCriteria[filter_groups][0][filters][0][value]=${id}&searchCriteria[filter_groups][0][filters][0][condition_type]=eq`;
          const data = await magento.fetch(`orders?${searchCriteria}`);
          if (data.items?.length > 0) result = magento.normalizeOrder(data.items[0]);
          else throw e;
        } else throw e;
      }
    }
    else if (action === 'products') {
      const { skus } = params;
      const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=sku&searchCriteria[filter_groups][0][filters][0][value]=${skus.map(s => encodeURIComponent(s)).join(',')}&searchCriteria[filter_groups][0][filters][0][condition_type]=in`;
      result = await magento.fetch(`products?${searchCriteria}`);
    }
    else if (action === 'ship') {
      const { orderId, tracks } = params;
      result = await magento.fetch(`order/${orderId}/ship`, {
        method: 'POST',
        body: JSON.stringify({
          items: [],
          notify: true,
          appendComment: true,
          comment: { extension_attributes: {}, comment: `Shipment created via Sawyer-Ship Server (v${req.app.get('version') || '4.0.0'})`, is_visible_on_front: 1 },
          tracks: tracks
        })
      });
    }
    else if (action === 'attribute-options') {
      const { attributeCode } = params;
      result = await magento.fetch(`products/attributes/${attributeCode}/options`);
    }
    else if (action === 'dev-order') {
       // Support for raw dev order data fetching
       const { incrementId } = params;
       const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=increment_id&searchCriteria[filter_groups][0][filters][0][value]=${incrementId}&searchCriteria[filter_groups][0][filters][0][condition_type]=eq`;
       const data = await magento.fetch(`orders?${searchCriteria}`);
       result = data.items?.[0] ? magento.normalizeOrder(data.items[0]) : null;
    }
    else throw new Error(`Unknown Magento action: ${action}`);

    res.json(result);
  } catch (e) {
    console.error(`[Magento Proxy] Action ${action} failed:`, e.message);
    res.status(500).json({ error: e.message });
  }
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
    
    // Pick the best available account number for FedEx
    let fedexAccount = '';
    if (creds.fedex.isSandbox) {
      // Priority: domestic -> global -> payment -> any
      fedexAccount = creds.fedex.domesticAccountNumber || creds.fedex.globalAccountNumber || creds.fedex.paymentAccountNumber || creds.fedex.accountNumber || '';
    } else {
      fedexAccount = creds.fedex.productionAccountNumber || creds.fedex.accountNumber || '';
    }

    const fedex = new FedExClient(
      creds.fedex.isSandbox ? creds.fedex.sandboxApiKey : (creds.fedex.productionApiKey || creds.fedex.apiKey),
      creds.fedex.isSandbox ? creds.fedex.sandboxSecretKey : (creds.fedex.productionSecretKey || creds.fedex.secretKey),
      fedexAccount,
      creds.fedex.isSandbox
    );
    let result;
    const { params } = req.body;

    // --- FedEx Account Number Invariant Fix ---
    // Ensure the payload account number matches the client account number to prevent "Account Number Mismatch"
    // We prioritize the server-side credential, but if it's missing, we let the client's value stay (if any)
    if (fedexAccount) {
      params.accountNumber = params.accountNumber || { value: fedexAccount };
      params.accountNumber.value = fedexAccount;
    }

    // Force Payor Account Number to match Shipper Account Number for SENDER payment type
    // This resolves the user error: "Account Number Mismatch -As the payment Type is SENDER..."
    if (params.requestedShipment) {
      const shipment = params.requestedShipment;
      
      // Inject into Shipper if exists (Rates API uses this)
      if (shipment.shipper) {
        if (shipment.shipper.accountNumber && fedexAccount) {
          if (typeof shipment.shipper.accountNumber === 'object') {
            shipment.shipper.accountNumber.value = fedexAccount;
          } else {
            shipment.shipper.accountNumber = fedexAccount;
          }
        }
      }

      // Inject into Payor (Ship/Rate API uses this)
      if (shipment.shippingChargesPayment?.payor?.responsibleParty && fedexAccount) {
        const rp = shipment.shippingChargesPayment.payor.responsibleParty;
        if (rp.accountNumber) {
            rp.accountNumber.value = fedexAccount;
        } else {
            rp.accountNumber = { value: fedexAccount };
        }
      }

      // Rates API specific structure check
      if (shipment.shippingChargesPayment?.payor?.responsibleParty?.contact && !shipment.shippingChargesPayment.payor.responsibleParty.accountNumber && fedexAccount) {
        shipment.shippingChargesPayment.payor.responsibleParty.accountNumber = { value: fedexAccount };
      }
      
      // Additional safety for Master Account Number (Track/Cancel)
      if (shipment.masterTrackingNumber && shipment.accountNumber && fedexAccount) {
          shipment.accountNumber.value = fedexAccount;
      }
    }

    if (action === 'rates') result = await fedex.request('/rate/v1/rates/quotes', { method: 'POST', body: JSON.stringify(params) });
    else if (action === 'ship') result = await fedex.request('/ship/v1/shipments', { method: 'POST', body: JSON.stringify(params) });
    else if (action === 'track') {
      const trackingNum = params.trackingNumber || params;
      result = await fedex.request('/track/v1/trackingnumbers', { method: 'POST', body: JSON.stringify({ trackingInfo: [{ trackingNumberInfo: { trackingNumber: trackingNum } }], includeDetailedScans: true }) });
    }
    else if (action === 'cancel') {
        const payload = { 
            accountNumber: { value: fedex.accountNumber }, 
            trackingNumber: params.trackingNumber 
        };
        result = await fedex.request('/ship/v1/shipments/cancel', { method: 'PUT', body: JSON.stringify(payload) });
    }
    else if (action === 'validate-address') result = await fedex.request('/address/v1/addresses/resolve', { method: 'POST', body: JSON.stringify(params) });
    else throw new Error(`Unknown FedEx action: ${action}`);

    res.json(result);
  } catch (e) {
    console.error(`[FedEx Proxy] Action ${action} failed:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Standalone Sawyer Server running on http://0.0.0.0:${PORT}`));
