import { afterEach, describe, expect, it } from 'vitest';
import { getCurrentUserId, isAdmin } from './authAdmin';

function token(payload: Record<string, unknown>) {
  const encoded = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `header.${encoded}.signature`;
}

describe('authAdmin helpers', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('reads admin flag and user id from access token payload', () => {
    localStorage.setItem('kusafe_access_token', token({ sub: 'user-1', isAdmin: 'true' }));

    expect(isAdmin()).toBe(true);
    expect(getCurrentUserId()).toBe('user-1');
  });

  it('returns safe defaults for missing token', () => {
    expect(isAdmin()).toBe(false);
    expect(getCurrentUserId()).toBeNull();
  });
});
