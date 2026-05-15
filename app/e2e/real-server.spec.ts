import { expect, request as requestFactory, test } from '@playwright/test';

const apiBase = 'http://127.0.0.1:5267';
const password = 'password123';

type AuthResponse = {
  userId: string;
  email: string;
  displayName: string;
  accessToken: string;
};

type Created = { id: string };
type EditorGame = { id: string; title: string; status: number; tasks: EditorTask[] };
type EditorTask = { id: string; text: string; type: number; options: { id: string; text: string }[] };
type StartResponse = { attemptId: string; questionToken: string; task: PublicTask };
type PublicTask = { id: string; type: number; order: number; text: string; options: { id: string; text: string }[] };
type AnswerResponse = {
  finished: boolean;
  reason?: string | null;
  score: number;
  maxScore: number;
  correctAnswers: number;
  totalTasks: number;
  totalTimeMs: number;
  lastAnswerCorrect?: boolean | null;
  nextQuestionToken?: string | null;
  nextTask?: PublicTask | null;
};

async function resetAndSeed() {
  const api = await requestFactory.newContext({ baseURL: apiBase });
  await (await api.post('/v1/e2e/reset')).dispose();
  await (await api.post('/v1/e2e/seed-users')).dispose();
  await api.dispose();
}

async function login(email: string): Promise<AuthResponse> {
  const api = await requestFactory.newContext({ baseURL: apiBase });
  const resp = await api.post('/v1/auth/login', { data: { email, password } });
  expect(resp.ok()).toBeTruthy();
  const body = await resp.json();
  await api.dispose();
  return body;
}

