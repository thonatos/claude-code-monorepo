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
  return devices.map((d) => ({
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
  const filtered = devices.filter((d) => {
    const deviceName = d['name'] || '';
    return deviceName.toLowerCase().includes(name.toLowerCase());
  });

  return filtered.map((d) => ({
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
export async function getDeviceProperties(
  did: string,
  siid: number,
  piids: number[],
): Promise<{ did: string; properties: any[] }> {
  const cloud = await getAuthenticatedCloud();
  if (!cloud) {
    throw new AppError('AUTH_REQUIRED', '未认证，请先登录', 401);
  }

  try {
    const params = piids.map((piid) => ({ did, siid, piid }));
    const results = await cloud.getProperties(params);
    return { did, properties: results };
  } catch (err) {
    throw new AppError('API_ERROR', `获取属性失败: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
}

/**
 * Set device property
 */
export async function setDeviceProperty(
  did: string,
  siid: number,
  piid: number,
  value: any,
): Promise<SetPropertyResponse> {
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
export async function callDeviceAction(
  did: string,
  siid: number,
  aiid: number,
  params: any[] = [],
): Promise<ActionResponse> {
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
