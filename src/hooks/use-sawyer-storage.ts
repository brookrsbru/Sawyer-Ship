import { useState, useEffect } from 'react';
import { encrypt, decrypt } from '@/src/lib/crypto';

export interface SawyerCredentials {
  magento: {
    url: string;
    token: string;
  };
  ups: {
    clientId: string;
    clientSecret: string;
    accountNumber: string;
    isSandbox: boolean;
  };
  fedex: {
    apiKey: string;
    secretKey: string;
    accountNumber: string;
    isSandbox: boolean;
  };
  general: {
    proxyUrl: string;
    labelFormat: 'PDF' | 'ZPL';
  };
}

const DEFAULT_CREDENTIALS: SawyerCredentials = {
  magento: { url: '', token: '' },
  ups: { clientId: '', clientSecret: '', accountNumber: '', isSandbox: true },
  fedex: { apiKey: '', secretKey: '', accountNumber: '', isSandbox: true },
  general: { proxyUrl: 'https://cors-anywhere.herokuapp.com/', labelFormat: 'PDF' }
};

export function useSawyerStorage() {
  const [isLocked, setIsLocked] = useState(true);
  const [credentials, setCredentials] = useState<SawyerCredentials>(DEFAULT_CREDENTIALS);
  const [masterPassword, setMasterPassword] = useState<string | null>(null);

  // Check if we have any stored data
  useEffect(() => {
    const stored = localStorage.getItem('sawyer_ship_data');
    if (!stored) {
      setIsLocked(false); // No data, so not locked (first time setup)
    }
  }, []);

  const unlock = async (password: string) => {
    const stored = localStorage.getItem('sawyer_ship_data');
    if (!stored) {
      setMasterPassword(password);
      setIsLocked(false);
      return true;
    }

    try {
      const decrypted = await decrypt(stored, password);
      setCredentials(JSON.parse(decrypted));
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

  return {
    isLocked,
    credentials,
    unlock,
    save,
    logout,
    exportData,
    importData,
    hasStoredData: !!localStorage.getItem('sawyer_ship_data')
  };
}
