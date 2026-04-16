
export interface ZebraPrinter {
  uid: string;
  name: string;
  connection: string;
  version: string;
  provider: string;
  manufacturer: string;
}

export class ZebraService {
  private static getBaseUrls(): string[] {
    const isHttps = window.location.protocol === 'https:';
    // Try all possible port and protocol combinations for localhost/127.0.0.1
    return [
      'https://localhost:9100', 
      'https://127.0.0.1:9100',
      'http://localhost:9101',
      'http://127.0.0.1:9101',
      'http://localhost:9100',
      'http://127.0.0.1:9100',
      'https://localhost:9101',
      'https://127.0.0.1:9101'
    ];
  }

  /**
   * Triggers the Zebra Browser Print "Allow this site?" popup on the user's desktop.
   * Uses no-cors POST to bypass most browser mixed-content/PNA blocks for the initial handshake.
   */
  static async triggerHandshake() {
    const urls = this.getBaseUrls();
    for (const baseUrl of urls) {
      try {
        await fetch(`${baseUrl}/available`, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({})
        });
      } catch (e) {
        // Expected failures for some protocols
      }
    }
  }

  private static async tryFetch(path: string, options: RequestInit = {}): Promise<Response | null> {
    const urls = this.getBaseUrls();
    for (const baseUrl of urls) {
      try {
        // Log attempt for user debugging in console
        console.log(`[ZebraService] Trying ${baseUrl}${path}...`);
        
        const response = await fetch(`${baseUrl}${path}`, {
          ...options,
          // Removed targetAddressSpace as it can sometimes block in certain browser configs
        });
        
        if (response.ok) {
          console.log(`[ZebraService] Success on ${baseUrl}${path}`);
          return response;
        }
      } catch (err) {
        // Silent
      }
    }
    return null;
  }

  static async getAvailablePrinters(): Promise<ZebraPrinter[]> {
    try {
      // Try GET first, then POST which some Zebra versions use to trigger handshakes
      let response = await this.tryFetch('/available', { method: 'GET' });
      if (!response) {
        response = await this.tryFetch('/available', { method: 'POST' });
      }
      
      if (!response) return [];
      const data = await response.json();
      return data.printer || [];
    } catch (error) {
      console.error('Zebra Browser Print error:', error);
      return [];
    }
  }

  static async getDefaultPrinter(): Promise<ZebraPrinter | null> {
    try {
      const response = await this.tryFetch('/default', { method: 'GET' });
      if (!response) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  static async printZPL(zplData: string, printerUid?: string): Promise<boolean> {
    try {
      // If no printer UID provided, try to get default
      let targetUid = printerUid;
      if (!targetUid) {
        const defaultPrinter = await this.getDefaultPrinter();
        if (defaultPrinter) {
          targetUid = defaultPrinter.uid;
        } else {
          const printers = await this.getAvailablePrinters();
          if (printers.length > 0) {
            targetUid = printers[0].uid;
          }
        }
      }

      if (!targetUid) {
        throw new Error('No Zebra printer found');
      }

      const response = await this.tryFetch('/write', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({
          device: { uid: targetUid },
          data: zplData
        })
      });

      return !!response?.ok;
    } catch (error) {
      console.error('Zebra Print Error:', error);
      throw error;
    }
  }

  static async checkStatus(): Promise<boolean> {
    const response = await this.tryFetch('/available', { method: 'GET' });
    return !!response?.ok;
  }
}
