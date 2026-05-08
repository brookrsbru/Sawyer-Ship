// Server-side FedEx Client
// This client runs in Node.js and avoids proxy limitations.

export class ServerFedExClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    private apiKey: string,
    private secretKey: string,
    private accountNumber: string,
    private isSandbox: boolean = true
  ) {}

  private get baseUrl() {
    return this.isSandbox ? 'https://apis-sandbox.fedex.com' : 'https://apis.fedex.com';
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 300000) {
      return this.accessToken;
    }

    const url = `${this.baseUrl}/oauth/token`;
    
    console.log(`[ServerFedExClient] Requesting token from: ${url}`);
    
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
      throw new Error(`FedEx Auth Error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    this.accessToken = data.access_token;
    const expiresIn = parseInt(data.expires_in || '3600');
    this.tokenExpiresAt = Date.now() + (expiresIn * 1000);

    return this.accessToken;
  }

  private cleanObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.cleanObject(item));
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, this.cleanObject(v)])
    );
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log(`[ServerFedExClient] ${options.method || 'GET'} ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-customer-transaction-id': `sawyer-${Date.now()}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({}));
      const msg = errorData?.errors?.[0]?.message 
               || `FedEx Error (${response.status}): ${response.statusText}`;
      throw new Error(msg);
    }

    return await response.json();
  }

  async getRates(params: any) {
    return this.request('/rate/v1/rates/quotes', {
      method: 'POST',
      body: JSON.stringify(this.cleanObject(params)),
    });
  }

  async createShipment(params: any) {
    return this.request('/ship/v1/shipments', {
      method: 'POST',
      body: JSON.stringify(this.cleanObject(params)),
    });
  }

  async trackShipment(trackingNumber: string) {
    return this.request('/track/v1/trackingnumbers', {
      method: 'POST',
      body: JSON.stringify({
        trackingInfo: [
          {
            trackingNumberInfo: {
              trackingNumber: trackingNumber
            }
          }
        ],
        includeDetailedScans: true
      })
    });
  }

  async cancelShipment(trackingNumber: string) {
    // FedEx cancellation requires more info usually (contextual info)
    // but the track/v1/shipments/cancel or ship/v1/shipments/cancel is the endpoint
    return this.request('/ship/v1/shipments/cancel', {
      method: 'PUT',
      body: JSON.stringify({
        accountNumber: {
          value: this.accountNumber
        },
        trackingNumber: trackingNumber
      })
    });
  }
}
