// Frontend client for calling Server-side carrier API routes
// This client talks to OUR backend, which then talks to the carriers.

import { MagentoOrder, normalizeMagentoOrder } from '@/src/lib/api-clients';

export class ServerSideUPSClient {
  constructor(private baseUrl: string = '') {}

  private async request(action: string, params: any = {}): Promise<any> {
    const url = this.baseUrl ? `${this.baseUrl}/api/ups/${action}` : `/api/ups/${action}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ params }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server UPS Error: ${response.status}`);
    }

    return response.json();
  }

  async getRates(params: any): Promise<any> {
    return this.request('rates', params);
  }

  async createShipment(params: any): Promise<any> {
    return this.request('ship', params);
  }

  async trackShipment(trackingNumber: string): Promise<any> {
    return this.request('track', { trackingNumber });
  }

  async cancelShipment(trackingNumber: string): Promise<any> {
    return this.request('cancel', { trackingNumber });
  }

  async validateAddress(params: any): Promise<any> {
    return this.request('validate-address', params);
  }
}

export class ServerSideFedExClient {
  constructor(private baseUrl: string = '') {}

  private async request(action: string, params: any = {}): Promise<any> {
    const url = this.baseUrl ? `${this.baseUrl}/api/fedex/${action}` : `/api/fedex/${action}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ params }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server FedEx Error: ${response.status}`);
    }

    return response.json();
  }

  async getRates(params: any): Promise<any> {
    return this.request('rates', params);
  }

  async createShipment(params: any): Promise<any> {
    return this.request('ship', params);
  }

  async trackShipment(trackingNumber: string): Promise<any> {
    return this.request('track', { trackingNumber });
  }

  async cancelShipment(trackingNumber: string): Promise<any> {
    return this.request('cancel', { trackingNumber });
  }

  async validateAddress(params: any): Promise<any> {
    return this.request('validate-address', params);
  }
}

export class ServerSideMagentoClient {
  constructor(private baseUrl: string = '') {}

  private async request(action: string, params: any = {}): Promise<any> {
    const url = this.baseUrl ? `${this.baseUrl}/api/magento/${action}` : `/api/magento/${action}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ params }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server Magento Error: ${response.status}`);
    }

    return response.json();
  }

  async searchOrders(query: string): Promise<MagentoOrder[]> {
    const data = await this.request('orders', { query });
    const items = data.items || [];
    return items.map((item: any) => normalizeMagentoOrder(item));
  }

  async getOrder(id: string): Promise<MagentoOrder> {
    const data = await this.request('order', { id });
    return normalizeMagentoOrder(data);
  }

  async getProducts(skus: string[]): Promise<any[]> {
    const data = await this.request('products', { skus });
    return data.items || [];
  }

  async getAttributeOptions(attributeCode: string): Promise<any[]> {
    return this.request('attribute-options', { attributeCode });
  }

  async createShipment(orderId: number | string, tracks: any[]): Promise<any> {
    return this.request('ship', { orderId, tracks });
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
