
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
    if (isHttps) {
      // REQUIREMENT 3: If origin is https, prioritize https://localhost:9101
      return [
        'https://localhost:9101',
        'https://127.0.0.1:9101',
        'https://localhost:9100',
        'https://127.0.0.1:9100',
        'http://localhost:9101',
        'http://127.0.0.1:9101',
        'http://localhost:9100',
        'http://127.0.0.1:9100'
      ];
    }
    return [
      'http://localhost:9101',
      'http://127.0.0.1:9101',
      'http://localhost:9100',
      'http://127.0.0.1:9100'
    ];
  }

  /**
   * Triggers the Zebra Browser Print "Allow this site?" popup on the user's desktop.
   * Uses POST to /available as required to force the permission handshake.
   */
  static async triggerHandshake() {
    await this.getAvailablePrinters();
  }

  private static async tryFetch(path: string, options: RequestInit = {}): Promise<Response | null> {
    const urls = this.getBaseUrls();
    for (const baseUrl of urls) {
      try {
        console.log(`[ZebraService] Trying ${baseUrl}${path}...`);
        
        const response = await fetch(`${baseUrl}${path}`, {
          ...options,
          headers: {
            'Content-Type': 'text/plain',
            // REQUIREMENT 1 & 4: Include Private Network Access headers
            'Access-Control-Request-Private-Network': 'true',
            ...(options.headers || {})
          },
          // Chrome PNA flag
          // @ts-ignore
          targetAddressSpace: 'local',
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
      // REQUIREMENT 3 & 4: Use POST for discovery to trigger the permission handshake
      const response = await this.tryFetch('/available', { 
        method: 'POST',
        body: JSON.stringify({}) 
      });
      
      if (!response) {
        // Fallback to GET for simple status check if POST is blocked or fails
        const getResponse = await this.tryFetch('/available', { method: 'GET' });
        if (!getResponse) return [];
        const data = await getResponse.json();
        return data.printer || [];
      }
      
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

      // REQUIREMENT 2 & 4: Ensure /write receives a JSON body containing device.uid and data
      const response = await this.tryFetch('/write', {
        method: 'POST',
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
