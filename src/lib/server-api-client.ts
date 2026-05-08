// Frontend client for calling Server-side carrier API routes via Transparent Proxy
// This client talks to OUR backend, which then injects credentials and forwards to the carriers.

import { normalizeMagentoOrder } from './magento-utils';

export class ServerSideUPSClient {
  constructor(private serverBaseUrl: string = '') {}

  private async request(endpoint: string, method: string = 'POST', params: any = {}): Promise<any> {
    const url = `${this.serverBaseUrl}/api/proxy/ups${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method !== 'GET' ? JSON.stringify(params) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || `UPS Proxy Error: ${response.status}`);
    }

    return data;
  }

  async getRates(params: any): Promise<any> {
    return this.request('/api/rating/v1/shop', 'POST', params);
  }

  async createShipment(params: any): Promise<any> {
    return this.request('/api/shipments/v1/ship', 'POST', params);
  }

  async trackShipment(trackingNumber: string): Promise<any> {
    return this.request(`/api/track/v1/details/${trackingNumber}?locale=en_US`, 'GET');
  }

  async cancelShipment(trackingNumber: string): Promise<any> {
    return this.request(`/api/shipments/v1/void/cancel/${trackingNumber}`, 'PUT');
  }

  async validateAddress(params: any): Promise<any> {
    return this.request('/api/addressvalidation/v1/1', 'POST', params);
  }
}

export class ServerSideFedExClient {
  constructor(private serverBaseUrl: string = '') {}

  private async request(endpoint: string, method: string = 'POST', params: any = {}): Promise<any> {
    const url = `${this.serverBaseUrl}/api/proxy/fedex${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method !== 'GET' ? JSON.stringify(params) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || `FedEx Proxy Error: ${response.status}`);
    }

    return data;
  }

  async getRates(params: any): Promise<any> {
    return this.request('/rate/v1/rates/quotes', 'POST', params);
  }

  async createShipment(params: any): Promise<any> {
    return this.request('/ship/v1/shipments', 'POST', params);
  }

  async trackShipment(trackingNumber: string, accountNumber?: string): Promise<any> {
    const trackBody: any = {
      trackingInfo: [{ trackingNumberInfo: { trackingNumber } }],
      includeDetailedScans: true
    };
    if (accountNumber) trackBody.trackingInfo[0].accountNumber = accountNumber;
    return this.request('/track/v1/trackingnumbers', 'POST', trackBody);
  }

  async cancelShipment(trackingNumber: string, accountNumber: string): Promise<any> {
    const body = {
      accountNumber: { value: accountNumber },
      trackingNumber: trackingNumber
    };
    return this.request('/ship/v1/shipments/cancel', 'PUT', body);
  }

  async validateAddress(params: any): Promise<any> {
    return this.request('/address/v1/addresses/resolve', 'POST', params);
  }
}

export class ServerSideMagentoClient {
  constructor(private serverBaseUrl: string = '') {}

  private async request(endpoint: string, method: string = 'GET', params: any = {}): Promise<any> {
    const url = `${this.serverBaseUrl}/api/proxy/magento/${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method !== 'GET' ? JSON.stringify(params) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || `Magento Proxy Error: ${response.status}`);
    }

    return data;
  }

  async searchOrders(query: string): Promise<any[]> {
    const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=increment_id&searchCriteria[filter_groups][0][filters][0][value]=%25${query}%25&searchCriteria[filter_groups][0][filters][0][condition_type]=like`;
    const data = await this.request(`orders?${searchCriteria}`);
    const items = data.items || [];
    return items.map((item: any) => normalizeMagentoOrder(item));
  }

  async getOrder(id: string): Promise<any> {
    try {
      const data = await this.request(`orders/${id}`);
      return normalizeMagentoOrder(data);
    } catch (error: any) {
      if (error.message.includes('404')) {
        const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=increment_id&searchCriteria[filter_groups][0][filters][0][value]=${id}&searchCriteria[filter_groups][0][filters][0][condition_type]=eq`;
        const data = await this.request(`orders?${searchCriteria}`);
        if (data.items && data.items.length > 0) return normalizeMagentoOrder(data.items[0]);
      }
      throw error;
    }
  }

  async getProducts(skus: string[]): Promise<any[]> {
    const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=sku&searchCriteria[filter_groups][0][filters][0][value]=${skus.map(s => encodeURIComponent(s)).join(',')}&searchCriteria[filter_groups][0][filters][0][condition_type]=in`;
    const data = await this.request(`products?${searchCriteria}`);
    return data.items || [];
  }

  async getAttributeOptions(attributeCode: string): Promise<any[]> {
    return this.request(`products/attributes/${attributeCode}/options`);
  }

  async createShipment(orderId: number | string, tracks: any[]): Promise<any> {
    return this.request(`order/${orderId}/ship`, 'POST', {
      items: [],
      notify: true,
      appendComment: true,
      comment: { 
        extension_attributes: {}, 
        comment: "Shipment created via Sawyer-Ship (Server Proxy)", 
        is_visible_on_front: 1 
      },
      tracks
    });
  }
}

// Global utility to save and load server data via API
export const ServerDataClient = {
  async saveCredentials(credentials: any, baseUrl: string = '') {
    const url = baseUrl ? `${baseUrl}/api/settings/credentials` : '/api/settings/credentials';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save server credentials');
    }
    return response.json();
  },

  async loadCredentials(baseUrl: string = '') {
    const url = baseUrl ? `${baseUrl}/api/settings/credentials` : '/api/settings/credentials';
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load server credentials');
    const data = await response.json();
    return data.credentials;
  },

  async saveAppData(data: any, baseUrl: string = '', password?: string): Promise<boolean> {
    try {
      const url = baseUrl ? `${baseUrl}/api/data/save` : '/api/data/save';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, password })
      });
      return response.ok;
    } catch (e) {
      console.error('Failed to save app data to server:', e);
      return false;
    }
  },

  async loadAppData(baseUrl: string = '', password?: string): Promise<any | null> {
    try {
      const url = baseUrl ? `${baseUrl}/api/data/load` : '/api/data/load';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!response.ok) return null;
      const result = await response.json();
      return result.data;
    } catch (e) {
      console.error('Failed to load app data from server:', e);
      return null;
    }
  }
};
