import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import dotenv from 'dotenv';

import { errorHandler } from './middleware/errorHandler';
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
