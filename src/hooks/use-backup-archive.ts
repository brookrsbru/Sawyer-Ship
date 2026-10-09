import { useState, useEffect } from 'react';
import { SawyerShipment, SawyerCredentials } from './use-sawyer-storage';
import { decrypt } from '@/src/lib/crypto';

export interface BackupParseResult {
  success: boolean;
  shipments: SawyerShipment[];
  credentials?: Partial<SawyerCredentials>;
  requiresPassword?: boolean;
  filename?: string;
  error?: string;
}

// Module-level shared in-memory state so any component/page stays synced
let currentArchiveShipments: SawyerShipment[] | null = null;
let currentArchiveFilename: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(fn => fn());
}

/**
 * Parses and optionally decrypts a JSON backup file content.
 * Does NOT write anything to localStorage.
 */
export async function parseBackupFile(
  content: string,
  filename: string,
  password?: string
): Promise<BackupParseResult> {
  try {
    const parsed = JSON.parse(content);

    // Case 1: Direct array of shipments
    if (Array.isArray(parsed)) {
      return {
        success: true,
        shipments: parsed,
        filename,
      };
    }

    // Case 2: Unencrypted SawyerCredentials object
    if (parsed.shipments && Array.isArray(parsed.shipments)) {
      return {
        success: true,
        shipments: parsed.shipments,
        credentials: parsed,
        filename,
      };
    }

    // Case 3: Encrypted backup format { encryptedData: string }
    if (parsed.encryptedData && typeof parsed.encryptedData === 'string') {
      if (!password) {
        return {
          success: false,
          requiresPassword: true,
          shipments: [],
          filename,
        };
      }

      try {
        const decryptedStr = await decrypt(parsed.encryptedData, password);
        const decryptedJson = JSON.parse(decryptedStr);
        const shipments = Array.isArray(decryptedJson.shipments) ? decryptedJson.shipments : [];
        return {
          success: true,
          shipments,
          credentials: decryptedJson,
          filename,
        };
      } catch (decryptErr) {
        return {
          success: false,
          requiresPassword: true,
          error: 'Incorrect master password for this backup file.',
          shipments: [],
          filename,
        };
      }
    }

    return {
      success: false,
      error: 'Unrecognized backup format. Expected a Sawyer-Ship JSON backup file.',
      shipments: [],
      filename,
    };
  } catch (parseErr) {
    return {
      success: false,
      error: 'Invalid JSON file. Please ensure this is a valid .json backup.',
      shipments: [],
      filename,
    };
  }
}

export function useBackupArchive() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setTick(t => t + 1);
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const setArchive = (shipments: SawyerShipment[], filename: string) => {
    currentArchiveShipments = shipments;
    currentArchiveFilename = filename;
    notify();
  };

  const clearArchive = () => {
    currentArchiveShipments = null;
    currentArchiveFilename = null;
    notify();
  };

  return {
    isArchiveMode: currentArchiveShipments !== null,
    archiveShipments: currentArchiveShipments,
    archiveFilename: currentArchiveFilename,
    setArchive,
    clearArchive,
  };
}
