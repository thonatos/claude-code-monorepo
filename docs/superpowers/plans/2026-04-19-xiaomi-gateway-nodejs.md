# Xiaomi Gateway Node.js REST API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js REST API service to control Xiaomi/Mijia smart home devices via Xiaomi Cloud API.

**Architecture:** TypeScript + Koa modular service with encryption layer for Xiaomi API authentication and device control.

**Tech Stack:** Node.js 18+, TypeScript, Koa, axios, crypto (built-in)

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `src/index.ts` (minimal)

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "xiaomi-gateway",
  "version": "1.0.0",
  "description": "Xiaomi/Mijia smart home REST API service",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts"
  },
  "dependencies": {
    "koa": "^2.15.0",
    "@koa/router": "^12.0.0",
    "koa-bodyparser": "^4.4.0",
    "axios": "^1.6.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/koa": "^2.15.0",
    "@types/koa__router": "^12.0.0",
    "@types/koa-bodyparser": "^4.4.0",
    "@types/node": "^20.0.0",
    "ts-node": "^10.9.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create .env.example**

```
MI_USERNAME=your_xiaomi_account
MI_PASSWORD=your_password
MI_CLOUD_COUNTRY=cn
PORT=3000
```

- [ ] **Step 4: Create minimal src/index.ts**

```typescript
console.log('xiaomi-gateway service starting...');
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: dependencies installed successfully

- [ ] **Step 6: Verify TypeScript compilation**

Run: `npm run build`
Expected: compiles without errors, creates dist/index.js

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json .env.example src/index.ts
git commit -m "feat: project setup with TypeScript and dependencies"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Create type definitions**

```typescript
// Device types
export interface Device {
  did: string;
  name: string;
  model: string;
  ip?: string;
  is_online: boolean;
}

export interface DeviceSummary {
  did: string;
  name: string;
  model: string;
  ip?: string;
  is_online: boolean;
}

// Auth types
export type AuthStatusType = 'authenticated' | 'not_configured' | 'pending_verification' | 'not_authenticated';

export interface AuthStatus {
  status: AuthStatusType;
  message: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  country?: 'cn' | 'de' | 'sg' | 'us' | 'i2' | 'ru';
}

export interface LoginResponse {
  status: 'ok' | 'verification_required' | 'missing_credentials' | 'error';
  message: string;
  devices?: DeviceSummary[];
}

export interface VerifyRequest {
  code: string;
}

export interface VerifyResponse {
  status: 'ok' | 'error';
  message: string;
  devices?: DeviceSummary[];
}

// Token storage
export interface TokenData {
  cookies: Record<string, string>;
  ssecurity: string; // hex string
  server: string;
}

export interface SessionData {
  auth_state: AuthState;
  device_id: string;
}

export interface AuthState {
  flag: number;
  identity_session: string;
}

// MiCloud config
export interface MiCloudConfig {
  username: string;
  password: string;
  server: string;
}

// Property types
export interface PropertyParam {
  did: string;
  siid: number;
  piid: number;
}

export interface SetPropertyParam extends PropertyParam {
  value: any;
}

export interface PropertyResult {
  did: string;
  siid: number;
  piid: number;
  value: any;
}

export interface GetPropertiesResult {
  did: string;
  properties: PropertyResult[];
}

export interface SetPropertyRequest {
  siid: number;
  piid: number;
  value: any;
}

export interface SetPropertyResponse {
  success: boolean;
  did: string;
  siid: number;
  piid: number;
  value: any;
  result?: any;
  error?: string;
}

// Action types
export interface ActionRequest {
  siid: number;
  aiid: number;
  params?: any[];
}

export interface ActionResponse {
  success: boolean;
  did: string;
  siid: number;
  aiid: number;
  result?: any;
  error?: string;
}

// Error types
export type ErrorCode = 
  | 'AUTH_REQUIRED'
  | 'AUTH_FAILED'
  | 'VERIFICATION_REQUIRED'
  | 'DEVICE_NOT_FOUND'
  | 'DEVICE_OFFLINE'
  | 'API_ERROR'
  | 'UNKNOWN_ERROR';

export interface ErrorResponse {
  error: true;
  code: ErrorCode;
  message: string;
  details?: any;
}

// App error class
export class AppError extends Error {
  public code: ErrorCode;
  public status: number;
  public details?: any;

  constructor(code: ErrorCode, message: string, status: number = 400, details?: any) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// MiCloud API response
export interface MiCloudApiResponse {
  code: number;
  message?: string;
  result?: any;
}

export interface MiCloudDeviceListResult {
  list: any[];
}
```

- [ ] **Step 2: Verify compilation**

Run: `npm run build`
Expected: compiles without errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add type definitions for Xiaomi Gateway"
```

---

## Task 3: MiCloud Crypto Utilities

**Files:**
- Create: `src/services/micloud-utils.ts`

- [ ] **Step 1: Create micloud-utils.ts with crypto functions**

```typescript
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
  if (body.startsWith('&&&START&&&')) {
    body = body.slice(11);
  }
  return JSON.parse(body);
}
```

- [ ] **Step 2: Verify compilation**

Run: `npm run build`
Expected: compiles without errors

- [ ] **Step 3: Commit**

```bash
git add src/services/micloud.ts
git commit -m "feat: add MiCloud crypto utilities (ARC4, SHA256, signature)"
```

---

## Task 4: MiCloud Service - Login Methods

**Files:**
- Modify: `src/services/micloud.ts` (add login methods)

- [ ] **Step 1: Add MiCloud class with login methods**

```typescript
import axios, { AxiosInstance } from 'axios';
import { 
  MiCloudConfig, 
  TokenData, 
  AuthState,
  MiCloudApiResponse,
  MiCloudDeviceListResult,
  PropertyParam,
  SetPropertyParam,
  PropertyResult,
} from '../types';
import {
  SDK_VERSION,
  BASE_URLS,
  FLAG_PHONE,
  FLAG_EMAIL,
  randomString,
  genNonce,
  genSignedNonce,
  genSignature,
  arc4Crypt,
  arc4Decrypt,
  parseResponse,
} from './micloud';

// Re-export crypto utilities
export {
  SDK_VERSION,
  BASE_URLS,
  FLAG_PHONE,
  FLAG_EMAIL,
  randomString,
  genNonce,
  genSignedNonce,
  genSignature,
  arc4Crypt,
  arc4Decrypt,
  parseResponse,
};

/**
 * Exception for verification required
 */
export class VerificationRequired extends Error {
  public maskedContact: string;
  public flag: number;
  public identitySession: string;

  constructor(maskedContact: string, flag: number, identitySession: string) {
    const contactType = flag === FLAG_PHONE ? '手机' : '邮箱';
    super(`需要${contactType}验证，验证码已发送到 ${maskedContact}`);
    this.maskedContact = maskedContact;
    this.flag = flag;
    this.identitySession = identitySession;
  }
}

/**
 * MiCloud client for Xiaomi Cloud API
 */
export class MiCloud {
  private username: string;
  private password: string;
  private server: string;
  private cookies: Record<string, string> = {};
  private ssecurity: Buffer = Buffer.alloc(0);
  private deviceId: string;
  private client: AxiosInstance;
  private loggedIn: boolean = false;
  private authState: AuthState = { flag: 0, identity_session: '' };

  constructor(config: MiCloudConfig) {
    this.username = config.username;
    this.password = config.password;
    this.server = config.server;
    this.deviceId = randomString(16);
    this.client = axios.create({
      timeout: 15000,
      maxRedirects: 5,
    });
  }

  /**
   * Login to Xiaomi Cloud
   */
  async login(): Promise<boolean> {
    if (this.loggedIn) return true;

    try {
      // Step 1: Get service login page
      const r1 = await this.client.get(
        'https://account.xiaomi.com/pass/serviceLogin',
        {
          cookies: { sdkVersion: SDK_VERSION, deviceId: this.deviceId },
          params: { _json: 'true', sid: 'xiaomiio' },
        }
      );
      const res1 = parseResponse(r1.data);

      // Step 2: Submit login credentials
      const data = {
        _json: 'true',
        sid: res1['sid'],
        callback: res1['callback'],
        _sign: res1['_sign'],
        qs: res1['qs'],
        user: this.username,
        hash: crypto.createHash('md5').update(this.password).digest('hex').toUpperCase(),
      };

      const r2 = await this.client.post(
        'https://account.xiaomi.com/pass/serviceLoginAuth2',
        data,
        {
          cookies: { sdkVersion: SDK_VERSION, deviceId: this.deviceId },
        }
      );
      const res2 = parseResponse(r2.data);

      // Check for verification required
      const notificationUrl = res2.get('notificationUrl', '');
      if (notificationUrl) {
        this.handleNotification(notificationUrl);
        return false;
      }

      if (res2['code'] !== 0) {
        throw new Error(`登录失败: ${res2['desc'] || JSON.stringify(res2)}`);
      }

      return this.getCredentials(res2);
    } catch (err) {
      if (err instanceof VerificationRequired || err instanceof Error) {
        throw err;
      }
      this.loggedIn = false;
      throw new Error(`登录失败: ${err}`);
    }
  }

  /**
   * Handle verification notification
   */
  private async handleNotification(notificationUrl: string): Promise<void> {
    const identityUrl = notificationUrl.replace(
      '/fe/service/identity/authStart',
      '/identity/list'
    );

    const r = await this.client.get(identityUrl);
    const res = parseResponse(r.data);

    const flag = res['flag'] || 0;
    let identitySession = '';

    // Extract identity_session from cookies
    if (r.headers['set-cookie']) {
      for (const cookieStr of r.headers['set-cookie']) {
        const match = cookieStr.match(/identity_session=([^;]+)/);
        if (match) {
          identitySession = match[1];
          break;
        }
      }
    }

    const key = flag === FLAG_PHONE ? 'Phone' : 'Email';

    const r2 = await this.client.get(
      `https://account.xiaomi.com/identity/auth/verify${key}`,
      {
        cookies: { identity_session: identitySession },
        params: { _flag: flag, _json: 'true' },
      }
    );
    const verifyRes = parseResponse(r2.data);

    // Send verification ticket request
    await this.client.post(
      `https://account.xiaomi.com/identity/auth/send${key}Ticket`,
      { retry: 0, icode: '', _json: 'true' },
      { cookies: { identity_session: identitySession } }
    );

    this.authState = { flag, identity_session: identitySession };

    const masked = verifyRes[`masked${key}`] || '***';
    throw new VerificationRequired(masked, flag, identitySession);
  }

  /**
   * Submit verification code
   */
  async submitVerification(code: string): Promise<boolean> {
    const flag = this.authState.flag || FLAG_PHONE;
    const identitySession = this.authState.identity_session || '';
    const key = flag === FLAG_PHONE ? 'Phone' : 'Email';

    const r = await this.client.post(
      `https://account.xiaomi.com/identity/auth/verify${key}`,
      null,
      {
        params: {
          _flag: flag,
          ticket: code,
          trust: 'true',
          _json: 'true',
        },
        cookies: { identity_session: identitySession },
      }
    );
    const res = parseResponse(r.data);

    if (res['code'] !== 0) {
      throw new Error(`验证码错误: ${res['desc'] || JSON.stringify(res)}`);
    }

    return this.getCredentials(res);
  }

  /**
   * Get credentials from login response
   */
  private async getCredentials(data: Record<string, any>): Promise<boolean> {
    const location = data['location'];
    if (!location) {
      throw new Error('登录响应缺少 location');
    }

    const r = await this.client.get(location);

    // Extract cookies
    this.cookies = {};
    for (const cookieStr of r.headers['set-cookie'] || []) {
      const parts = cookieStr.split(';')[0].split('=');
      if (parts.length >= 2) {
        this.cookies[parts[0].trim()] = parts[1].trim();
      }
    }

    // Extract ssecurity
    let ssecurity = data['ssecurity'] || '';
    if (!ssecurity) {
      for (const resp of r.headers['extension-pragma'] ? [r] : []) {
        const ext = resp.headers['extension-pragma'];
        if (ext) {
          try {
            const extData = JSON.parse(ext);
            ssecurity = extData['ssecurity'] || ssecurity;
            Object.assign(data, extData);
          } catch {}
        }
      }
    }

    this.ssecurity = Buffer.from(ssecurity, 'base64');
    this.loggedIn = true;
    return true;
  }

  /**
   * Load from saved token
   */
  loadFromToken(token: TokenData): void {
    this.cookies = token.cookies;
    this.ssecurity = Buffer.from(token.ssecurity, 'hex');
    this.server = token.server;
    this.loggedIn = true;
  }

  /**
   * Get token data for storage
   */
  getTokenData(): TokenData {
    return {
      cookies: this.cookies,
      ssecurity: this.ssecurity.toString('hex'),
      server: this.server,
    };
  }

  /**
   * Get auth state for session storage
   */
  getAuthState(): AuthState {
    return this.authState;
  }

  /**
   * Get device ID
   */
  getDeviceId(): string {
    return this.deviceId;
  }

  /**
   * Check if logged in
   */
  isLoggedIn(): boolean {
    return this.loggedIn;
  }
}
```

Note: The login methods above need to import crypto. Add `import crypto from 'crypto';` at the top of the file.

Also, axios cookie handling needs adjustment. Use `withCredentials: true` and manual cookie management.

- [ ] **Step 2: Fix axios cookie handling - update login method**

Actually, axios doesn't have built-in cookie jar. Need to manually handle cookies. Let me revise:

Replace the axios calls in login() to properly handle cookies:

```typescript
// In constructor, add cookie jar
private cookieJar: Record<string, string> = {};

