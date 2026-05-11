// Server-side Magento Client
// This client runs in Node.js and talks directly to Magento REST API.

export class ServerMagentoClient {
  private baseUrl: string;

  constructor(
    baseUrl: string,
    private token: string
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}/rest/V1/${endpoint}`;
    
    console.log(`[ServerMagentoClient] ${options.method || 'GET'} ${url}`);

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
      console.error(`[ServerMagentoClient] API Error (${response.status}):`, data);
      const msg = data.message || response.statusText || 'Magento API Error';
      throw new Error(`Magento Error (${response.status}): ${msg}`);
    }

    return data;
  }

  async searchOrders(query: string) {
    const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=increment_id&searchCriteria[filter_groups][0][filters][0][value]=%25${query}%25&searchCriteria[filter_groups][0][filters][0][condition_type]=like`;
    return this.request(`orders?${searchCriteria}`);
  }

  async getOrder(id: string) {
    try {
      return await this.request(`orders/${id}`);
    } catch (e: any) {
      if (e.message.includes('404')) {
        const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=increment_id&searchCriteria[filter_groups][0][filters][0][value]=${id}&searchCriteria[filter_groups][0][filters][0][condition_type]=eq`;
        const data = await this.request(`orders?${searchCriteria}`);
        if (data.items?.length > 0) return data.items[0];
        else throw e;
      } else throw e;
    }
  }

  async getProducts(skus: string[]) {
    const searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=sku&searchCriteria[filter_groups][0][filters][0][value]=${skus.map(s => encodeURIComponent(s)).join(',')}&searchCriteria[filter_groups][0][filters][0][condition_type]=in`;
    return this.request(`products?${searchCriteria}`);
  }

  async createShipment(orderId: number | string, tracks: any[]) {
    return this.request(`order/${orderId}/ship`, {
      method: 'POST',
      body: JSON.stringify({
        items: [],
        notify: true,
        appendComment: true,
        comment: { 
          extension_attributes: {}, 
          comment: "Shipment created via Sawyer-Ship Server", 
          is_visible_on_front: 1 
        },
        tracks: tracks
      })
    });
  }

  async getAttributeOptions(attributeCode: string) {
    return this.request(`products/attributes/${attributeCode}/options`);
  }
}
