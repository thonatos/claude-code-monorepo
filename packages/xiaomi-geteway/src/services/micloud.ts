import crypto from 'crypto';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { MiCloudConfig, TokenData, AuthState, PropertyParam, SetPropertyParam } from '../types';
import {
  SDK_VERSION,
  FLAG_PHONE,
  FLAG_EMAIL,
  randomString,
  parseResponse,
  genNonce,
  genSignedNonce,
  genSignature,
  arc4Crypt,
  BASE_URLS,
} from './micloud-utils';

export { BASE_URLS };

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
    options: { params?: Record<string, any>; data?: Record<string, any>; extraCookies?: Record<string, string> } = {},
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

  /**
   * Make encrypted request to Xiaomi API
   */
  private async miotRequest(path: string, params: Record<string, any>): Promise<any> {
    if (!this.loggedIn) {
      await this.login();
    }

    const dataJson = JSON.stringify(params);
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
}
