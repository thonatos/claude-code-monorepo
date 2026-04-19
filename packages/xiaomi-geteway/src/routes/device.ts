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