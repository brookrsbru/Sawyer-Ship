// Server-side UPS Client
// This client runs in Node.js and avoids proxy limitations.

export class ServerUPSClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    private apiKey: string, 
    private secretKey: string, 
    private accountNumber: string, 
    private isSandbox: boolean = true
  ) {}

  private get baseUrl() {
    return this.isSandbox ? 'https://sandbox.api.ups.com' : 'https://api.ups.com';
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 300000) {
      return this.accessToken;
    }

    const url = `${this.baseUrl}/security/v1/oauth/token`;
    const auth = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64');
    
    console.log(`[ServerUPSClient] Requesting token from: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`UPS Auth Error (${response.status}): ${errorText}`);
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
    
    console.log(`[ServerUPSClient] ${options.method || 'GET'} ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(this.accountNumber ? { 'x-merchant-id': this.accountNumber } : {}),
        'transId': `sawyer-${Date.now()}`,
        'transactionSrc': 'sawyer-ship',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({}));
      const msg = errorData?.response?.errors?.[0]?.message 
               || errorData?.errors?.[0]?.message 
               || `UPS Error (${response.status}): ${response.statusText}`;
      throw new Error(msg);
    }

    return await response.json();
  }

  async getRates(params: any) {
    return this.request('/api/rating/v1/shop', {
      method: 'POST',
      body: JSON.stringify(this.cleanObject(params)),
    });
  }

  async createShipment(params: any) {
    return this.request('/api/shipments/v1/ship', {
      method: 'POST',
      body: JSON.stringify(this.cleanObject(params)),
    });
  }

  async trackShipment(trackingNumber: string) {
    return this.request(`/api/track/v1/details/${trackingNumber}?locale=en_US&returnSignature=false&returnMilestones=false`);
  }

  async cancelShipment(trackingNumber: string) {
    return this.request(`/api/shipments/v1/void/cancel/${trackingNumber}`, {
      method: 'PUT'
    });
  }

  async validateAddress(params: any) {
    return this.request('/api/addressvalidation/v1/1', {
      method: 'POST',
      body: JSON.stringify(this.cleanObject(params)),
    });
  }
}
