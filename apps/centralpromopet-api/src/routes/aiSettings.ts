import { Router } from 'express';
import { z } from 'zod';
import { db, aiAudit, aiSettings } from '@centralpromopet/database';
import { requireAuth, requireCurrentPassword, requireAdmin, AuthenticatedRequest } from '../auth';
import { AiError, configWithPreservedCredentials, getConfig, settingsSchema, credentialStatus, saveProviderCredential } from '../ai/config';
import { createModel } from '../ai/provider';
import { consumeQuota } from '../ai/storage';

export const aiSettingsRouter = Router();
aiSettingsRouter.use(requireAuth, requireCurrentPassword, requireAdmin);
aiSettingsRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
aiSettingsRouter.get('/', async (_req, res, next) => {
  try { res.json({ data: { config: await getConfig(), credentials: await credentialStatus() } }); } catch (e) { next(e); }
});
aiSettingsRouter.put('/', async (req, res, next) => {
  try {
    const config = settingsSchema.parse(req.body);
    if (config.enabled) {
      await consumeQuota((req as AuthenticatedRequest).user.id, 30, 'test');
      const result = await createModel(config)('Responda com {"ok":true}.', { test: true });
      if (!(result as { ok?: boolean }).ok) throw new AiError('O teste do modelo não foi concluído.', 503);
    }
    const userId = (req as AuthenticatedRequest).user.id;
    await db.transaction(async (tx) => {
      const stored = await configWithPreservedCredentials(config);
      await tx.insert(aiSettings).values({ id: 1, config: stored, updatedBy: userId }).onConflictDoUpdate({ target: aiSettings.id, set: { config: stored, updatedBy: userId, updatedAt: new Date() } });
      await tx.insert(aiAudit).values({ userId, event: 'settings.updated', details: config });
    });
    res.json({ data: config });
  } catch (e) { next(e); }
});
aiSettingsRouter.post('/test', async (req, res, next) => {
  try {
    const config = settingsSchema.parse(req.body);
    const started = Date.now();
    await consumeQuota((req as AuthenticatedRequest).user.id, 30, 'test');
    const result = await createModel(config)('Responda com {"ok":true}.', { test: true });
    if (!(result as { ok?: boolean }).ok) throw new AiError('Resposta de teste inválida.', 503);
    res.json({ data: { ok: true, latencyMs: Date.now() - started } });
  } catch (e) { next(e); }
});
aiSettingsRouter.post('/credential', async (req, res, next) => {
  try {
    const { provider, apiKey } = z.object({ provider: z.enum(['vertex', 'openai']), apiKey: z.string().trim().min(20).max(2048) }).strict().parse(req.body);
    if (provider === 'openai' && !/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey)) throw new AiError('Essa não parece ser uma chave OpenAI válida. A chave deve começar com “sk-”.');
    if (provider === 'vertex' && !/^AIza[A-Za-z0-9_-]{20,}$/.test(apiKey)) throw new AiError('Essa não parece ser uma API key Google válida. Confira a chave criada no Vertex AI Express.');
    await consumeQuota((req as AuthenticatedRequest).user.id, 10, 'credential');
    await saveProviderCredential(provider, apiKey, (req as AuthenticatedRequest).user.id);
    await db.insert(aiAudit).values({ userId: (req as AuthenticatedRequest).user.id, event: 'credential.rotated', details: { provider } });
    res.json({ success: true });
  } catch (e) { next(e); }
});