async function authed(token: string) {
  return requestFactory.newContext({
    baseURL: apiBase,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

async function createMixedGame(token: string) {
  const api = await authed(token);
  const create = await api.post('/v1/my/games', {
    data: { title: 'Real E2E Mixed Game', description: 'Created by real-stack tests', descriptionFormat: 1, themeColor: '#2563EB' },
  });
  expect(create.ok()).toBeTruthy();
  const game = (await create.json()) as Created;

  const tasks = [
    { type: 0, order: 0, text: 'What is 2 + 2?', points: 100, timeLimitMs: 60000, options: ['4', '5'], correctOptionIndex: 0 },
    { type: 1, order: 1, text: 'The sky is blue.', points: 50, timeLimitMs: 60000, options: [], correctOptionIndex: 0 },
    { type: 2, order: 2, text: 'Order the steps.', points: 75, timeLimitMs: 60000, options: ['First', 'Second'], correctOptionIndex: null },
    { type: 3, order: 3, text: 'Write a short answer.', points: 0, timeLimitMs: 60000, options: [], correctOptionIndex: null },
    { type: 4, order: 4, text: 'Choose your favorite format.', points: 0, timeLimitMs: 60000, options: ['Quiz', 'Poll'], correctOptionIndex: null },
  ];

  for (const task of tasks) {
    const resp = await api.post(`/v1/my/games/${game.id}/tasks`, { data: task });
    expect(resp.ok()).toBeTruthy();
  }

  const submit = await api.post(`/v1/my/games/${game.id}/submit-for-verification`);
  expect(submit.ok()).toBeTruthy();

  const loaded = await api.get(`/v1/my/games/${game.id}`);
  expect(loaded.ok()).toBeTruthy();
  const editor = (await loaded.json()) as EditorGame;
  expect(editor.status).toBe(1);

  await api.dispose();
  return editor;
}

async function answerCurrent(api: any, gameId: string, current: StartResponse | { attemptId: string; questionToken: string; task: PublicTask }) {
  const task = current.task;
  const payload: Record<string, unknown> = {
    attemptId: current.attemptId,
    questionToken: current.questionToken,
  };

  if (task.type === 0 || task.type === 1) {
    payload.selectedOptionId = task.options.find(o => o.text === '4' || o.text === 'Правда')?.id ?? task.options[0].id;
  } else if (task.type === 2) {
    payload.orderedOptionIds = ['First', 'Second'].map(text => task.options.find(o => o.text === text)?.id);
  } else if (task.type === 3) {
    payload.textAnswer = 'Open answer from real E2E';
  } else if (task.type === 4) {
    payload.selectedOptionId = task.options[0].id;
  }

  const resp = await api.post(`/v1/games/${gameId}/answer`, { data: payload });
  expect(resp.ok()).toBeTruthy();
  return (await resp.json()) as AnswerResponse;
}

test.beforeEach(async () => {
  await resetAndSeed();
});

test('real auth, catalog, game details and author moderation flow', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input').nth(0).fill('author@e2e.test');
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button').filter({ hasText: /Р’РѕР№С‚Рё|Войти/ }).first().click();
  await expect(page).toHaveURL(/\/games/);

  const author = await login('author@e2e.test');
  const game = await createMixedGame(author.accessToken);

  await page.goto('/games');
  await expect(page.getByText(game.title)).toBeVisible();
  await page.getByText(game.title).click();
  await expect(page.getByText('VERIFIED')).toBeVisible();
  await expect(page.getByText('Approved by deterministic E2E moderation')).toBeVisible();
});

test('real author CRUD, stats and CSV export endpoints', async () => {
  const author = await login('author@e2e.test');
  const api = await authed(author.accessToken);

  const create = await api.post('/v1/my/games', {
    data: { title: 'CRUD Game', description: 'Initial', descriptionFormat: 1, themeColor: '#7C3AED' },
  });
  expect(create.ok()).toBeTruthy();
  const game = (await create.json()) as Created;

  const update = await api.put(`/v1/my/games/${game.id}`, {
    data: { title: 'CRUD Game Updated', description: 'Updated', descriptionFormat: 1, themeColor: '#16A34A' },
  });
  expect(update.ok()).toBeTruthy();

  const task = await api.post(`/v1/my/games/${game.id}/tasks`, {
    data: { type: 0, order: 0, text: 'Pick A', points: 10, timeLimitMs: 30000, options: ['A', 'B'], correctOptionIndex: 0 },
  });
  expect(task.ok()).toBeTruthy();
  const createdTask = (await task.json()) as Created;

  const taskUpdate = await api.put(`/v1/my/games/${game.id}/tasks/${createdTask.id}`, {
    data: { type: 4, order: 0, text: 'Poll A or B', points: 0, timeLimitMs: 30000, options: ['A', 'B'], correctOptionIndex: null },
  });
  expect(taskUpdate.ok()).toBeTruthy();

  const stats = await api.get(`/v1/my/games/${game.id}/stats`);
  expect(stats.ok()).toBeTruthy();
  expect(await stats.json()).toMatchObject({ attemptsCount: 0 });

  const csv = await api.get(`/v1/my/games/${game.id}/stats/export.csv`);
  expect(csv.ok()).toBeTruthy();
  expect(await csv.text()).toContain('attemptId');

  const delTask = await api.delete(`/v1/my/games/${game.id}/tasks/${createdTask.id}`);
  expect(delTask.ok()).toBeTruthy();
  const delGame = await api.delete(`/v1/my/games/${game.id}`);
  expect(delGame.ok()).toBeTruthy();

  await api.dispose();
});

test('real admin can manage visibility status', async () => {
  const author = await login('author@e2e.test');
  const admin = await login('admin@e2e.test');
  const game = await createMixedGame(author.accessToken);
  const adminApi = await authed(admin.accessToken);

  const all = await adminApi.get('/v1/admin/games');
  expect(all.ok()).toBeTruthy();
  expect(await all.text()).toContain(game.title);

  for (const status of [0, 3, 1]) {
    const resp = await adminApi.put(`/v1/admin/games/${game.id}/status?status=${status}`);
    expect(resp.ok()).toBeTruthy();
    const loaded = await adminApi.get(`/v1/admin/games/${game.id}`);
    expect((await loaded.json()).status).toBe(status);
  }

  const csv = await adminApi.get(`/v1/admin/games/${game.id}/stats/export.csv`);
  expect(csv.ok()).toBeTruthy();
  await adminApi.dispose();
});

test('real player completes mixed game and result renders with leaderboard', async ({ page }) => {
  const author = await login('author@e2e.test');
  const player = await login('player@e2e.test');
  const game = await createMixedGame(author.accessToken);
  const api = await authed(player.accessToken);

  const start = await api.post(`/v1/games/${game.id}/start`);
  expect(start.ok(), `${start.status()} ${await start.text()}`).toBeTruthy();
  let current = (await start.json()) as StartResponse;
  const answers: (boolean | null)[] = [];
  let finished: AnswerResponse | null = null;

  while (!finished) {
    const response = await answerCurrent(api, game.id, current);
    answers[current.task.order] = response.lastAnswerCorrect ?? null;
    if (response.finished) {
      finished = response;
    } else {
      current = {
        attemptId: current.attemptId,
        questionToken: response.nextQuestionToken!,
        task: response.nextTask!,
      };
    }
  }

  expect(finished.score).toBeGreaterThan(0);

  await page.addInitScript(
    ({ token, gameId, payload }) => {
      localStorage.setItem('kusafe_access_token', token);
      sessionStorage.setItem(`game:${gameId}:resultPayload`, JSON.stringify(payload));
    },
    { token: player.accessToken, gameId: game.id, payload: { finished, answers } }
  );
  await page.goto(`/game/${game.id}/result`);
  await expect(page.getByText(/100 \/ 225|150 \/ 225|225 \/ 225/)).toBeVisible();
  await expect(page.getByText('Player')).toBeVisible();

  await api.dispose();
});

test('real game play redirects anonymous users to login', async ({ page }) => {
  const author = await login('author@e2e.test');
  const game = await createMixedGame(author.accessToken);

  await page.goto(`/game/${game.id}/play`);
  await expect(page).toHaveURL(/\/login/);
});
