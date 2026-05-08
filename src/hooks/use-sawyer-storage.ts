import { useState, useEffect } from 'react';
import { encrypt, decrypt } from '@/src/lib/crypto';
import { ServerDataClient } from '@/src/lib/server-api-client';

export interface ShippingDefaults {
  weightKg: string;
  weightG: string;
  length: string;
  width: string;
  height: string;
  billShippingTo: string;
  billDutiesTo: string;
  // Overwrite toggles
  overwriteWeightKg: boolean;
  overwriteWeightG: boolean;
  overwriteLength: boolean;
  overwriteWidth: boolean;
  overwriteHeight: boolean;
  overwriteBillShippingTo: boolean;
  overwriteBillDutiesTo: boolean;
}

export interface AddressBookCustomer {
  id: string;
  reference: string;
  fullname?: string;
  company?: string;
  email?: string;
  telephone?: string;
  street1: string;
  street2?: string;
  street3?: string;
  city: string;
  region?: string;
  postcode: string;
  country: string;
  residential: boolean;
}

export interface SawyerCredentials {
  magento: {
    url: string;
    token: string;
  };
  ups: {
    enabled: boolean;
    apiKey: string;
    secretKey: string;
    accountNumber: string;
    isSandbox: boolean;
  };
  fedex: {
    enabled: boolean;
    apiKey: string; // Legacy
    secretKey: string; // Legacy
    sandboxApiKey: string;
    sandboxSecretKey: string;
    productionApiKey: string;
    productionSecretKey: string;
    // Separate Tracking Credentials
    sandboxTrackingApiKey: string;
    sandboxTrackingSecretKey: string;
    productionTrackingApiKey: string;
    productionTrackingSecretKey: string;
    sandboxTrackingAccountNumber: string;
    productionTrackingAccountNumber: string;
    isTrackingSandbox: boolean;
    accountNumber: string; // Legacy, kept for migration
    domesticAccountNumber: string;
    globalAccountNumber: string;
    paymentAccountNumber: string;
    productionAccountNumber: string;
    isSandbox: boolean;
  };
  general: {
    proxyUrl: string;
    serverUrl: string;
    serverSide: boolean;
    labelFormat: 'PDF' | 'ZPL';
    currency: string;
    autoLockMinutes: number;
    originCountry: string;
    originState: string;
    originCity: string;
    originPostalCode: string;
    originStreet1: string;
    originStreet2: string;
    originContactName: string;
    originCompanyName: string;
    originPhone: string;
    originEmail: string;
    alwaysShowDuties: boolean;
    markAsShipped: boolean;
    autoOpenLabel: boolean;
    autoPrintLabel: boolean;
    upsPickupType: string;
    fedexPickupType: string;
    weightDisplayMode: 'both' | 'grams' | 'kg';
    labelSize: '4x6' | '8.5x11';
  };
  shippingDefaults: ShippingDefaults;
  countryDefaults: Record<string, ShippingDefaults>;
  addressBook: AddressBookCustomer[];
  shipments: SawyerShipment[];
}

export interface SawyerShipment {
  id: string;
  orderIncrementId: string;
  trackingNumber: string;
  carrier: 'UPS' | 'FedEx';
  service: string;
  customerName: string;
  company: string;
  shipDate: string;
  destCountry?: string;
  status?: string;
  hasError?: boolean;
  lastUpdated?: string;
  // Expanded details for "Order Details" view
  address?: {
    street: string[];
    city: string;
    region: string;
    postcode: string;
    country: string;
    telephone?: string;
    email?: string;
  };
  billing?: {
    shipping: string;
    duties: string;
    shippingAccountNumber?: string;
    dutiesAccountNumber?: string;
  };
  packages?: {
    weight: string;
    length: string;
    width: string;
    height: string;
  }[];
  items?: {
    name: string;
    sku: string;
    qty: number;
    price: number;
  }[];
  labelBase64?: string;
  labelUrl?: string;
}

const DEFAULT_SHIPPING_DEFAULTS: ShippingDefaults = {
  weightKg: '',
  weightG: '',
  length: '',
  width: '',
  height: '',
  billShippingTo: 'shipper',
  billDutiesTo: 'shipper',
  overwriteWeightKg: false,
  overwriteWeightG: false,
  overwriteLength: false,
  overwriteWidth: false,
  overwriteHeight: false,
  overwriteBillShippingTo: false,
  overwriteBillDutiesTo: false
};

