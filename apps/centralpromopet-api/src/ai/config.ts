import { z } from 'zod';
import { db, aiSettings } from '@centralpromopet/database';
import { eq } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export class AiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const settingsSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(['vertex', 'openai']).default('vertex'),
  vertexModel: z.enum(['gemini-2.5-flash-lite']).catch('gemini-2.5-flash-lite').default('gemini-2.5-flash-lite'),
  openaiModel: z.enum(['gpt-5-mini']).default('gpt-5-mini'),
  googleProject: z.string().regex(/^$|^[a-z][a-z0-9-]{4,61}[a-z0-9]$/).default(''),
  googleLocation: z.enum(['global', 'us', 'eu']).default('global'),
  openaiAuth: z.enum(['environment', 'secret-manager']).default('environment'),
  promotionsDays: z.number().int().min(1).max(365).default(30),
  promotionsLimit: z.number().int().min(1).max(12).default(8),
  dailyMessageLimit: z.number().int().min(1).max(200).default(40),
}).strict();
export type AiConfig = z.infer<typeof settingsSchema>;
type Provider = AiConfig['provider'];
type EncryptedCredential = { version: 1; iv: string; tag: string; value: string };
type StoredConfig = Record<string, unknown> & { _credentials?: Partial<Record<Provider, EncryptedCredential>> };

async function storedConfig(): Promise<StoredConfig> {
  const [row] = await db.select({ config: aiSettings.config }).from(aiSettings).where(eq(aiSettings.id, 1));
  return (row?.config || {}) as StoredConfig;
}

function encryptionKey() {
  const secret = process.env.AI_CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new AiError('A chave interna de criptografia da aplicação não está configurada.', 503);
  return createHash('sha256').update(`centralpromopet:ai-credentials:${secret}`).digest();
}

function encryptCredential(provider: Provider, apiKey: string): EncryptedCredential {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(provider));
  const value = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), value: value.toString('base64') };
}

function decryptCredential(provider: Provider, credential: EncryptedCredential) {
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(credential.iv, 'base64'));
    decipher.setAAD(Buffer.from(provider));
    decipher.setAuthTag(Buffer.from(credential.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(credential.value, 'base64')), decipher.final()]).toString('utf8');
  } catch { throw new AiError('A credencial da IA não pôde ser lida. Cadastre a chave novamente.', 503); }
}

export async function getConfig(): Promise<AiConfig> {
  const { _credentials: _private, ...config } = await storedConfig();
  return settingsSchema.parse(config);
}

export async function configWithPreservedCredentials(config: AiConfig): Promise<StoredConfig> {
  const current = await storedConfig();
  return { ...config, ...(current._credentials ? { _credentials: current._credentials } : {}) };
}

export async function saveProviderCredential(provider: Provider, apiKey: string, updatedBy: string) {
  const current = await storedConfig();
  const { _credentials = {}, ...publicConfig } = current;
  const config: StoredConfig = { ...settingsSchema.parse(publicConfig), _credentials: { ..._credentials, [provider]: encryptCredential(provider, apiKey) } };
  await db.insert(aiSettings).values({ id: 1, config, updatedBy }).onConflictDoUpdate({ target: aiSettings.id, set: { config, updatedBy, updatedAt: new Date() } });
}

export async function providerCredential(provider: Provider) {
  const credential = (await storedConfig())._credentials?.[provider];
  if (!credential) throw new AiError(`Cadastre a chave de API ${provider === 'openai' ? 'da OpenAI' : 'do Google Gemini'} nas configurações.`, 503);
  return decryptCredential(provider, credential);
}

export async function credentialStatus() {
  const credentials = (await storedConfig())._credentials;
  return { vertexConfigured: Boolean(credentials?.vertex), openaiConfigured: Boolean(credentials?.openai) };
}
