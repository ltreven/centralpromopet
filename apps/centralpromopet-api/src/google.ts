import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';

export type GoogleIdentity = { subject: string; email: string; displayName: string | null; avatarUrl: string | null };
export type GoogleVerifier = (credential: string, nonce: string) => Promise<GoogleIdentity>;
const client = new OAuth2Client();

export function googleClientId() { return process.env.GOOGLE_CLIENT_ID?.trim() || ''; }

// Called only after the Google library has verified signature, issuer, expiry and audience.
export function googleIdentityFromPayload(payload: unknown, nonce: string): GoogleIdentity {
  const claims = z.object({
    sub: z.string().min(1).max(255), email: z.string().trim().toLowerCase().email().max(255),
    email_verified: z.literal(true), nonce: z.literal(nonce),
    name: z.string().max(100).optional(), picture: z.string().optional(),
  }).parse(payload);
  let avatarUrl: string | null = null;
  if (claims.picture) {
    try {
      const url = new URL(claims.picture);
      if (url.protocol === 'https:' && (url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com'))) avatarUrl = url.href;
    } catch { /* A missing/invalid avatar never prevents authentication. */ }
  }
  return { subject: claims.sub, email: claims.email, displayName: claims.name?.trim() || null, avatarUrl };
}

export const verifyGoogleCredential: GoogleVerifier = async (credential, nonce) => {
  const audience = googleClientId();
  if (!audience) throw new Error('Google sign-in is disabled');
  const ticket = await client.verifyIdToken({ idToken: credential, audience });
  return googleIdentityFromPayload(ticket.getPayload(), nonce);
};
