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
