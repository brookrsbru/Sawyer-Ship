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
    is_residential?: boolean;
  };
  items: Array<{
    name: string;
    sku: string;
    qty_ordered: number;
    price: number;
    weight: number;
  }>;
  product_details?: Record<string, any>;
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
    const orders = items.map((item: any) => this.normalizeOrder(item));

    // Bulk fetch products for all orders to limit API requests
    const allSkus = Array.from(new Set(orders.flatMap(o => o.items.map(i => i.sku)))) as string[];
    if (allSkus.length > 0) {
      try {
        const products = await this.getProducts(allSkus);
        const productMap: Record<string, any> = {};
        products.forEach(p => productMap[p.sku] = p);
        
        orders.forEach(o => {
          o.product_details = {};
          o.items.forEach(i => {
            if (productMap[i.sku]) {
              o.product_details![i.sku] = productMap[i.sku];
            }
          });
        });
      } catch (e) {
        console.error(`[MagentoClient] Failed to enrich orders with product details:`, e);
      }
    }

    return orders;
  }

  async getOrder(id: string): Promise<MagentoOrder> {
    console.log(`[MagentoClient] Fetching order: ${id}`);
    let orderData;
    
    try {
      // Try fetching by internal entity_id first
      orderData = await this.fetch(`orders/${id}`);
    } catch (error: any) {
      // If 404, try searching by increment_id
      if (error.message?.includes('404')) {
        console.log(`[MagentoClient] Order ${id} not found by entity_id, trying increment_id search...`);
        const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=increment_id&searchCriteria[filter_groups][0][filters][0][value]=${id}&searchCriteria[filter_groups][0][filters][0][condition_type]=eq`;
        const data = await this.fetch(`orders?${searchCriteria}`);
        if (data.items && data.items.length > 0) {
          orderData = data.items[0];
        } else {
          throw error; // Re-throw the original 404 if not found by increment_id either
        }
      } else {
        throw error;
      }
    }

    const order = this.normalizeOrder(orderData);

    // Bulk fetch products for this order to limit API requests
    const skus = order.items.map(i => i.sku) as string[];
    if (skus.length > 0) {
      try {
        const products = await this.getProducts(skus);
        order.product_details = {};
        products.forEach(p => {
          order.product_details![p.sku] = p;
        });
      } catch (e) {
        console.error(`[MagentoClient] Failed to enrich order with product details:`, e);
      }
    }

    return order;
  }

  async getDevOrderData(id: string): Promise<any> {
    console.log(`[MagentoClient] Fetching raw dev data for order: ${id}`);
    let rawOrder;
    
    try {
      rawOrder = await this.fetch(`orders/${id}`);
    } catch (error: any) {
      if (error.message?.includes('404')) {
        const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=increment_id&searchCriteria[filter_groups][0][filters][0][value]=${id}&searchCriteria[filter_groups][0][filters][0][condition_type]=eq`;
        const data = await this.fetch(`orders?${searchCriteria}`);
        if (data.items && data.items.length > 0) {
          rawOrder = data.items[0];
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    const skus = rawOrder.items?.map((i: any) => i.sku) || [];
    let rawProducts: any[] = [];
    if (skus.length > 0) {
      try {
        rawProducts = await this.getProducts(skus);
      } catch (e) {
        console.error(`[MagentoClient] Failed to fetch raw products for dev:`, e);
      }
    }

    return {
      raw_order: rawOrder,
      raw_products: rawProducts,
      normalized_order: this.normalizeOrder(rawOrder)
    };
  }

  async getAttributeOptions(attributeCode: string): Promise<any[]> {
    try {
      const data = await this.fetch(`products/attributes/${attributeCode}/options`);
      return data || [];
    } catch (e) {
      console.error(`[MagentoClient] Failed to fetch options for ${attributeCode}:`, e);
      return [];
    }
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
          console.log(`[MagentoClient] Single encoding failed for ${trimmedSku}, trying searchCriteria fallback...`);
          try {
            // Final fallback: Use searchCriteria which is more robust for special characters
            const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=sku&searchCriteria[filter_groups][0][filters][0][value]=${encodeURIComponent(trimmedSku)}&searchCriteria[filter_groups][0][filters][0][condition_type]=eq`;
            const data = await this.fetch(`products?${searchCriteria}`);
            if (data.items && data.items.length > 0) {
              console.log(`[MagentoClient] Product found via searchCriteria: ${trimmedSku}`);
              return data.items[0];
            }
          } catch (searchError) {
            console.warn(`[MagentoClient] searchCriteria fallback failed for: ${trimmedSku}`);
          }
          
          console.warn(`[MagentoClient] Product not found with any method: ${trimmedSku}`);
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

  async getProducts(skus: string[]): Promise<any[]> {
    if (skus.length === 0) return [];
    const uniqueSkus = Array.from(new Set(skus.map(s => s.trim())));
    console.log(`[MagentoClient] Fetching multiple products (${uniqueSkus.length}): ${uniqueSkus.join(', ')}`);
    
    try {
      // Use searchCriteria with 'in' condition for bulk fetch
      const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=sku&searchCriteria[filter_groups][0][filters][0][value]=${uniqueSkus.map(s => encodeURIComponent(s)).join(',')}&searchCriteria[filter_groups][0][filters][0][condition_type]=in`;
      const data = await this.fetch(`products?${searchCriteria}`);
      return data.items || [];
    } catch (error) {
      console.error(`[MagentoClient] Bulk product fetch failed:`, error);
      return [];
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
  constructor(private apiKey: string, private secretKey: string, private accountNumber: string, private isSandbox: boolean = true, private proxyUrl: string = '') {}

  private get baseUrl() {
    return this.isSandbox ? 'https://sandbox.api.ups.com' : 'https://api.ups.com';
  }

  private getProxyUrl() {
    return this.proxyUrl ? (this.proxyUrl.endsWith('/') ? this.proxyUrl : `${this.proxyUrl}/`) : '';
  }

  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  async getAccessToken(): Promise<string> {
    // Return cached token if valid (give 5 min buffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 300000) {
      return this.accessToken;
    }

    const url = `${this.getProxyUrl()}${this.baseUrl}/security/v1/oauth/token`;
    const auth = btoa(`${this.apiKey}:${this.secretKey}`);
    
    console.log(`[UPSClient] Requesting token from: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for auth

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        if (response.status === 504 || response.status === 502) {
          throw new Error(`UPS Auth Proxy Timeout (${response.status}): The authentication request timed out. Please check your credentials and proxy.`);
        }
        console.error(`[UPSClient] Token request failed (${response.status}):`, errorText);
        throw new Error(`UPS Auth Error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      if (!data.access_token) {
        console.error(`[UPSClient] No access_token in UPS response:`, data);
        throw new Error('UPS Auth Error: No access token returned');
      }

      this.accessToken = data.access_token;
      // Set expiry (default 3600 seconds)
      const expiresIn = parseInt(data.expires_in || '3600');
      this.tokenExpiresAt = Date.now() + (expiresIn * 1000);

      return this.accessToken;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('UPS Auth Timeout: The authentication request took longer than 15 seconds and was aborted.');
      }
      throw error;
    }
  }

  private cleanObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanObject(item));
    }
    
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, this.cleanObject(v)])
    );
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();
    const url = `${this.getProxyUrl()}${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(this.accountNumber ? { 'x-merchant-id': this.accountNumber } : {}),
          'transId': `sawyer-${Date.now()}`,
          'transactionSrc': 'sawyer-ship',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch (e) {
          // If not JSON, it might be a proxy HTML error
          const text = await response.text().catch(() => '');
          if (response.status === 504 || response.status === 502) {
            throw new Error(`UPS Proxy Timeout (${response.status}): The request timed out at the gateway. Please try again.`);
          }
          throw new Error(`UPS API Error (${response.status}): ${text || response.statusText}`);
        }
        
        const msg = errorData?.response?.errors?.[0]?.message 
                 || errorData?.errors?.[0]?.message 
                 || `UPS Error (${response.status}): ${response.statusText}`;
        throw new Error(msg);
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('UPS Request Timeout: The request took longer than 30 seconds and was aborted.');
      }
      throw error;
    }
  }

  async getRates(params: any): Promise<any> {
    console.log(`[UPSClient] Fetching rates`, params);
    return this.request('/api/rating/v1/shop', {
      method: 'POST',
      body: JSON.stringify(this.cleanObject(params)),
    });
  }

  async createShipment(params: any): Promise<any> {
    console.log(`[UPSClient] Creating shipment`, params);
    return this.request('/api/shipments/v1/ship', {
      method: 'POST',
      body: JSON.stringify(this.cleanObject(params)),
    });
  }

  async trackShipment(trackingNumber: string): Promise<any> {
    console.log(`[UPSClient] Tracking shipment: ${trackingNumber}`);
    return this.request(`/api/track/v1/details/${trackingNumber}?locale=en_US&returnSignature=false&returnMilestones=false`, {
      method: 'GET'
    });
  }

  async cancelShipment(trackingNumber: string): Promise<any> {
    console.log(`[UPSClient] Voiding shipment: ${trackingNumber}`);
    return this.request(`/api/shipments/v1/void/cancel/${trackingNumber}`, {
      method: 'PUT'
    });
  }

  async validateAddress(params: any): Promise<any> {
    console.log(`[UPSClient] Validating address`, params);
    return this.request('/api/addressvalidation/v1/1', {
      method: 'POST',
      body: JSON.stringify(this.cleanObject(params)),
    });
  }
}

export class FedExClient {
  constructor(private apiKey: string, private secretKey: string, private accountNumber: string, private isSandbox: boolean = true, private proxyUrl: string = '') {}

  private get baseUrl() {
    return this.isSandbox ? 'https://apis-sandbox.fedex.com' : 'https://apis.fedex.com';
  }

  private getProxyUrl() {
    return this.proxyUrl ? (this.proxyUrl.endsWith('/') ? this.proxyUrl : `${this.proxyUrl}/`) : '';
  }

  async getAccessToken(): Promise<string> {
    const url = `${this.getProxyUrl()}${this.baseUrl}/oauth/token`;
    console.log(`[FedExClient] Requesting token for Key: ${this.apiKey.substring(0, 4)}... from: ${url}`);
    
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[FedExClient] Token request failed (${response.status}):`, errorText);
      throw new Error(`FedEx Auth Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      console.error(`[FedExClient] No access_token in response:`, data);
      throw new Error('FedEx Auth Error: No access token returned');
    }

    return data.access_token.trim();
  }

  async getRates(params: any): Promise<any> {
    const rootAccount = params.accountNumber?.value;
    const payorAccount = params.requestedShipment?.shippingChargesPayment?.payor?.responsibleParty?.accountNumber?.value;
    console.log(`[FedExClient] Fetching rates. Root Account: ${rootAccount}, Payor Account: ${payorAccount}`);
    
    const token = await this.getAccessToken();
    const url = `${this.getProxyUrl()}${this.baseUrl}/rate/v1/rates/quotes`;
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

  async createShipment(params: any): Promise<any> {
    const rootAccount = params.accountNumber?.value;
    const payorAccount = params.requestedShipment?.shippingChargesPayment?.payor?.responsibleParty?.accountNumber?.value;
    console.log(`[FedExClient] Creating shipment. Root Account: ${rootAccount}, Payor Account: ${payorAccount}`);
    
    const token = await this.getAccessToken();
    const url = `${this.getProxyUrl()}${this.baseUrl}/ship/v1/shipments`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    console.log(`[FedExClient] Shipment response:`, data);
    return data;
  }

  async validateAddress(params: any): Promise<any> {
    console.log(`[FedExClient] Validating address`, params);
    const token = await this.getAccessToken();
    const url = `${this.getProxyUrl()}${this.baseUrl}/address/v1/addresses/resolve`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    console.log(`[FedExClient] Address validation response:`, data);
    return data;
  }

  async trackShipment(trackingNumber: string): Promise<any> {
    console.log(`[FedExClient] Tracking shipment: ${trackingNumber} on ${this.baseUrl}`);
    const token = await this.getAccessToken();
    const url = `${this.getProxyUrl()}${this.baseUrl}/track/v1/trackingnumbers`;
    
    const transactionId = `sawyer-${Date.now()}`;
    
    const trackBody: any = {
      trackingInfo: [{ 
        trackingNumberInfo: { 
          trackingNumber 
        } 
      }],
      includeDetailedScans: true
    };

    // Include account number if provided, as some enterprise keys require it for authorization
    if (this.accountNumber) {
      trackBody.trackingInfo[0].accountNumber = this.accountNumber;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-customer-transaction-id': transactionId,
        'x-locale': 'en_US'
      },
      body: JSON.stringify(trackBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorCode = errorData?.errors?.[0]?.code;
      const msg = errorData?.errors?.[0]?.message || `FedEx Error: ${response.status} ${response.statusText}`;
      
      console.error(`[FedExClient] Track Error (${response.status} - ${errorCode}):`, errorData);
      
      // If 403, add more context about potential environment mismatch
      if (response.status === 403 || errorCode === 'FORBIDDEN.ERROR') {
        throw new Error(`${msg}. IMPORTANT: Verify in your FedEx Developer Portal that "Track API" is explicitly added to your project permissions for this API Key.`);
      }
      
      throw new Error(msg);
    }

    const data = await response.json();
    console.log(`[FedExClient] Tracking response:`, data);

    const trackResult = data?.output?.completeTrackResults?.[0]?.trackResults?.[0];
    if (trackResult?.error) {
      throw new Error(trackResult.error.message || 'FedEx Tracking Error');
    }

    return data;
  }

  async cancelShipment(trackingNumber: string): Promise<any> {
    console.log(`[FedExClient] Cancelling shipment: ${trackingNumber}`);
    const token = await this.getAccessToken();
    // FedEx Cancel Shipment endpoint: PUT /ship/v1/shipments/cancel
    const url = `${this.getProxyUrl()}${this.baseUrl}/ship/v1/shipments/cancel`;
    
    const body = {
      accountNumber: {
        value: this.accountNumber
      },
      trackingNumber: trackingNumber
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.errors?.[0]?.message || `FedEx Cancel Error: ${response.status}`);
    }
    console.log(`[FedExClient] Cancel response:`, data);
    return data;
  }
}
