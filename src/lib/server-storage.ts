import fs from 'fs/promises';
import path from 'path';
import { encrypt, decrypt } from './encryption.js';

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const CREDS_FILE = path.join(STORAGE_DIR, 'carrier-credentials.enc');
const APP_DATA_FILE = path.join(STORAGE_DIR, 'app-data.enc');

export async function ensureStorage() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating storage directory:', err);
  }
}

export async function saveCredentials(data: any) {
  await ensureStorage();
  const json = JSON.stringify(data);
  const encrypted = encrypt(json);
  await fs.writeFile(CREDS_FILE, encrypted, 'utf8');
}

export async function loadCredentials(): Promise<any | null> {
  try {
    const encrypted = await fs.readFile(CREDS_FILE, 'utf8');
    const json = decrypt(encrypted);
    return JSON.parse(json);
  } catch (err) {
    // If file doesn't exist or is invalid, return null
    return null;
  }
}

export async function saveAppData(data: any, password?: string) {
  await ensureStorage();
  const json = JSON.stringify(data);
  const encrypted = encrypt(json, password);
  await fs.writeFile(APP_DATA_FILE, encrypted, 'utf8');
}

export async function loadAppData(password?: string): Promise<any | null> {
  try {
    const encrypted = await fs.readFile(APP_DATA_FILE, 'utf8');
    const json = decrypt(encrypted, password);
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
}
