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
