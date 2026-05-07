// Frontend client for calling Northern Ireland/Server-side UPS API routes
// This client talks to OUR backend, which then talks to UPS.

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
}

// Global utility to save and load server credentials via API
export const ServerSettingsClient = {
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
  }
};
