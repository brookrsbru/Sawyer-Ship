/**
 * API Clients for Magento, UPS, and FedEx.
 * Note: These calls are made directly from the browser.
 * CORS issues are expected unless a proxy is used or the APIs support it.
 */

export interface MagentoOrder {
  entity_id: number;
  increment_id: string;
  customer_email: string;
  customer_firstname: string;
  customer_lastname: string;
  grand_total: number;
  status: string;
  created_at: string;
  shipping_address: {
    firstname: string;
    lastname: string;
    company?: string;
    street: string[];
    city: string;
    region: string;
    postcode: string;
    country_id: string;
    telephone: string;
  };
  items: Array<{
    name: string;
    sku: string;
    qty_ordered: number;
    price: number;
    weight: number;
  }>;
}

export class MagentoClient {
  constructor(private baseUrl: string, private token: string, private proxyUrl: string = '') {}

  private async fetch(endpoint: string, options: RequestInit = {}) {
    // Sanitize URLs to prevent double slashes
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, '');
    const cleanProxyUrl = this.proxyUrl ? (this.proxyUrl.endsWith('/') ? this.proxyUrl : `${this.proxyUrl}/`) : '';
    
    const url = `${cleanProxyUrl}${cleanBaseUrl}/rest/V1/${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Magento API Error (${response.status}): ${errorData.message || response.statusText}`);
    }
    return response.json();
  }

  async searchOrders(query: string): Promise<MagentoOrder[]> {
    // Search by increment_id or customer email
    const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=increment_id&searchCriteria[filter_groups][0][filters][0][value]=%25${query}%25&searchCriteria[filter_groups][0][filters][0][condition_type]=like`;
    const data = await this.fetch(`orders?${searchCriteria}`);
    const items = data.items || [];
    return items.map((item: any) => this.normalizeOrder(item));
  }

  async getOrder(id: string): Promise<MagentoOrder> {
    console.log(`[MagentoClient] Fetching order: ${id}`);
    const order = await this.fetch(`orders/${id}`);
    console.log(`[MagentoClient] Order data received:`, order);
    return this.normalizeOrder(order);
  }

  private normalizeOrder(order: any): MagentoOrder {
    // Magento 2 orders often have shipping address in extension_attributes
    const shippingAddress = order.extension_attributes?.shipping_assignments?.[0]?.shipping?.address 
      || order.shipping_address 
      || order.billing_address 
      || {};

    // Ensure street is an array (sometimes it comes as a string or is missing)
    let street = shippingAddress.street || [];
    if (typeof street === 'string') {
      street = [street];
    }

    return {
      ...order,
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

  async getProduct(sku: string): Promise<any> {
    const trimmedSku = sku.trim();
    console.log(`[MagentoClient] Fetching product: ${trimmedSku}`);
    
    try {
      // Try double encoding first (Magento 2 standard for slashes)
      const doubleEncoded = encodeURIComponent(encodeURIComponent(trimmedSku));
      return await this.fetch(`products/${doubleEncoded}`);
    } catch (error: any) {
      // If 404 and contains slashes, try single encoding as fallback
      if (error.message?.includes('404') && trimmedSku.includes('/')) {
        try {
          console.log(`[MagentoClient] Double encoding failed for ${trimmedSku}, trying single encoding...`);
          const singleEncoded = encodeURIComponent(trimmedSku);
          return await this.fetch(`products/${singleEncoded}`);
        } catch (innerError) {
          console.warn(`[MagentoClient] Product not found with single encoding either: ${trimmedSku}`);
          return null;
        }
      }
      
      if (error.message?.includes('404')) {
        console.warn(`[MagentoClient] Product not found: ${trimmedSku}`);
        return null;
      }
      
      throw error;
    }
  }

  async createShipment(orderId: number, tracks: Array<{ track_number: string, title: string, carrier_code: string }>): Promise<any> {
    console.log(`[MagentoClient] Creating shipment for order ${orderId}`, tracks);
    const result = await this.fetch(`order/${orderId}/ship`, {
      method: 'POST',
      body: JSON.stringify({
        items: [], // Empty array ships all items
        notify: true,
        appendComment: true,
        comment: {
          extension_attributes: {},
          comment: "Shipment created via Sawyer-Ship",
          is_visible_on_front: 1
        },
        tracks: tracks.map(t => ({
          track_number: t.track_number,
          title: t.title,
          carrier_code: t.carrier_code
        }))
      })
    });
    console.log(`[MagentoClient] Shipment created successfully:`, result);
    return result;
  }
}

export class UPSClient {
  constructor(private clientId: string, private clientSecret: string, private accountNumber: string, private isSandbox: boolean = true, private proxyUrl: string = '') {}

  private get baseUrl() {
    return this.isSandbox ? 'https://wwwcie.ups.com' : 'https://onlinetools.ups.com';
  }

  async getAccessToken(): Promise<string> {
    const url = `${this.proxyUrl}${this.baseUrl}/security/v1/oauth/token`;
    const auth = btoa(`${this.clientId}:${this.clientSecret}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-merchant-id': this.clientId
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    const data = await response.json();
    return data.access_token;
  }

  async getRates(params: any): Promise<any> {
    console.log(`[UPSClient] Fetching rates`, params);
    const token = await this.getAccessToken();
    console.log(`[UPSClient] OAuth token obtained`);
    const url = `${this.proxyUrl}${this.baseUrl}/api/rating/v1/shop`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    console.log(`[UPSClient] Rates response:`, data);
    return data;
  }
}

export class FedExClient {
  constructor(private apiKey: string, private secretKey: string, private accountNumber: string, private isSandbox: boolean = true, private proxyUrl: string = '') {}

  private get baseUrl() {
    return this.isSandbox ? 'https://apis-sandbox.fedex.com' : 'https://apis.fedex.com';
  }

  async getAccessToken(): Promise<string> {
    const url = `${this.proxyUrl}${this.baseUrl}/oauth/token`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.apiKey,
        client_secret: this.secretKey,
      }),
    });
    const data = await response.json();
    return data.access_token;
  }

  async getRates(params: any): Promise<any> {
    console.log(`[FedExClient] Fetching rates`, params);
    const token = await this.getAccessToken();
    console.log(`[FedExClient] OAuth token obtained`);
    const url = `${this.proxyUrl}${this.baseUrl}/rate/v1/rates/quotes`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    console.log(`[FedExClient] Rates response:`, data);
    return data;
  }
}
