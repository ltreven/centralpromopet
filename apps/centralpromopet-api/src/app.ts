import express, { ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { sql } from 'drizzle-orm';
import { db } from '@centralpromopet/database';
import { createIdentityRouter } from './routes/identity';
import { promotionsRouter } from './routes/promotions';
import { adminUsersRouter } from './routes/adminUsers';
import { petsRouter } from './routes/pets';
import { tipsRouter } from './routes/tips';
import { requireAuth, requireAdmin, requireCurrentPassword, validateJwtSecret } from './auth';

import { GoogleVerifier } from './google';

export function createApp(options: { googleVerifier?: GoogleVerifier } = {}) {
validateJwtSecret();
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use((req, res, next) => {
  // All browser mutations are same-origin JSON. Simple cross-site forms are refused.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ success: false, message: 'Origem não permitida.' });
    if (!req.is('application/json')) return res.status(415).json({ success: false, message: 'Use application/json.' });
    if (req.headers.origin && !allowedOrigins().includes(req.headers.origin)) return res.status(403).json({ success: false, message: 'Origem não permitida.' });
  }
  next();
});
function allowedOrigins() {
  const configured = process.env.APP_ORIGINS;
  if (configured) return configured.split(',').map((origin) => origin.trim());
  if (process.env.NODE_ENV === 'production') return [];
  return ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://centralpromopet.localhost'];
}
app.use(express.json({ limit: '16kb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/ready', async (_req, res) => {
  try { await db.execute(sql`select 1`); res.json({ status: 'ok' }); }
  catch { res.status(503).json({ status: 'unavailable' }); }
});
app.use('/api/promotions', promotionsRouter);
app.use('/api/pets', petsRouter);
app.use('/api/tips', tipsRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/identity', createIdentityRouter(options.googleVerifier));
app.use('/api', requireAuth, requireCurrentPassword);
app.get('/api/account', (req, res) => res.json({ success: true, data: { message: 'Sua conta está pronta.' } }));
app.get('/api/admin/status', requireAdmin, (_req, res) => res.json({ success: true, data: { message: 'Administração pronta para a próxima etapa.' } }));
app.use((_req, res) => res.status(404).json({ success: false, message: 'Recurso não encontrado.' }));
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ success: false, message: 'JSON inválido.' });
  console.error('Request failed:', error instanceof Error ? error.message : 'Unknown error');
  res.status(500).json({ success: false, message: 'Não foi possível concluir a solicitação.' });
};
app.use(errorHandler);

return app;
}

export const app = createApp();