// Helper to merge cookies
private mergeCookies(response: any): void {
  const setCookie = response.headers['set-cookie'];
  if (setCookie) {
    for (const cookieStr of setCookie) {
      const parts = cookieStr.split(';')[0].split('=');
      if (parts.length >= 2) {
        this.cookieJar[parts[0].trim()] = parts[1].trim();
      }
    }
  }
}

// Helper to get cookie header
private getCookieHeader(): string {
  return Object.entries(this.cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}
```

Let me rewrite the full MiCloud class with proper cookie handling:

```typescript
import crypto from 'crypto';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  MiCloudConfig, 
  TokenData, 
  AuthState,
  PropertyParam,
  SetPropertyParam,
} from '../types';
import {
  SDK_VERSION,
  BASE_URLS,
  FLAG_PHONE,
  FLAG_EMAIL,
  randomString,
  genNonce,
  genSignedNonce,
  genSignature,
  arc4Crypt,
  arc4Decrypt,
  parseResponse,
} from './micloud-utils';

// Export crypto utilities separately
export * from './micloud-utils';

/**
 * Exception for verification required
 */
export class VerificationRequired extends Error {
  public maskedContact: string;
  public flag: number;
  public identitySession: string;

  constructor(maskedContact: string, flag: number, identitySession: string) {
    const contactType = flag === FLAG_PHONE ? '手机' : '邮箱';
    super(`需要${contactType}验证，验证码已发送到 ${maskedContact}`);
    this.maskedContact = maskedContact;
    this.flag = flag;
    this.identitySession = identitySession;
  }
}

