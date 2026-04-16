
export interface ZebraPrinter {
  uid: string;
  name: string;
  connection: string;
  version: string;
  provider: string;
  manufacturer: string;
}

export class ZebraService {
  private static BASE_URL = 'http://localhost:9101';

  static async getAvailablePrinters(): Promise<ZebraPrinter[]> {
    try {
      const response = await fetch(`${this.BASE_URL}/available`, {
        method: 'GET',
      });
      if (!response.ok) throw new Error('Failed to fetch printers');
      const data = await response.json();
      return data.printer || [];
    } catch (error) {
      console.error('Zebra Browser Print not found or error:', error);
      return [];
    }
  }

  static async getDefaultPrinter(): Promise<ZebraPrinter | null> {
    try {
      const response = await fetch(`${this.BASE_URL}/default`, {
        method: 'GET',
      });
      if (!response.ok) return null;
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

      const response = await fetch(`${this.BASE_URL}/write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({
          device: { uid: targetUid },
          data: zplData
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Zebra Print Error:', error);
      throw error;
    }
  }

  static async checkStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.BASE_URL}/available`, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }
}
