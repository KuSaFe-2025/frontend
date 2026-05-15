import { expect, request as requestFactory, test } from '@playwright/test';

const apiBase = 'http://127.0.0.1:5267';
const password = 'password123';

test.skip(process.env.KUSAFE_E2E_OLLAMA !== '1', 'Set KUSAFE_E2E_OLLAMA=1 and ensure Ollama llama3.1:8b is available.');

test('backend moderation reaches real Ollama and stores vote result', async () => {
  const api = await requestFactory.newContext({ baseURL: apiBase });
  await api.post('/v1/e2e/reset');
  await api.post('/v1/e2e/seed-users');

  const login = await api.post('/v1/auth/login', { data: { email: 'author@e2e.test', password } });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json()).accessToken as string;
  const authed = await requestFactory.newContext({
    baseURL: apiBase,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });

  const created = await authed.post('/v1/my/games', {
    data: { title: 'Ollama moderation smoke', description: 'Safe math practice', descriptionFormat: 1, themeColor: '#2563EB' },
  });
  expect(created.ok()).toBeTruthy();
  const gameId = (await created.json()).id as string;

  const task = await authed.post(`/v1/my/games/${gameId}/tasks`, {
    data: { type: 0, order: 0, text: 'What is 2 + 2?', points: 100, timeLimitMs: 60000, options: ['4', '5'], correctOptionIndex: 0 },
  });
  expect(task.ok()).toBeTruthy();

  const submit = await authed.post(`/v1/my/games/${gameId}/submit-for-verification`);
  expect(submit.ok()).toBeTruthy();
  const result = await submit.json();
  expect([1, 3]).toContain(result.status);
  expect(result.moderationYesVotes + result.moderationNoVotes).toBe(5);
  expect(String(result.moderationDecision)).toContain('local AI moderation');

  await authed.dispose();
  await api.dispose();
});