const DEFAULT_CREDENTIALS: SawyerCredentials = {
  magento: { url: '', token: '' },
  ups: { 
    enabled: true, 
    apiKey: '', 
    secretKey: '', 
    accountNumber: '', 
    isSandbox: true 
  },
  fedex: { 
    enabled: true, 
    apiKey: '', 
    secretKey: '', 
    sandboxApiKey: '',
    sandboxSecretKey: '',
    productionApiKey: '',
    productionSecretKey: '',
    sandboxTrackingApiKey: '',
    sandboxTrackingSecretKey: '',
    productionTrackingApiKey: '',
    productionTrackingSecretKey: '',
    sandboxTrackingAccountNumber: '',
    productionTrackingAccountNumber: '',
    isTrackingSandbox: true,
    accountNumber: '', 
    domesticAccountNumber: '', 
    globalAccountNumber: '', 
    paymentAccountNumber: '',
    productionAccountNumber: '',
    isSandbox: true 
  },
  general: { 
    proxyUrl: 'https://cors-anywhere.herokuapp.com/', 
    serverUrl: 'http://localhost:3000',
    serverSide: false,
    labelFormat: 'PDF', 
    currency: 'GBP', 
    autoLockMinutes: 0,
    originCountry: 'GB',
    originState: '',
    originCity: '',
    originPostalCode: '',
    originStreet1: '',
    originStreet2: '',
    originContactName: '',
    originCompanyName: '',
    originPhone: '',
    originEmail: '',
    alwaysShowDuties: false,
    markAsShipped: true,
    autoOpenLabel: false,
    autoPrintLabel: false,
    upsPickupType: '01',
    fedexPickupType: 'DROPOFF_AT_FEDEX_LOCATION',
    weightDisplayMode: 'both',
    labelSize: '4x6'
  },
  shippingDefaults: DEFAULT_SHIPPING_DEFAULTS,
  countryDefaults: {},
  addressBook: [],
  shipments: []
};

export function useSawyerStorage() {
  const [isLocked, setIsLocked] = useState(true);
  const [credentials, setCredentials] = useState<SawyerCredentials>(DEFAULT_CREDENTIALS);
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('http://localhost:3000');

  // Load server URL from local storage so user doesn't have to retype it
  useEffect(() => {
    const config = localStorage.getItem('sawyer_server_config');
    if (config) {
      try {
        const parsed = JSON.parse(config);
        setServerUrl(parsed.serverUrl || 'http://localhost:3000');
      } catch (e) {}
    }
  }, []);

  const saveServerUrl = (url: string) => {
    localStorage.setItem('sawyer_server_config', JSON.stringify({ serverUrl: url }));
    setServerUrl(url);
  };

  const mergeWithDefaults = (parsed: any): SawyerCredentials => {
    return {
      ...DEFAULT_CREDENTIALS,
      ...parsed,
      magento: { ...DEFAULT_CREDENTIALS.magento, ...(parsed.magento || {}) },
      ups: { ...DEFAULT_CREDENTIALS.ups, ...(parsed.ups || {}) },
      fedex: { ...DEFAULT_CREDENTIALS.fedex, ...(parsed.fedex || {}) },
      general: { ...DEFAULT_CREDENTIALS.general, ...(parsed.general || { serverSide: true }) }, // Force serverSide true
      shippingDefaults: { ...DEFAULT_CREDENTIALS.shippingDefaults, ...(parsed.shippingDefaults || {}) },
      addressBook: parsed.addressBook || [],
      shipments: parsed.shipments || []
    };
  };

  const unlock = async (password: string, customServerUrl?: string) => {
    const activeServerUrl = customServerUrl || serverUrl;
    
    try {
      // Always use server in this new version
      const serverData = await ServerDataClient.loadAppData(activeServerUrl, password);
      
      if (serverData) {
        const merged = mergeWithDefaults(serverData);
        setCredentials(merged);
        setMasterPassword(password);
        setIsLocked(false);
        saveServerUrl(activeServerUrl);
        return true;
      }

      // If no server data found, but it was our first setup attempt, we might need to initialize
      // In this mode, we treat "no data" as successful unlock for brand new servers
      // But only if the server responded with 200 null data rather than an error
      setCredentials(DEFAULT_CREDENTIALS);
      setMasterPassword(password);
      setIsLocked(false);
      saveServerUrl(activeServerUrl);
      return true;
    } catch (e) {
      console.error("Server unlock failed:", e);
      return false;
    }
  };

  const save = async (newCredentials: SawyerCredentials) => {
    if (!masterPassword) return;
    
    // Ensure server mode is locked to true in state
    const dataToSave = {
      ...newCredentials,
      general: {
        ...newCredentials.general,
        serverSide: true 
      }
    };
    
    setCredentials(dataToSave);

    // Save to Standalone Server
    try {
      await ServerDataClient.saveAppData(dataToSave, dataToSave.general.serverUrl, masterPassword);
      await ServerDataClient.saveCredentials(dataToSave, dataToSave.general.serverUrl);
      saveServerUrl(dataToSave.general.serverUrl);
    } catch (e) {
      console.error("Failed to save to server:", e);
    }
  };

  const logout = () => {
    setMasterPassword(null);
    setCredentials(DEFAULT_CREDENTIALS);
    setIsLocked(true);
  };

  const resetData = () => {
    localStorage.removeItem('sawyer_server_config');
    localStorage.removeItem('sawyer_ship_data'); // Cleanup legacy
    localStorage.removeItem('sawyer_minimal_config'); // Cleanup legacy
    setCredentials(DEFAULT_CREDENTIALS);
    setMasterPassword(null);
    setIsLocked(true);
  };

  const exportData = () => {
    return JSON.stringify(credentials);
  };

  const importData = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      save(mergeWithDefaults(parsed));
    } catch (e) {
      console.error("Failed to import data:", e);
    }
  };

  return {
    isLocked,
    credentials,
    unlock,
    save,
    logout,
    resetData,
    serverUrl,
    setServerUrl,
    exportData,
    importData,
    hasStoredData: !!localStorage.getItem('sawyer_server_config'),
  };
}
