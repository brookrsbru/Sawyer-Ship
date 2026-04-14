import { useState, useEffect } from 'react';
import { encrypt, decrypt } from '@/src/lib/crypto';

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

export interface SawyerCredentials {
  magento: {
    url: string;
    token: string;
  };
  ups: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    accountNumber: string; // Legacy, kept for migration
    domesticAccountNumber: string;
    globalAccountNumber: string;
    isSandbox: boolean;
  };
  fedex: {
    enabled: boolean;
    apiKey: string;
    secretKey: string;
    accountNumber: string; // Legacy, kept for migration
    domesticAccountNumber: string;
    globalAccountNumber: string;
    isSandbox: boolean;
  };
  general: {
    proxyUrl: string;
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
    upsPickupType: string;
    fedexPickupType: string;
    weightDisplayMode: 'both' | 'grams' | 'kg';
  };
  shippingDefaults: ShippingDefaults;
  countryDefaults: Record<string, ShippingDefaults>;
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
    clientId: '', 
    clientSecret: '', 
    accountNumber: '', 
    domesticAccountNumber: '', 
    globalAccountNumber: '', 
    isSandbox: true 
  },
  fedex: { 
    enabled: true, 
    apiKey: '', 
    secretKey: '', 
    accountNumber: '', 
    domesticAccountNumber: '', 
    globalAccountNumber: '', 
    isSandbox: true 
  },
  general: { 
    proxyUrl: 'https://cors-anywhere.herokuapp.com/', 
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
    upsPickupType: '01',
    fedexPickupType: 'DROPOFF_AT_FEDEX_LOCATION',
    weightDisplayMode: 'both'
  },
  shippingDefaults: DEFAULT_SHIPPING_DEFAULTS,
  countryDefaults: {}
};

export function useSawyerStorage() {
  const [isLocked, setIsLocked] = useState(true);
  const [credentials, setCredentials] = useState<SawyerCredentials>(DEFAULT_CREDENTIALS);
  const [masterPassword, setMasterPassword] = useState<string | null>(null);

  const unlock = async (password: string) => {
    const stored = localStorage.getItem('sawyer_ship_data');
    if (!stored) {
      setMasterPassword(password);
      setIsLocked(false);
      return true;
    }

    try {
      const decrypted = await decrypt(stored, password);
      const parsed = JSON.parse(decrypted);
      
      // Merge with defaults to handle missing fields from older versions
      const merged: SawyerCredentials = {
        ...DEFAULT_CREDENTIALS,
        ...parsed,
        magento: { ...DEFAULT_CREDENTIALS.magento, ...(parsed.magento || {}) },
        ups: { ...DEFAULT_CREDENTIALS.ups, ...(parsed.ups || {}) },
        fedex: { ...DEFAULT_CREDENTIALS.fedex, ...(parsed.fedex || {}) },
        general: { ...DEFAULT_CREDENTIALS.general, ...(parsed.general || {}) },
        shippingDefaults: { ...DEFAULT_CREDENTIALS.shippingDefaults, ...(parsed.shippingDefaults || {}) }
      };
      
      setCredentials(merged);
      setMasterPassword(password);
      setIsLocked(false);
      return true;
    } catch (e) {
      return false;
    }
  };

  const save = async (newCredentials: SawyerCredentials) => {
    if (!masterPassword) return;
    const encrypted = await encrypt(JSON.stringify(newCredentials), masterPassword);
    localStorage.setItem('sawyer_ship_data', encrypted);
    setCredentials(newCredentials);
  };

  const logout = () => {
    setMasterPassword(null);
    setCredentials(DEFAULT_CREDENTIALS);
    setIsLocked(true);
  };

  const exportData = () => {
    return localStorage.getItem('sawyer_ship_data');
  };

  const importData = (encryptedData: string) => {
    localStorage.setItem('sawyer_ship_data', encryptedData);
    setIsLocked(true);
    setMasterPassword(null);
  };

  const resetData = () => {
    localStorage.removeItem('sawyer_ship_data');
    setCredentials(DEFAULT_CREDENTIALS);
    setMasterPassword(null);
    setIsLocked(true);
  };

  return {
    isLocked,
    credentials,
    unlock,
    save,
    logout,
    exportData,
    importData,
    resetData,
    hasStoredData: !!localStorage.getItem('sawyer_ship_data')
  };
}
