import { getAccessToken } from './api/axios';

function b64UrlToJson(b64url: string) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const str = atob(b64 + pad);
  return JSON.parse(str);
}

export function getAccessTokenPayload(): Record<string, unknown> | null {
  const token = getAccessToken();
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    return b64UrlToJson(parts[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isAdmin(): boolean {
  const payload = getAccessTokenPayload();
  return String(payload?.isAdmin ?? '').toLowerCase() === 'true';
}

export function getCurrentUserId(): string | null {
  const payload = getAccessTokenPayload();
  return typeof payload?.sub === 'string' ? payload.sub : null;
}
