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

  let sessionData: SessionData;
  try {
    sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
  } catch {
    fs.unlinkSync(SESSION_FILE);
    return { status: 'error', message: '会话文件已损坏，请重新登录' };
  }
  const username = process.env.MI_USERNAME || '';
  const password = process.env.MI_PASSWORD || '';

  const cloud = new MiCloud({
    username,
    password,
    server: process.env.MI_CLOUD_COUNTRY || 'cn',
  });

  // Restore session state
  (cloud as any).authState = sessionData.auth_state;
  (cloud as any).deviceId = sessionData.device_id;

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