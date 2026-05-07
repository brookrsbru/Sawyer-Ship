import crypto from 'crypto';

const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Gets a consistent 32-byte key from any input string using SHA-256
 * This prevents "Invalid key length" errors if the environment key is too short/long.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.SERVER_STORAGE_KEY || 'sawyer-ship-secure-v2-dev-key-32ch';
  return crypto.createHash('sha256').update(String(key)).digest();
}

export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error: any) {
    console.error('[Encryption] Encrypt failed:', error.message);
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

export function decrypt(text: string): string {
  try {
    const textParts = text.split(':');
    const ivStr = textParts.shift();
    if (!ivStr) throw new Error('Invalid encrypted format');
    const iv = Buffer.from(ivStr, 'hex');
    const key = getEncryptionKey();
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error: any) {
    console.error('[Encryption] Decrypt failed:', error.message);
    throw new Error(`Decryption failed: ${error.message}`);
  }
}
