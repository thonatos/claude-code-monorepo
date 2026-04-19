import crypto from 'crypto';

// SDK version matching Python
export const SDK_VERSION = '4.2.29';

// Base URLs for different regions
export const BASE_URLS: Record<string, string> = {
  cn: 'https://api.io.mi.com/app',
  de: 'https://de.api.io.mi.com/app',
  i2: 'https://i2.api.io.mi.com/app',
  ru: 'https://ru.api.io.mi.com/app',
  sg: 'https://sg.api.io.mi.com/app',
  us: 'https://us.api.io.mi.com/app',
};

// Verification flags
export const FLAG_PHONE = 4;
export const FLAG_EMAIL = 8;

/**
 * Generate random string
 */
export function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate nonce: 8 random bytes + 4 bytes timestamp (minutes)
 */
export function genNonce(): Buffer {
  const randomBytes = crypto.randomBytes(8);
  const timestamp = Math.floor(Date.now() / 60000);
  const timestampBytes = Buffer.alloc(4);
  timestampBytes.writeInt32BE(timestamp, 0);
  return Buffer.concat([randomBytes, timestampBytes]);
}

/**
 * Generate signed nonce: SHA256(ssecurity + nonce)
 */
export function genSignedNonce(ssecurity: Buffer, nonce: Buffer): Buffer {
  return crypto.createHash('sha256')
    .update(Buffer.concat([ssecurity, nonce]))
    .digest();
}

/**
 * Generate signature: SHA1("POST&path&key=value&...&signed_nonce_base64")
 */
export function genSignature(path: string, data: Record<string, string>, signedNonce: Buffer): string {
  const params: string[] = ['POST', path];
  for (const [k, v] of Object.entries(data)) {
    params.push(`${k}=${v}`);
  }
  params.push(signedNonce.toString('base64'));
  const signatureStr = params.join('&');
  return crypto.createHash('sha1')
    .update(signatureStr)
    .digest()
    .toString('base64');
}

/**
 * ARC4 encrypt/decrypt (symmetric)
 * Drop first 1024 bytes to match Python implementation
 */
export function arc4Crypt(key: Buffer, data: Buffer): Buffer {
  const cipher = crypto.createCipheriv('rc4', key, null);
  cipher.setAutoPadding(false);
  // Drop first 1024 bytes (security measure)
  cipher.update(Buffer.alloc(1024));
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

/**
 * ARC4 decrypt (same as encrypt for RC4)
 */
export function arc4Decrypt(key: Buffer, data: Buffer): Buffer {
  return arc4Crypt(key, data);
}

/**
 * Parse Xiaomi response (strip &&&START&&& prefix)
 */
export function parseResponse(body: string): Record<string, any> {
  let str = body;
  if (str.startsWith('&&&START&&&')) {
    str = str.slice(11);
  }
  try {
    return JSON.parse(str);
  } catch (e) {
    throw new Error(`Failed to parse Xiaomi response: ${str.substring(0, 100)}...`);
  }
}