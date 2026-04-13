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
    const url = `${this.proxyUrl}${this.baseUrl}/rest/V1/${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!response.ok) throw new Error(`Magento API Error: ${response.statusText}`);
    return response.json();
  }

  async searchOrders(query: string): Promise<MagentoOrder[]> {
    // Search by increment_id or customer email
    const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=increment_id&searchCriteria[filter_groups][0][filters][0][value]=%25${query}%25&searchCriteria[filter_groups][0][filters][0][condition_type]=like`;
    const data = await this.fetch(`orders?${searchCriteria}`);
    return data.items || [];
  }

  async getOrder(id: string): Promise<MagentoOrder> {
    return this.fetch(`orders/${id}`);
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
    const token = await this.getAccessToken();
    const url = `${this.proxyUrl}${this.baseUrl}/api/rating/v1/shop`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    return response.json();
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
    const token = await this.getAccessToken();
    const url = `${this.proxyUrl}${this.baseUrl}/rate/v1/rates/quotes`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    return response.json();
  }
}
