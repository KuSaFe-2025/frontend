import { expect, request as requestFactory, test, type APIRequestContext, type Page } from '@playwright/test';

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

type TaskUpsert = {
  type: number;
  order: number;
  text: string;
  points: number;
  timeLimitMs: number;
  options: string[];
  correctOptionIndex: number | null;
};

async function resetAndSeed() {
  const api = await requestFactory.newContext({ baseURL: apiBase });
  const reset = await api.post('/v1/e2e/reset');
  expect(reset.ok()).toBeTruthy();
  await reset.dispose();
  const seed = await api.post('/v1/e2e/seed-users');
  expect(seed.ok()).toBeTruthy();
  await seed.dispose();
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

async function seedBrowserAuth(page: Page, token: string) {
  await page.addInitScript(accessToken => {
    localStorage.setItem('kusafe_access_token', accessToken);
  }, token);
}

async function loginViaUi(page: Page, email: string, pwd = password) {
  await page.goto('/login');
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(pwd);
  await page.getByTestId('auth-submit').click();
  await expect(page).toHaveURL(/\/games/);
}

async function registerViaUi(page: Page, email: string, displayName: string, pwd = password) {
  await page.goto('/login');
  await page.getByRole('tab').nth(1).click();
  await page.getByTestId('display-name-input').fill(displayName);
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(pwd);
  await page.getByTestId('auth-submit').click();
}

async function createGameViaApi(token: string, title: string, description = 'Created by real-stack tests') {
  const api = await authed(token);
  const create = await api.post('/v1/my/games', {
    data: { title, description, descriptionFormat: 1, themeColor: '#2563EB' },
  });
  expect(create.ok()).toBeTruthy();
  const game = (await create.json()) as Created;
  await api.dispose();
  return game;
}

async function createTaskViaApi(token: string, gameId: string, task: TaskUpsert) {
  const api = await authed(token);
  const resp = await api.post(`/v1/my/games/${gameId}/tasks`, { data: task });
  if (!resp.ok()) throw new Error(`${resp.status()} ${await resp.text()}`);
  const created = (await resp.json()) as Created;
  await api.dispose();
  return created;
}

async function submitGameForVerification(token: string, gameId: string) {
  const api = await authed(token);
  const submit = await api.post(`/v1/my/games/${gameId}/submit-for-verification`);
  if (!submit.ok()) throw new Error(`${submit.status()} ${await submit.text()}`);
  await api.dispose();
}

async function createMixedGame(token: string) {
  const game = await createGameViaApi(token, 'Real E2E Mixed Game', '**Markdown description**\n\n- formatted item');
  const tasks: TaskUpsert[] = [
    { type: 0, order: 0, text: 'What is 2 + 2?', points: 100, timeLimitMs: 60000, options: ['4', '5'], correctOptionIndex: 0 },
    { type: 1, order: 1, text: 'The sky is blue.', points: 50, timeLimitMs: 60000, options: [], correctOptionIndex: 0 },
    { type: 2, order: 2, text: 'Order the steps.', points: 75, timeLimitMs: 60000, options: ['First', 'Second'], correctOptionIndex: null },
    { type: 3, order: 3, text: 'Write a short answer.', points: 0, timeLimitMs: 60000, options: [], correctOptionIndex: null },
    { type: 4, order: 4, text: 'Choose your favorite format.', points: 0, timeLimitMs: 60000, options: ['Quiz', 'Poll'], correctOptionIndex: null },
  ];

  for (const task of tasks) await createTaskViaApi(token, game.id, task);
  await submitGameForVerification(token, game.id);

  const api = await authed(token);
  const loaded = await api.get(`/v1/my/games/${game.id}`);
  expect(loaded.ok()).toBeTruthy();
  const editor = (await loaded.json()) as EditorGame;
  expect(editor.status).toBe(1);
  await api.dispose();
  return editor;
}

async function createVerifiedQuizGame(token: string, title = 'Real E2E Quiz Game') {
  const game = await createGameViaApi(token, title, 'Single quiz game for leaderboard checks');
  await createTaskViaApi(token, game.id, {
    type: 0,
    order: 0,
    text: 'What is 2 + 2?',
    points: 100,
    timeLimitMs: 60000,
    options: ['4', '5'],
    correctOptionIndex: 0,
  });
  await submitGameForVerification(token, game.id);
  return game;
}

async function createVerifiedPuzzleGame(token: string, title = 'Real E2E Puzzle Game') {
  const game = await createGameViaApi(token, title, 'Puzzle game for play page checks');
  await createTaskViaApi(token, game.id, {
    type: 2,
    order: 0,
    text: 'Put these steps in order.',
    points: 100,
    timeLimitMs: 60000,
    options: ['First', 'Second'],
    correctOptionIndex: null,
  });
  await submitGameForVerification(token, game.id);
  return game;
}

async function createVerifiedOpenAnswerGame(token: string, title = 'Real E2E Open Answers Game') {
  const game = await createGameViaApi(token, title, 'Open answer stats checks');
  await createTaskViaApi(token, game.id, {
    type: 3,
    order: 0,
    text: 'Write a multi-line answer.',
    points: 0,
    timeLimitMs: 60000,
    options: [],
    correctOptionIndex: null,
  });
  await submitGameForVerification(token, game.id);
  return game;
}

async function completeOpenAnswerAttempt(token: string, gameId: string, textAnswer: string) {
  const api = await authed(token);
  const start = await api.post(`/v1/games/${gameId}/start`);
  if (!start.ok()) throw new Error(`${start.status()} ${await start.text()}`);
  const current = (await start.json()) as StartResponse;
  const answer = await api.post(`/v1/games/${gameId}/answer`, {
    data: { attemptId: current.attemptId, questionToken: current.questionToken, textAnswer },
  });
  if (!answer.ok()) throw new Error(`${answer.status()} ${await answer.text()}`);
  await api.dispose();
}

async function answerCurrent(api: APIRequestContext, gameId: string, current: StartResponse | { attemptId: string; questionToken: string; task: PublicTask }) {
  const task = current.task;
  const payload: Record<string, unknown> = {
    attemptId: current.attemptId,
    questionToken: current.questionToken,
  };

  if (task.type === 0 || task.type === 1) {
    payload.selectedOptionId = task.options.find(o => o.text === '4' || o.text === 'True' || o.text === 'Правда')?.id ?? task.options[0].id;
  } else if (task.type === 2) {
    payload.orderedOptionIds = ['First', 'Second'].map(text => task.options.find(o => o.text === text)?.id);
  } else if (task.type === 3) {
    payload.textAnswer = 'Open answer from real E2E';
  } else if (task.type === 4) {
    payload.selectedOptionId = task.options[0].id;
  }

  const resp = await api.post(`/v1/games/${gameId}/answer`, { data: payload });
  if (!resp.ok()) throw new Error(`${resp.status()} ${await resp.text()}`);
  return (await resp.json()) as AnswerResponse;
}

async function completeGame(api: APIRequestContext, gameId: string) {
  const start = await api.post(`/v1/games/${gameId}/start`);
  if (!start.ok()) throw new Error(`${start.status()} ${await start.text()}`);
  let current = (await start.json()) as StartResponse;
  const answers: (boolean | null)[] = [];
  let finished: AnswerResponse | null = null;

  while (!finished) {
    const response = await answerCurrent(api, gameId, current);
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

  return { finished, answers };
}

test.beforeEach(async () => {
  await resetAndSeed();
});

test('login email input keeps manually typed text stable', async ({ page }) => {
  await page.goto('/login');
  const emailInput = page.getByTestId('email-input');

  await emailInput.click();
  await emailInput.pressSequentially('author@e2e.test', { delay: 5 });
  await expect(emailInput).toHaveValue('author@e2e.test');

  await emailInput.press('Control+A');
  await emailInput.pressSequentially('player@e2e.test', { delay: 5 });
  await expect(emailInput).toHaveValue('player@e2e.test');
});

test('real auth, catalog, game details and author moderation flow', async ({ page }) => {
  await loginViaUi(page, 'author@e2e.test');

  const author = await login('author@e2e.test');
  const game = await createMixedGame(author.accessToken);

  await page.goto('/games');
  await expect(page.getByText(game.title)).toBeVisible();
  await page.getByText(game.title).hover();
  await expect(page.locator('strong').filter({ hasText: 'Markdown description' })).toBeVisible();
  await page.getByText(game.title).click();
  await expect(page.getByText('VERIFIED')).toBeVisible();
  await expect(page.getByText('Approved by KuSaFe')).toBeVisible();
  await expect(page.locator('strong').filter({ hasText: 'Markdown description' })).toBeVisible();
  await expect(page.getByText('formatted item')).toBeVisible();
  await expect(page.getByText('Викторина')).toBeVisible();
  await expect(page.getByText('Порядок')).toBeVisible();
  await expect(page.getByText('Открытый ответ')).toBeVisible();
});

test('real registration, duplicate registration and refresh-token interceptor', async ({ page }) => {
  const email = 'registered@e2e.test';
  await registerViaUi(page, email, 'Registered User');
  await expect(page).toHaveURL(/\/games/);

  const auth = await login(email);
  const api = await authed(auth.accessToken);
  const mine = await api.get('/v1/my/games');
  expect(mine.ok()).toBeTruthy();
  await api.dispose();

  await page.goto('/login');
  await page.getByRole('tab').nth(1).click();
  await page.getByTestId('display-name-input').fill('Registered User');
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  const duplicateDialog = page.waitForEvent('dialog');
  await page.getByTestId('auth-submit').click();
  const dialog = await duplicateDialog;
  expect(dialog.message()).toContain('Email already registered');
  await dialog.dismiss();

  await loginViaUi(page, 'author@e2e.test');
  await page.evaluate(() => localStorage.setItem('kusafe_access_token', 'bad.access.token'));
  const refreshedList = page.waitForResponse(response =>
    response.url() === `${apiBase}/v1/my/games` && response.status() === 200
  );
  await page.goto('/my-games');
  await refreshedList;
  await expect(page.getByTestId('dashboard-error')).toHaveCount(0);
  await expect(page.getByTestId('open-create-game')).toBeVisible();
  const refreshed = await page.evaluate(() => localStorage.getItem('kusafe_access_token'));
  expect(refreshed).not.toBe('bad.access.token');
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

test('real author dashboard creates tasks, verifies game and downloads CSV through UI', async ({ page }) => {
  const author = await login('author@e2e.test');
  await seedBrowserAuth(page, author.accessToken);
  await page.goto('/my-games');

  await page.getByTestId('open-create-game').click();
  await page.getByTestId('game-title-input').fill('Dashboard UI Game');
  await page.getByTestId('game-description-input').fill('Created through the real dashboard UI');
  await page.getByTestId('game-theme-color-input').fill('#16A34A');
  await page.getByTestId('create-game-save').click();

  await expect(page.getByTestId('game-list-item').filter({ hasText: 'Dashboard UI Game' })).toBeVisible();
  await expect(page.getByTestId('dashboard-tab-info')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('dashboard-tab-tasks').click();
  await expect(page.getByTestId('open-create-task')).toBeVisible();

  await page.getByTestId('open-create-task').click();
  await page.getByTestId('task-text-input').fill('Dashboard quiz question');
  await page.getByTestId('task-points-input').fill('25');
  await expect(page.getByTestId('task-time-limit-input')).toHaveValue('60');
  await page.getByTestId('task-time-limit-input').fill('45');
  await page.getByTestId('task-option-0').click();
  await page.getByTestId('task-option-0').pressSequentially('Correct', { delay: 5 });
  await expect(page.getByTestId('task-option-0')).toHaveValue('Correct');
  await expect(page.getByTestId('task-option-0')).toBeFocused();
  await page.getByTestId('task-option-1').fill('Wrong');
  await page.getByTestId('save-task').click();
  await expect(page.getByText('Dashboard quiz question')).toBeVisible();
  await expect(page.getByText(/25 очков · 45 с/)).toBeVisible();

  await page.getByTestId('open-create-task').click();
  await page.getByTestId('task-type-select').selectOption('4');
  await expect(page.getByTestId('task-order-input')).toHaveValue('1');
  await page.getByTestId('task-order-up').click();
  await expect(page.getByTestId('task-order-input')).toHaveValue('0');
  await page.getByTestId('task-order-down').click();
  await expect(page.getByTestId('task-order-input')).toHaveValue('1');
  await page.getByTestId('task-text-input').fill('Dashboard poll question');
  await page.getByTestId('task-option-0').fill('Poll A');
  await page.getByTestId('task-option-1').fill('Poll B');
  await page.getByTestId('save-task').click();
  await expect(page.getByText('Dashboard poll question')).toBeVisible();

  await page.getByTestId('open-create-task').click();
  await page.getByTestId('task-type-select').selectOption('2');
  await page.getByTestId('task-text-input').fill('Dashboard order question');
  await page.getByTestId('task-option-0').click();
  await page.getByTestId('task-option-0').pressSequentially('First step', { delay: 5 });
  await expect(page.getByTestId('task-option-0')).toHaveValue('First step');
  await expect(page.getByTestId('task-option-0')).toBeFocused();
  await page.getByTestId('task-option-1').fill('Second step');

  const orderInputBox = await page.getByTestId('task-option-0').boundingBox();
  const removeButtonBox = await page.getByTestId('remove-task-option-0').boundingBox();
  expect(orderInputBox?.width ?? 0).toBeGreaterThan((removeButtonBox?.width ?? 0) * 3);

  await page.getByTestId('save-task').click();
  await expect(page.getByText('Dashboard order question')).toBeVisible();

  await page.getByTestId('dashboard-tab-info').click();
  await page.getByTestId('submit-verification').click();
  await expect(page.getByTestId('game-status')).toHaveText('Проверена');
  await page.getByTestId('game-title-input').click();
  await page.getByTestId('game-title-input').press('End');
  await page.getByTestId('game-title-input').pressSequentially('!', { delay: 5 });
  await expect(page.getByRole('dialog')).toContainText('Статус проверки будет сброшен');
  await page.getByTestId('verified-edit-confirm').click();
  await expect(page.getByTestId('game-title-input')).toHaveValue('Dashboard UI Game!');

  await page.getByTestId('dashboard-tab-stats').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-csv').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('Dashboard UI Game');
});

test('real puzzle play page uses localized header and wider layout', async ({ page }) => {
  const author = await login('author@e2e.test');
  const player = await login('player@e2e.test');
  const game = await createVerifiedPuzzleGame(author.accessToken);

  await seedBrowserAuth(page, player.accessToken);
  await page.goto(`/game/${game.id}/play`);

  await expect(page.getByTestId('task-type-badge')).toHaveText('Порядок');
  await expect(page.getByText('Задание 1 из 1')).toBeVisible();
  await expect(page.getByText('100 очков')).toBeVisible();

  const cardBox = await page.getByTestId('play-card').boundingBox();
  expect(cardBox?.width ?? 0).toBeGreaterThan(1000);
  const badgeBox = await page.getByTestId('task-type-badge').boundingBox();
  const titleBox = await page.getByTestId('task-progress-title').boundingBox();
  const pointsBox = await page.getByTestId('task-points-label').boundingBox();
  expect(badgeBox?.x ?? 0).toBeLessThan(titleBox?.x ?? 0);
  expect((pointsBox?.x ?? 0) + (pointsBox?.width ?? 0)).toBeGreaterThan((titleBox?.x ?? 0) + (titleBox?.width ?? 0));
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

test('real owner stats paginate and expand open-ended answers through UI', async ({ page }) => {
  const author = await login('author@e2e.test');
  const player = await login('player@e2e.test');
  const game = await createVerifiedOpenAnswerGame(author.accessToken);

  for (let i = 1; i <= 6; i++) {
    await completeOpenAnswerAttempt(player.accessToken, game.id, `Open answer ${i}\nfull detail line ${i}`);
  }

  await seedBrowserAuth(page, author.accessToken);
  await page.goto('/my-games');
  await page.getByTestId('game-list-item').filter({ hasText: 'Real E2E Open Answers Game' }).first().click();
  await page.getByTestId('dashboard-tab-stats').click();

  await expect(page.getByTestId('open-answer-box')).toHaveCount(5);
  await expect(page.getByText('full detail line 6')).toHaveCount(0);
  await page.getByTestId('open-answer-toggle').first().click();
  await expect(page.getByText('full detail line 6')).toBeVisible();
  await page.getByTestId('load-open-answers-more').click();
  await expect(page.getByTestId('open-answer-box')).toHaveCount(6);
});

test('real admin guard and dashboard status controls work through UI', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);

  const player = await login('player@e2e.test');
  await seedBrowserAuth(page, player.accessToken);
  await page.goto('/admin');
  await expect(page).toHaveURL('http://127.0.0.1:5174/');

  const author = await login('author@e2e.test');
  const admin = await login('admin@e2e.test');
  const game = await createVerifiedQuizGame(author.accessToken, 'Admin UI Status Game');

  const adminPage = await page.context().newPage();
  await seedBrowserAuth(adminPage, admin.accessToken);
  await adminPage.goto('/admin');
  await adminPage.getByTestId('game-list-item').filter({ hasText: 'Admin UI Status Game' }).first().click();
  await expect(adminPage.getByText('Admin UI Status Game')).toBeVisible();

  await adminPage.getByTestId('admin-reject').click();
  await expect(adminPage.getByTestId('game-status')).toHaveText('Отклонена');
  await adminPage.getByTestId('admin-unverify').click();
  await expect(adminPage.getByTestId('game-status')).toHaveText('Черновик');
  await adminPage.getByTestId('admin-verify').click();
  await expect(adminPage.getByTestId('game-status')).toHaveText('Проверена');
});

test('real visibility rules hide non-public games from anonymous and other players', async ({ page }) => {
  const author = await login('author@e2e.test');
  const player = await login('player@e2e.test');
  const draft = await createGameViaApi(author.accessToken, 'Private Draft Visibility Game');
  await createTaskViaApi(author.accessToken, draft.id, {
    type: 0,
    order: 0,
    text: 'Draft question',
    points: 10,
    timeLimitMs: 30000,
    options: ['A', 'B'],
    correctOptionIndex: 0,
  });

  const anonymous = await requestFactory.newContext({ baseURL: apiBase });
  expect(await (await anonymous.get('/v1/games')).text()).not.toContain('Private Draft Visibility Game');
  await anonymous.dispose();

  const playerApi = await authed(player.accessToken);
  expect(await (await playerApi.get('/v1/games')).text()).not.toContain('Private Draft Visibility Game');
  expect((await playerApi.get(`/v1/games/${draft.id}`)).status()).toBe(404);
  await playerApi.dispose();

  const ownerApi = await authed(author.accessToken);
  expect(await (await ownerApi.get('/v1/games')).text()).toContain('Private Draft Visibility Game');
  await ownerApi.dispose();

  await submitGameForVerification(author.accessToken, draft.id);
  await page.goto('/games');
  await expect(page.getByText('Private Draft Visibility Game')).toBeVisible();
});

test('real gameplay rejects empty games, invalid answers and stale question tokens', async () => {
  const author = await login('author@e2e.test');
  const player = await login('player@e2e.test');
  const empty = await createGameViaApi(author.accessToken, 'Empty Game');
  const admin = await login('admin@e2e.test');
  const adminApi = await authed(admin.accessToken);
  await adminApi.put(`/v1/admin/games/${empty.id}/status?status=1`);
  await adminApi.dispose();

  const playerApi = await authed(player.accessToken);
  const emptyStart = await playerApi.post(`/v1/games/${empty.id}/start`);
  expect(emptyStart.status()).toBe(400);
  expect(await emptyStart.text()).toContain('Game has no tasks');

  const quiz = await createVerifiedQuizGame(author.accessToken, 'Gameplay Negative Game');
  const start = await playerApi.post(`/v1/games/${quiz.id}/start`);
  expect(start.ok()).toBeTruthy();
  const first = (await start.json()) as StartResponse;

  const missingAnswer = await playerApi.post(`/v1/games/${quiz.id}/answer`, {
    data: { attemptId: first.attemptId, questionToken: first.questionToken },
  });
  expect(missingAnswer.status()).toBe(400);
  expect(await missingAnswer.text()).toContain('SelectedOptionId is required');

  const selectedOptionId = first.task.options.find(o => o.text === '4')?.id ?? first.task.options[0].id;
  const ok = await playerApi.post(`/v1/games/${quiz.id}/answer`, {
    data: { attemptId: first.attemptId, questionToken: first.questionToken, selectedOptionId },
  });
  expect(ok.ok()).toBeTruthy();

  const stale = await playerApi.post(`/v1/games/${quiz.id}/answer`, {
    data: { attemptId: first.attemptId, questionToken: first.questionToken, selectedOptionId },
  });
  expect(stale.ok()).toBeTruthy();
  expect(await stale.json()).toMatchObject({ finished: true, reason: 'AlreadyFinished' });
  await playerApi.dispose();
});

test('real player completes mixed game and result renders with leaderboard', async ({ page }) => {
  const author = await login('author@e2e.test');
  const player = await login('player@e2e.test');
  const game = await createMixedGame(author.accessToken);
  const api = await authed(player.accessToken);
  const { finished, answers } = await completeGame(api, game.id);

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

test('real leaderboard ranks perfect attempts and renders on game details page', async ({ page }) => {
  const author = await login('author@e2e.test');
  const player = await login('player@e2e.test');
  const game = await createVerifiedQuizGame(author.accessToken, 'Leaderboard Perfect Game');
  const api = await authed(player.accessToken);
  const { finished } = await completeGame(api, game.id);

  expect(finished.score).toBe(finished.maxScore);
  expect(finished.correctAnswers).toBe(finished.totalTasks);

  const leaderboard = await api.get(`/v1/games/${game.id}/leaderboard`);
  expect(leaderboard.ok()).toBeTruthy();
  const items = await leaderboard.json();
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    displayName: 'Player',
    score: 100,
    maxScore: 100,
    correctAnswers: 1,
    totalTasks: 1,
  });

  const limited = await api.get(`/v1/games/${game.id}/leaderboard?limit=1`);
  expect((await limited.json()).length).toBeLessThanOrEqual(1);

  await page.goto(`/game/${game.id}`);
  await expect(page.getByText('Leaderboard Perfect Game')).toBeVisible();
  await expect(page.getByText('Player')).toBeVisible();
  await api.dispose();
});

test('real game play redirects anonymous users to login', async ({ page }) => {
  const author = await login('author@e2e.test');
  const game = await createMixedGame(author.accessToken);

  await page.goto(`/game/${game.id}/play`);
  await expect(page).toHaveURL(/\/login/);
});

test('public route shell renders home, about and not-found pages', async ({ page }) => {
  for (const path of ['/', '/about', '/missing-e2e-route']) {
    await page.goto(path);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(10);
  }
});
