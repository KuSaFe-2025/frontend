import { getAccessToken } from './api/axios';

function b64UrlToJson(b64url: string) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const str = atob(b64 + pad);
  return JSON.parse(str);
}

export function isAdmin(): boolean {
  const token = getAccessToken();
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    const payload = b64UrlToJson(parts[1]) as any;
    return String(payload?.isAdmin).toLowerCase() === 'true';
  } catch {
    return false;
  }
}