/**
 * MiCloud client for Xiaomi Cloud API
 */
export class MiCloud {
  private username: string;
  private password: string;
  private server: string;
  private deviceId: string;
  private client: AxiosInstance;
  private loggedIn: boolean = false;
  private authState: AuthState = { flag: 0, identity_session: '' };
  
  // Cookie storage
  private cookieJar: Record<string, string> = {};
  private ssecurity: Buffer = Buffer.alloc(0);

  constructor(config: MiCloudConfig) {
    this.username = config.username;
    this.password = config.password;
    this.server = config.server;
    this.deviceId = randomString(16);
    this.client = axios.create({ timeout: 15000 });
  }

  // Merge cookies from response
  private mergeCookies(res: AxiosResponse): void {
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      for (const cookieStr of setCookie) {
        const mainPart = cookieStr.split(';')[0];
        const [key, value] = mainPart.split('=');
        if (key && value) {
          this.cookieJar[key.trim()] = value.trim();
        }
      }
    }
  }

  // Get cookie header string
  private getCookieHeader(extra?: Record<string, string>): string {
    const allCookies = { ...this.cookieJar, ...extra };
    return Object.entries(allCookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  // Request helper with cookie handling
  private async request(method: 'GET' | 'POST', url: string, options: {
    params?: Record<string, any>;
    data?: Record<string, any>;
    extraCookies?: Record<string, string>;
  } = {}): Promise<AxiosResponse> {
    const headers = {
      Cookie: this.getCookieHeader(options.extraCookies),
    };

    if (method === 'GET') {
      const res = await this.client.get(url, { params: options.params, headers });
      this.mergeCookies(res);
      return res;
    } else {
      const res = await this.client.post(url, options.data, { params: options.params, headers });
      this.mergeCookies(res);
      return res;
    }
  }

  /**
   * Login to Xiaomi Cloud
   */
  async login(): Promise<boolean> {
    if (this.loggedIn) return true;

    try {
      // Step 1: Get service login page
      const r1 = await this.request('GET', 'https://account.xiaomi.com/pass/serviceLogin', {
        params: { _json: 'true', sid: 'xiaomiio' },
        extraCookies: { sdkVersion: SDK_VERSION, deviceId: this.deviceId },
      });
      const res1 = parseResponse(r1.data);

      // Step 2: Submit login credentials
      const data = {
        _json: 'true',
        sid: res1['sid'],
        callback: res1['callback'],
        _sign: res1['_sign'],
        qs: res1['qs'],
        user: this.username,
        hash: crypto.createHash('md5').update(this.password).digest('hex').toUpperCase(),
      };

      const r2 = await this.request('POST', 'https://account.xiaomi.com/pass/serviceLoginAuth2', {
        data,
        extraCookies: { sdkVersion: SDK_VERSION, deviceId: this.deviceId },
      });
      const res2 = parseResponse(r2.data);

      // Check for verification required
      const notificationUrl = res2['notificationUrl'];
      if (notificationUrl) {
        await this.handleNotification(notificationUrl);
        return false;
      }

      if (res2['code'] !== 0) {
        throw new Error(`登录失败: ${res2['desc'] || JSON.stringify(res2)}`);
      }

      return this.getCredentials(res2, r2);
    } catch (err) {
      if (err instanceof VerificationRequired) throw err;
      this.loggedIn = false;
      throw new Error(`登录失败: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Handle verification notification
   */
  private async handleNotification(notificationUrl: string): Promise<void> {
    const identityUrl = notificationUrl.replace(
      '/fe/service/identity/authStart',
      '/identity/list'
    );

    const r = await this.request('GET', identityUrl);
    const res = parseResponse(r.data);

    const flag = res['flag'] || 0;
    const identitySession = this.cookieJar['identity_session'] || '';

    const key = flag === FLAG_PHONE ? 'Phone' : 'Email';

    const r2 = await this.request('GET', `https://account.xiaomi.com/identity/auth/verify${key}`, {
      params: { _flag: flag, _json: 'true' },
    });
    const verifyRes = parseResponse(r2.data);

    // Send verification ticket request
    await this.request('POST', `https://account.xiaomi.com/identity/auth/send${key}Ticket`, {
      data: { retry: 0, icode: '', _json: 'true' },
    });

    this.authState = { flag, identity_session: identitySession };

    const masked = verifyRes[`masked${key}`] || '***';
    throw new VerificationRequired(masked, flag, identitySession);
  }

  /**
   * Submit verification code
   */
  async submitVerification(code: string): Promise<boolean> {
    const flag = this.authState.flag || FLAG_PHONE;
    const identitySession = this.authState.identity_session;
    const key = flag === FLAG_PHONE ? 'Phone' : 'Email';

    const r = await this.request('POST', `https://account.xiaomi.com/identity/auth/verify${key}`, {
      params: { _flag: flag, ticket: code, trust: 'true', _json: 'true' },
      extraCookies: { identity_session: identitySession },
    });
    const res = parseResponse(r.data);

    if (res['code'] !== 0) {
      throw new Error(`验证码错误: ${res['desc'] || JSON.stringify(res)}`);
    }

    return this.getCredentials(res, r);
  }

  /**
   * Get credentials from login response
   */
  private async getCredentials(data: Record<string, any>, prevResponse: AxiosResponse): Promise<boolean> {
    const location = data['location'];
    if (!location) {
      throw new Error('登录响应缺少 location');
    }

    const r = await this.request('GET', location);

    // Extract ssecurity
    let ssecurity = data['ssecurity'] || '';
    if (!ssecurity) {
      const extPragma = r.headers['extension-pragma'];
      if (extPragma) {
        try {
          const extData = JSON.parse(extPragma);
          ssecurity = extData['ssecurity'] || ssecurity;
        } catch {}
      }
    }

    this.ssecurity = Buffer.from(ssecurity, 'base64');
    this.loggedIn = true;
    return true;
  }

  /**
   * Load from saved token
   */
  loadFromToken(token: TokenData): void {
    this.cookieJar = token.cookies;
    this.ssecurity = Buffer.from(token.ssecurity, 'hex');
    this.server = token.server;
    this.loggedIn = true;
  }

  /**
   * Get token data for storage
   */
  getTokenData(): TokenData {
    return {
      cookies: this.cookieJar,
      ssecurity: this.ssecurity.toString('hex'),
      server: this.server,
    };
  }

  /**
   * Get auth state for session storage
   */
  getAuthState(): AuthState {
    return this.authState;
  }

  /**
   * Get device ID
   */
  getDeviceId(): string {
    return this.deviceId;
  }

  /**
   * Check if logged in
   */
  isLoggedIn(): boolean {
    return this.loggedIn;
  }

  // API methods will be added in next task
}
```

This requires separating crypto utilities. Let me restructure:

- [ ] **Step 2: Split into micloud-utils.ts and micloud.ts**

First, rename current micloud.ts to micloud-utils.ts and keep only crypto functions:

```typescript
// src/services/micloud-utils.ts
import crypto from 'crypto';

export const SDK_VERSION = '4.2.29';

export const BASE_URLS: Record<string, string> = {
  cn: 'https://api.io.mi.com/app',
  de: 'https://de.api.io.mi.com/app',
  i2: 'https://i2.api.io.mi.com/app',
  ru: 'https://ru.api.io.mi.com/app',
  sg: 'https://sg.api.io.mi.com/app',
  us: 'https://us.api.io.mi.com/app',
};

export const FLAG_PHONE = 4;
export const FLAG_EMAIL = 8;

export function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function genNonce(): Buffer {
  const randomBytes = crypto.randomBytes(8);
  const timestamp = Math.floor(Date.now() / 60000);
  const timestampBytes = Buffer.alloc(4);
  timestampBytes.writeInt32BE(timestamp, 0);
  return Buffer.concat([randomBytes, timestampBytes]);
}

export function genSignedNonce(ssecurity: Buffer, nonce: Buffer): Buffer {
  return crypto.createHash('sha256')
    .update(Buffer.concat([ssecurity, nonce]))
    .digest();
}

export function genSignature(path: string, data: Record<string, string>, signedNonce: Buffer): string {
  const params: string[] = ['POST', path];
  for (const [k, v] of Object.entries(data)) {
    params.push(`${k}=${v}`);
  }
  params.push(signedNonce.toString('base64'));
  return crypto.createHash('sha1')
    .update(params.join('&'))
    .digest()
    .toString('base64');
}

export function arc4Crypt(key: Buffer, data: Buffer): Buffer {
  const cipher = crypto.createCipheriv('rc4', key, null);
  cipher.setAutoPadding(false);
  cipher.update(Buffer.alloc(1024));
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

export function parseResponse(body: string): Record<string, any> {
  if (body.startsWith('&&&START&&&')) {
    body = body.slice(11);
  }
  return JSON.parse(body);
}
```

Then create micloud.ts with the class:

```typescript
// src/services/micloud.ts
import crypto from 'crypto';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { MiCloudConfig, TokenData, AuthState } from '../types';
import {
  SDK_VERSION,
  BASE_URLS,
  FLAG_PHONE,
  FLAG_EMAIL,
  randomString,
  genNonce,
  genSignedNonce,
  genSignature,
  arc4Crypt,
  parseResponse,
} from './micloud-utils';

export { VerificationRequired } from './micloud-utils';
export * from './micloud-utils';

export class MiCloud {
  // ... rest of class
}
```

Wait, VerificationRequired is defined in micloud.ts, not utils. Let me finalize:

- [ ] **Step 2: Create micloud-utils.ts (crypto only)**

```typescript
// src/services/micloud-utils.ts
import crypto from 'crypto';

export const SDK_VERSION = '4.2.29';

export const BASE_URLS: Record<string, string> = {
  cn: 'https://api.io.mi.com/app',
  de: 'https://de.api.io.mi.com/app',
  i2: 'https://i2.api.io.mi.com/app',
  ru: 'https://ru.api.io.mi.com/app',
  sg: 'https://sg.api.io.mi.com/app',
  us: 'https://us.api.io.mi.com/app',
};

export const FLAG_PHONE = 4;
export const FLAG_EMAIL = 8;

export function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function genNonce(): Buffer {
  const randomBytes = crypto.randomBytes(8);
  const timestamp = Math.floor(Date.now() / 60000);
  const timestampBytes = Buffer.alloc(4);
  timestampBytes.writeInt32BE(timestamp, 0);
  return Buffer.concat([randomBytes, timestampBytes]);
}

export function genSignedNonce(ssecurity: Buffer, nonce: Buffer): Buffer {
  return crypto.createHash('sha256')
    .update(Buffer.concat([ssecurity, nonce]))
    .digest();
}

export function genSignature(path: string, data: Record<string, string>, signedNonce: Buffer): string {
  const params: string[] = ['POST', path];
  for (const [k, v] of Object.entries(data)) {
    params.push(`${k}=${v}`);
  }
  params.push(signedNonce.toString('base64'));
  return crypto.createHash('sha1')
    .update(params.join('&'))
    .digest()
    .toString('base64');
}

export function arc4Crypt(key: Buffer, data: Buffer): Buffer {
  const cipher = crypto.createCipheriv('rc4', key, null);
  cipher.setAutoPadding(false);
  cipher.update(Buffer.alloc(1024)); // drop first 1024 bytes
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

export function parseResponse(body: string): Record<string, any> {
  let str = body;
  if (str.startsWith('&&&START&&&')) {
    str = str.slice(11);
  }
  return JSON.parse(str);
}
```

- [ ] **Step 3: Create micloud.ts with MiCloud class (login methods)**

```typescript
// src/services/micloud.ts
import crypto from 'crypto';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { MiCloudConfig, TokenData, AuthState } from '../types';
import {
  SDK_VERSION,
  FLAG_PHONE,
  FLAG_EMAIL,
  randomString,
  parseResponse,
} from './micloud-utils';

export { BASE_URLS } from './micloud-utils';

export class VerificationRequired extends Error {
  public maskedContact: string;
  public flag: number;
  public identitySession: string;

  constructor(maskedContact: string, flag: number, identitySession: string) {
    const contactType = flag === FLAG_PHONE ? '手机' : '邮箱';
    super(`需要${contactType}验证，验证码已发送到 ${maskedContact}`);
    this.maskedContact = maskedContact;
    this.flag = flag;
    this.identitySession = identitySession;
  }
}

export class MiCloud {
  private username: string;
  private password: string;
  public server: string;
  private deviceId: string;
  private client: AxiosInstance;
  private loggedIn: boolean = false;
  private authState: AuthState = { flag: 0, identity_session: '' };
  private cookieJar: Record<string, string> = {};
  private ssecurity: Buffer = Buffer.alloc(0);

  constructor(config: MiCloudConfig) {
    this.username = config.username;
    this.password = config.password;
    this.server = config.server;
    this.deviceId = randomString(16);
    this.client = axios.create({ timeout: 15000 });
  }

  private mergeCookies(res: AxiosResponse): void {
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      for (const cookieStr of setCookie) {
        const mainPart = cookieStr.split(';')[0];
        const eqIdx = mainPart.indexOf('=');
        if (eqIdx > 0) {
          const key = mainPart.substring(0, eqIdx).trim();
          const value = mainPart.substring(eqIdx + 1).trim();
          this.cookieJar[key] = value;
        }
      }
    }
  }

  private getCookieHeader(extra?: Record<string, string>): string {
    const allCookies = { ...this.cookieJar, ...extra };
    return Object.entries(allCookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  private async request(
    method: 'GET' | 'POST',
    url: string,
    options: { params?: Record<string, any>; data?: Record<string, any>; extraCookies?: Record<string, string> } = {}
  ): Promise<AxiosResponse> {
    const headers = { Cookie: this.getCookieHeader(options.extraCookies) };
    if (method === 'GET') {
      const res = await this.client.get(url, { params: options.params, headers });
      this.mergeCookies(res);
      return res;
    } else {
      const res = await this.client.post(url, options.data || {}, { params: options.params, headers });
      this.mergeCookies(res);
      return res;
    }
  }

  async login(): Promise<boolean> {
    if (this.loggedIn) return true;

    try {
      const r1 = await this.request('GET', 'https://account.xiaomi.com/pass/serviceLogin', {
        params: { _json: 'true', sid: 'xiaomiio' },
        extraCookies: { sdkVersion: SDK_VERSION, deviceId: this.deviceId },
      });
      const res1 = parseResponse(r1.data);

      const data = {
        _json: 'true',
        sid: res1['sid'],
        callback: res1['callback'],
        _sign: res1['_sign'],
        qs: res1['qs'],
        user: this.username,
        hash: crypto.createHash('md5').update(this.password).digest('hex').toUpperCase(),
      };

      const r2 = await this.request('POST', 'https://account.xiaomi.com/pass/serviceLoginAuth2', {
        data,
        extraCookies: { sdkVersion: SDK_VERSION, deviceId: this.deviceId },
      });
      const res2 = parseResponse(r2.data);

      const notificationUrl = res2['notificationUrl'];
      if (notificationUrl) {
        await this.handleNotification(notificationUrl);
        return false;
      }

      if (res2['code'] !== 0) {
        throw new Error(`登录失败: ${res2['desc'] || JSON.stringify(res2)}`);
      }

      return this.getCredentials(res2, r2);
    } catch (err) {
      if (err instanceof VerificationRequired) throw err;
      this.loggedIn = false;
      throw new Error(`登录失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async handleNotification(notificationUrl: string): Promise<void> {
    const identityUrl = notificationUrl.replace('/fe/service/identity/authStart', '/identity/list');
    const r = await this.request('GET', identityUrl);
    const res = parseResponse(r.data);

    const flag = res['flag'] || 0;
    const identitySession = this.cookieJar['identity_session'] || '';
    const key = flag === FLAG_PHONE ? 'Phone' : 'Email';

    const r2 = await this.request('GET', `https://account.xiaomi.com/identity/auth/verify${key}`, {
      params: { _flag: flag, _json: 'true' },
    });
    const verifyRes = parseResponse(r2.data);

    await this.request('POST', `https://account.xiaomi.com/identity/auth/send${key}Ticket`, {
      data: { retry: 0, icode: '', _json: 'true' },
    });

    this.authState = { flag, identity_session: identitySession };
    const masked = verifyRes[`masked${key}`] || '***';
    throw new VerificationRequired(masked, flag, identitySession);
  }

  async submitVerification(code: string): Promise<boolean> {
    const flag = this.authState.flag || FLAG_PHONE;
    const identitySession = this.authState.identity_session;
    const key = flag === FLAG_PHONE ? 'Phone' : 'Email';

    const r = await this.request('POST', `https://account.xiaomi.com/identity/auth/verify${key}`, {
      params: { _flag: flag, ticket: code, trust: 'true', _json: 'true' },
      extraCookies: { identity_session: identitySession },
    });
    const res = parseResponse(r.data);

    if (res['code'] !== 0) {
      throw new Error(`验证码错误: ${res['desc'] || JSON.stringify(res)}`);
    }

    return this.getCredentials(res, r);
  }

  private async getCredentials(data: Record<string, any>, prevRes: AxiosResponse): Promise<boolean> {
    const location = data['location'];
    if (!location) throw new Error('登录响应缺少 location');

    const r = await this.request('GET', location);

    let ssecurity = data['ssecurity'] || '';
    if (!ssecurity) {
      const extPragma = r.headers['extension-pragma'];
      if (extPragma) {
        try {
          const extData = JSON.parse(extPragma);
          ssecurity = extData['ssecurity'] || ssecurity;
        } catch {}
      }
    }

    this.ssecurity = Buffer.from(ssecurity, 'base64');
    this.loggedIn = true;
    return true;
  }

  loadFromToken(token: TokenData): void {
    this.cookieJar = token.cookies;
    this.ssecurity = Buffer.from(token.ssecurity, 'hex');
    this.server = token.server;
    this.loggedIn = true;
  }

  getTokenData(): TokenData {
    return {
      cookies: this.cookieJar,
      ssecurity: this.ssecurity.toString('hex'),
      server: this.server,
    };
  }

  getAuthState(): AuthState {
    return this.authState;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  isLoggedIn(): boolean {
    return this.loggedIn;
  }

  getSsecurity(): Buffer {
    return this.ssecurity;
  }

  getCookies(): Record<string, string> {
    return this.cookieJar;
  }
}
```

- [ ] **Step 4: Verify compilation**

Run: `npm run build`
Expected: compiles without errors

- [ ] **Step 5: Commit**

```bash
git add src/services/micloud-utils.ts src/services/micloud.ts
git commit -m "feat: add MiCloud login methods with cookie handling"
```

---

## Task 5: MiCloud Service - API Request Method

**Files:**
- Modify: `src/services/micloud.ts` (add miot request method)

- [ ] **Step 1: Add encrypted API request method to MiCloud class**

```typescript
// Add to src/services/micloud.ts
import { genNonce, genSignedNonce, genSignature, arc4Crypt } from './micloud-utils';
import { BASE_URLS } from './micloud-utils';

// Add these methods to MiCloud class:

  /**
   * Make encrypted request to Xiaomi API
   */
  private async miotRequest(path: string, params: Record<string, any>): Promise<any> {
    if (!this.loggedIn) {
      await this.login();
    }

    const dataJson = JSON.stringify(params, Object.keys(params).sort());
    const form: Record<string, string> = { data: dataJson };

    const nonce = genNonce();
    const signedNonce = genSignedNonce(this.ssecurity, nonce);

    // Generate rc4_hash__ signature
    form['rc4_hash__'] = genSignature(path, form, signedNonce);

    // Encrypt form data
    const encryptedForm: Record<string, string> = {};
    for (const [k, v] of Object.entries(form)) {
      const encrypted = arc4Crypt(signedNonce, Buffer.from(v, 'utf-8'));
      encryptedForm[k] = encrypted.toString('base64');
    }

    // Generate final signature
    encryptedForm['signature'] = genSignature(path, encryptedForm, signedNonce);
    encryptedForm['_nonce'] = nonce.toString('base64');

    const baseUrl = BASE_URLS[this.server] || BASE_URLS['cn'];
    const url = baseUrl + path;

    const res = await this.client.post(url, encryptedForm, {
      headers: { Cookie: this.getCookieHeader() },
    });

    // Decrypt response
    const ciphertext = Buffer.from(res.data, 'base64');
    const plaintext = arc4Crypt(signedNonce, ciphertext);
    const result = JSON.parse(plaintext.toString('utf-8'));

    if (result['code'] !== 0) {
      throw new Error(`API 请求失败: ${JSON.stringify(result)}`);
    }

    return result['result'];
  }

  /**
   * Get device list
   */
  async getDevices(): Promise<any[]> {
    const payload = {
      getVirtualModel: true,
      getHuamiDevices: 1,
      get_split_device: false,
      support_smart_home: true,
    };
    const result = await this.miotRequest('/v2/home/device_list_page', payload);
    return result['list'] || [];
  }

  /**
   * Get device properties
   */
  async getProperties(params: PropertyParam[]): Promise<any[]> {
    const result = await this.miotRequest('/miotspec/prop/get', { params });
    return Array.isArray(result) ? result : [];
  }

  /**
   * Set device properties
   */
  async setProperties(params: SetPropertyParam[]): Promise<any[]> {
    const result = await this.miotRequest('/miotspec/prop/set', { params });
    return Array.isArray(result) ? result : [];
  }

  /**
   * Call device action
   */
  async callAction(did: string, siid: number, aiid: number, params: any[] = []): Promise<any> {
    const payload = {
      params: { did, siid, aiid, in: params },
    };
    return await this.miotRequest('/miotspec/action', payload);
  }
```

Also need to import PropertyParam and SetPropertyParam types at the top:

```typescript
import { MiCloudConfig, TokenData, AuthState, PropertyParam, SetPropertyParam } from '../types';
```

- [ ] **Step 2: Verify compilation**

Run: `npm run build`
Expected: compiles without errors

- [ ] **Step 3: Commit**

```bash
git add src/services/micloud.ts
git commit -m "feat: add MiCloud encrypted API request methods"
```

---

## Task 6: Auth Service

**Files:**
- Create: `src/services/auth.ts`

- [ ] **Step 1: Create auth service**

```typescript
// src/services/auth.ts
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { 
  AuthStatus, 
  LoginRequest, 
  LoginResponse, 
  VerifyRequest, 
  VerifyResponse,
  TokenData,
  SessionData,
  DeviceSummary,
} from '../types';
import { MiCloud, VerificationRequired, BASE_URLS } from './micloud';

// Load environment variables
dotenv.config();

const TOKEN_FILE = path.resolve(process.cwd(), '.mi_token');
const SESSION_FILE = path.resolve(process.cwd(), '.mi_session');

let cachedCloud: MiCloud | null = null;

/**
 * Get cached MiCloud instance
 */
function getCloud(): MiCloud {
  if (!cachedCloud) {
    const username = process.env.MI_USERNAME || '';
    const password = process.env.MI_PASSWORD || '';
    const server = process.env.MI_CLOUD_COUNTRY || 'cn';

    cachedCloud = new MiCloud({ username, password, server });
  }
  return cachedCloud;
}

/**
 * Check authentication status
 */
export function getAuthStatus(): AuthStatus {
  const hasToken = fs.existsSync(TOKEN_FILE);
  const username = process.env.MI_USERNAME;
  const password = process.env.MI_PASSWORD;
  const hasCreds = Boolean(username && password);
  const pendingVerify = fs.existsSync(SESSION_FILE);

  if (hasToken) {
    return { status: 'authenticated', message: '已认证，可正常使用' };
  }
  if (pendingVerify) {
    return { status: 'pending_verification', message: '等待验证码，请调用 /api/auth/verify 提交验证码' };
  }
  if (hasCreds) {
    return { status: 'not_authenticated', message: '已有账号信息，请调用 /api/auth/login 发起登录' };
  }
  return { status: 'not_configured', message: '未配置账号，请设置 MI_USERNAME 和 MI_PASSWORD 环境变量' };
}

/**
 * Initiate login
 */
export async function initiateLogin(req: LoginRequest): Promise<LoginResponse> {
  // Update environment if credentials provided
  if (req.username && req.password) {
    process.env.MI_USERNAME = req.username;
    process.env.MI_PASSWORD = req.password;
    process.env.MI_CLOUD_COUNTRY = req.country || 'cn';
  }

  const username = process.env.MI_USERNAME;
  const password = process.env.MI_PASSWORD;

  if (!username || !password) {
    return { status: 'missing_credentials', message: '请提供小米账号和密码' };
  }

  const cloud = new MiCloud({
    username,
    password,
    server: process.env.MI_CLOUD_COUNTRY || 'cn',
  });

  try {
    await cloud.login();
    saveToken(cloud);
    cachedCloud = cloud;

    const devices = await cloud.getDevices();
    const deviceSummary: DeviceSummary[] = devices.map(d => ({
      name: d['name'] || '?',
      model: d['model'] || '?',
      is_online: d['isOnline'] || false,
      did: d['did'] || '',
      ip: d['localip'],
    }));

    return {
      status: 'ok',
      message: '登录成功，无需验证',
      devices: deviceSummary,
    };
  } catch (err) {
    if (err instanceof VerificationRequired) {
      const sessionData: SessionData = {
        auth_state: cloud.getAuthState(),
        device_id: cloud.getDeviceId(),
      };
      fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData));
      cachedCloud = cloud;

      return {
        status: 'verification_required',
        message: err.message,
      };
    }

    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Submit verification code
 */
export async function submitVerification(req: VerifyRequest): Promise<VerifyResponse> {
  if (!fs.existsSync(SESSION_FILE)) {
    return { status: 'error', message: '请先调用 /api/auth/login 发起登录' };
  }

  const sessionData: SessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
  const username = process.env.MI_USERNAME || '';
  const password = process.env.MI_PASSWORD || '';

  const cloud = new MiCloud({
    username,
    password,
    server: process.env.MI_CLOUD_COUNTRY || 'cn',
  });

  // Restore session state
  cloud.loadFromToken({
    cookies: {},
    ssecurity: '',
    server: process.env.MI_CLOUD_COUNTRY || 'cn',
  });

  try {
    await cloud.submitVerification(req.code);
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  saveToken(cloud);
  fs.unlinkSync(SESSION_FILE);
  cachedCloud = cloud;

  const devices = await cloud.getDevices();
  const deviceSummary: DeviceSummary[] = devices.map(d => ({
    name: d['name'] || '?',
    model: d['model'] || '?',
    is_online: d['isOnline'] || false,
    did: d['did'] || '',
    ip: d['localip'],
  }));

  return {
    status: 'ok',
    message: `验证成功，共找到 ${devices.length} 个设备`,
    devices: deviceSummary,
  };
}

/**
 * Logout (clear token)
 */
export function logout(): void {
  if (fs.existsSync(TOKEN_FILE)) {
    fs.unlinkSync(TOKEN_FILE);
  }
  if (fs.existsSync(SESSION_FILE)) {
    fs.unlinkSync(SESSION_FILE);
  }
  cachedCloud = null;
}

/**
 * Save token to file
 */
function saveToken(cloud: MiCloud): void {
  const tokenData = cloud.getTokenData();
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData));
}

/**
 * Load cloud from saved token
 */
export function loadCloudFromToken(): MiCloud | null {
  if (!fs.existsSync(TOKEN_FILE)) return null;

  try {
    const tokenData: TokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
    const username = process.env.MI_USERNAME || '';
    const password = process.env.MI_PASSWORD || '';

    const cloud = new MiCloud({
      username,
      password,
      server: tokenData.server,
    });
    cloud.loadFromToken(tokenData);
    cachedCloud = cloud;
    return cloud;
  } catch {
    return null;
  }
}

/**
 * Get authenticated cloud instance
 */
export async function getAuthenticatedCloud(): Promise<MiCloud | null> {
  if (cachedCloud && cachedCloud.isLoggedIn()) {
    return cachedCloud;
  }

  const cloud = loadCloudFromToken();
  if (cloud) return cloud;

  return null;
}
```

- [ ] **Step 2: Verify compilation**

Run: `npm run build`
Expected: compiles without errors

- [ ] **Step 3: Commit**

```bash
git add src/services/auth.ts
git commit -m "feat: add auth service with login/verify/logout"
```

---

## Task 7: Device Service

**Files:**
- Create: `src/services/device.ts`

- [ ] **Step 1: Create device service**

```typescript
// src/services/device.ts
import { Device, DeviceSummary, PropertyResult, SetPropertyResponse, ActionResponse, AppError } from '../types';
import { getAuthenticatedCloud } from './auth';

/**
 * List all devices
 */
export async function listDevices(): Promise<DeviceSummary[]> {
  const cloud = await getAuthenticatedCloud();
  if (!cloud) {
    throw new AppError('AUTH_REQUIRED', '未认证，请先登录', 401);
  }

  const devices = await cloud.getDevices();
  return devices.map(d => ({
    did: d['did'] || '',
    name: d['name'] || '',
    model: d['model'] || '',
    ip: d['localip'],
    is_online: d['isOnline'] || false,
  }));
}

/**
 * Find device by name
 */
export async function findDeviceByName(name: string): Promise<DeviceSummary[]> {
  const cloud = await getAuthenticatedCloud();
  if (!cloud) {
    throw new AppError('AUTH_REQUIRED', '未认证，请先登录', 401);
  }

  const devices = await cloud.getDevices();
  const filtered = devices.filter(d => {
    const deviceName = d['name'] || '';
    return deviceName.toLowerCase().includes(name.toLowerCase());
  });

  return filtered.map(d => ({
    did: d['did'] || '',
    name: d['name'] || '',
    model: d['model'] || '',
    ip: d['localip'],
    is_online: d['isOnline'] || false,
  }));
}

/**
 * Get device properties
 */
export async function getDeviceProperties(did: string, siid: number, piids: number[]): Promise<{ did: string; properties: any[] }> {
  const cloud = await getAuthenticatedCloud();
  if (!cloud) {
    throw new AppError('AUTH_REQUIRED', '未认证，请先登录', 401);
  }

  try {
    const params = piids.map(piid => ({ did, siid, piid }));
    const results = await cloud.getProperties(params);
    return { did, properties: results };
  } catch (err) {
    throw new AppError('API_ERROR', `获取属性失败: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
}

/**
 * Set device property
 */
export async function setDeviceProperty(did: string, siid: number, piid: number, value: any): Promise<SetPropertyResponse> {
  const cloud = await getAuthenticatedCloud();
  if (!cloud) {
    throw new AppError('AUTH_REQUIRED', '未认证，请先登录', 401);
  }

  try {
    const params = [{ did, siid, piid, value }];
    const results = await cloud.setProperties(params);
    return {
      success: true,
      did,
      siid,
      piid,
      value,
      result: results,
    };
  } catch (err) {
    return {
      success: false,
      did,
      siid,
      piid,
      value,
      error: `设置属性失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Call device action
 */
export async function callDeviceAction(did: string, siid: number, aiid: number, params: any[] = []): Promise<ActionResponse> {
  const cloud = await getAuthenticatedCloud();
  if (!cloud) {
    throw new AppError('AUTH_REQUIRED', '未认证，请先登录', 401);
  }

  try {
    const result = await cloud.callAction(did, siid, aiid, params);
    return {
      success: true,
      did,
      siid,
      aiid,
      result,
    };
  } catch (err) {
    return {
      success: false,
      did,
      siid,
      aiid,
      error: `执行动作失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npm run build`
Expected: compiles without errors

- [ ] **Step 3: Commit**

```bash
git add src/services/device.ts
git commit -m "feat: add device service with list/find/get/set/action"
```

---

## Task 8: Error Handler Middleware

**Files:**
- Create: `src/middleware/errorHandler.ts`

- [ ] **Step 1: Create error handler middleware**

```typescript
// src/middleware/errorHandler.ts
import { Context, Next } from 'koa';
import { AppError, ErrorResponse } from '../types';

export async function errorHandler(ctx: Context, next: Next): Promise<void> {
  try {
    await next();
  } catch (err: any) {
    if (err instanceof AppError) {
      ctx.status = err.status;
      ctx.body = {
        error: true,
        code: err.code,
        message: err.message,
        details: err.details,
      } as ErrorResponse;
    } else {
      ctx.status = err.status || 500;
      ctx.body = {
        error: true,
        code: 'UNKNOWN_ERROR',
        message: err.message || 'Unknown error',
        details: err.stack,
      } as ErrorResponse;
    }
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npm run build`
Expected: compiles without errors

- [ ] **Step 3: Commit**

```bash
git add src/middleware/errorHandler.ts
git commit -m "feat: add error handler middleware"
```

---

## Task 9: Auth Routes

**Files:**
- Create: `src/routes/auth.ts`

- [ ] **Step 1: Create auth routes**

```typescript
// src/routes/auth.ts
import Router from '@koa/router';
import { getAuthStatus, initiateLogin, submitVerification, logout } from '../services/auth';
import { LoginRequest, VerifyRequest } from '../types';

const router = new Router({ prefix: '/api/auth' });

/**
 * GET /api/auth/status - Check authentication status
 */
router.get('/status', async (ctx) => {
  ctx.body = getAuthStatus();
});

/**
 * POST /api/auth/login - Initiate login
 */
router.post('/login', async (ctx) => {
  const body = ctx.request.body as LoginRequest;
  ctx.body = await initiateLogin(body);
});

/**
 * POST /api/auth/verify - Submit verification code
 */
router.post('/verify', async (ctx) => {
  const body = ctx.request.body as VerifyRequest;
  ctx.body = await submitVerification(body);
});

/**
 * POST /api/auth/logout - Clear authentication
 */
router.post('/logout', async (ctx) => {
  logout();
  ctx.body = { status: 'ok', message: '已清除认证信息' };
});

export default router;
```

- [ ] **Step 2: Verify compilation**

Run: `npm run build`
Expected: compiles without errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/auth.ts
git commit -m "feat: add auth routes (status/login/verify/logout)"
```

---

## Task 10: Device Routes

**Files:**
- Create: `src/routes/device.ts`

- [ ] **Step 1: Create device routes**

```typescript
// src/routes/device.ts
import Router from '@koa/router';
import { 
  listDevices, 
  findDeviceByName, 
  getDeviceProperties, 
  setDeviceProperty, 
  callDeviceAction 
} from '../services/device';
import { SetPropertyRequest, ActionRequest } from '../types';

const router = new Router({ prefix: '/api/devices' });

/**
 * GET /api/devices - List all devices
 */
router.get('/', async (ctx) => {
  ctx.body = await listDevices();
});

/**
 * GET /api/devices/search?name=xxx - Find device by name
 */
router.get('/search', async (ctx) => {
  const name = ctx.query.name as string || '';
  ctx.body = await findDeviceByName(name);
});

/**
 * GET /api/devices/:did/properties?siid=2&piids=1,2,3 - Get properties
 */
router.get('/:did/properties', async (ctx) => {
  const did = ctx.params.did;
  const siid = parseInt(ctx.query.siid as string || '2', 10);
  const piidsStr = ctx.query.piids as string || '';
  const piids = piidsStr.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));

  if (piids.length === 0) {
    ctx.status = 400;
    ctx.body = { error: true, code: 'API_ERROR', message: '请提供 piids 参数' };
    return;
  }

  ctx.body = await getDeviceProperties(did, siid, piids);
});

/**
 * POST /api/devices/:did/properties - Set property
 */
router.post('/:did/properties', async (ctx) => {
  const did = ctx.params.did;
  const body = ctx.request.body as SetPropertyRequest;
  
  ctx.body = await setDeviceProperty(did, body.siid, body.piid, body.value);
});

/**
 * POST /api/devices/:did/actions - Call action
 */
router.post('/:did/actions', async (ctx) => {
  const did = ctx.params.did;
  const body = ctx.request.body as ActionRequest;
  
  ctx.body = await callDeviceAction(did, body.siid, body.aiid, body.params || []);
});

export default router;
```

- [ ] **Step 2: Verify compilation**

Run: `npm run build`
Expected: compiles without errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/device.ts
git commit -m "feat: add device routes (list/search/properties/actions)"
```

---

## Task 11: Main Server Entry

**Files:**
- Modify: `src/index.ts` (replace minimal version)

- [ ] **Step 1: Create full server entry**

```typescript
// src/index.ts
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import dotenv from 'dotenv';

import errorHandler from './middleware/errorHandler';
import authRoutes from './routes/auth';
import deviceRoutes from './routes/device';

dotenv.config();

const app = new Koa();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(errorHandler);
app.use(bodyParser());

// Routes
app.use(authRoutes.routes());
app.use(authRoutes.allowedMethods());
app.use(deviceRoutes.routes());
app.use(deviceRoutes.allowedMethods());

// Health check
app.use(async (ctx) => {
  if (ctx.path === '/health') {
    ctx.body = { status: 'ok', service: 'xiaomi-gateway' };
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`xiaomi-gateway service running on http://localhost:${PORT}`);
  console.log(`API endpoints:
  - GET  /api/auth/status
  - POST /api/auth/login
  - POST /api/auth/verify
  - POST /api/auth/logout
  - GET  /api/devices
  - GET  /api/devices/search?name=xxx
  - GET  /api/devices/:did/properties?siid=2&piids=1,2,3
  - POST /api/devices/:did/properties
  - POST /api/devices/:did/actions
  - GET  /health`);
});

export default app;
```

- [ ] **Step 2: Verify compilation**

Run: `npm run build`
Expected: compiles without errors

- [ ] **Step 3: Test server starts**

Run: `timeout 3 npm run start || true`
Expected: server starts, prints port info, then timeout kills it

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: complete Koa server with all routes and middleware"
```

---

## Task 12: README Documentation

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README**

```markdown
# Xiaomi Gateway

Node.js REST API 服务，用于控制小米/米家智能家居设备。

## 功能

- 小米账号认证（登录 + 二次验证）
- 设备列表与搜索
- 设备属性读取/设置
- 设备动作调用

## 安装

```bash
npm install
npm run build
```

## 配置

创建 `.env` 文件：

```
MI_USERNAME=your_xiaomi_account
MI_PASSWORD=your_password
MI_CLOUD_COUNTRY=cn
PORT=3000
```

## 运行

```bash
npm run start
```

开发模式：

```bash
npm run dev
```

## API 文档

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/status` | 检查认证状态 |
| POST | `/api/auth/login` | 发起登录 |
| POST | `/api/auth/verify` | 提交验证码 |
| POST | `/api/auth/logout` | 清除认证 |

### 设备

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/devices` | 列出所有设备 |
| GET | `/api/devices/search?name=xxx` | 搜索设备 |
| GET | `/api/devices/:did/properties?siid=2&piids=1,2,3` | 读取属性 |
| POST | `/api/devices/:did/properties` | 设置属性 |
| POST | `/api/devices/:did/actions` | 调用动作 |

### 使用示例

```bash
# 检查认证状态
curl http://localhost:3000/api/auth/status

# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "your_account", "password": "your_password"}'

# 如果需要验证码
curl -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'

# 列出设备
curl http://localhost:3000/api/devices

# 搜索设备
curl "http://localhost:3000/api/devices/search?name=客厅"

# 读取属性
curl "http://localhost:3000/api/devices/xxx/properties?siid=2&piids=1,2,3"

# 设置属性（开关）
curl -X POST http://localhost:3000/api/devices/xxx/properties \
  -H "Content-Type: application/json" \
  -d '{"siid": 2, "piid": 1, "value": true}'

# 调用动作
curl -X POST http://localhost:3000/api/devices/xxx/actions \
  -H "Content-Type: application/json" \
  -d '{"siid": 2, "aiid": 1}'
```

## MIoT 协议

设备属性通过 `siid`(服务ID) 和 `piid`(属性ID) 定位。

常见组合：
- 开关：`siid=2, piid=1` (true/false)
- 亮度：`siid=2, piid=2` (0-100)
- 色温：`siid=2, piid=3`

查询设备规格：https://home.miot-spec.com

## 技术栈

- Node.js 18+
- TypeScript
- Koa
- axios
- crypto (内置)

## 参考

基于 [xiaomi-device-control](https://github.com/alleneee/xiaomi-device-control) Python 版移植。
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with usage examples"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: compiles without errors

- [ ] **Step 2: Start server and test health endpoint**

Run: `npm run start & sleep 2 && curl http://localhost:3000/health && kill %1`
Expected: returns `{ "status": "ok", "service": "xiaomi-gateway" }`

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: xiaomi-gateway REST API complete"
```

---

## Summary

**Files Created:**
- `package.json`
- `tsconfig.json`
- `.env.example`
- `src/types/index.ts`
- `src/services/micloud-utils.ts`
- `src/services/micloud.ts`
- `src/services/auth.ts`
- `src/services/device.ts`
- `src/middleware/errorHandler.ts`
- `src/routes/auth.ts`
- `src/routes/device.ts`
- `src/index.ts`
- `README.md`

**Key Dependencies:**
- koa, @koa/router, koa-bodyparser (HTTP)
- axios (HTTP client)
- dotenv (env vars)
- crypto (built-in encryption)

**Core Logic:**
- ARC4 encryption + SHA256 signature for Xiaomi API
- Cookie-based session management
- Token persistence to `.mi_token`