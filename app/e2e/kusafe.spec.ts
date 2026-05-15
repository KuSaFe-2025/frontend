import { expect, test } from '@playwright/test';

const gameId = '11111111-1111-1111-1111-111111111111';
const taskId = '22222222-2222-2222-2222-222222222222';

function game(status: number) {
  return {
    id: gameId,
    title: 'Algebra Sprint',
    description: 'Fast mixed practice',
    descriptionFormat: 1,
    tasksCount: 1,
    themeColor: '#2563EB',
    status,
    lastModeratedAtUtc: status === 1 ? '2026-05-15T10:00:00Z' : null,
    moderationDecision: status === 1 ? 'Approved by local AI moderation (4/5 YES).' : null,
    moderationYesVotes: status === 1 ? 4 : 0,
    moderationNoVotes: status === 1 ? 1 : 0,
    ownerUserId: '33333333-3333-3333-3333-333333333333',
    ownerDisplayName: 'Teacher',
    canEdit: true,
    createdAtUtc: '2026-05-10T10:00:00Z',
    updatedAtUtc: '2026-05-15T10:00:00Z',
    taskTypeCounts: [{ type: 0, count: 1 }],
    tasks: [
      {
        id: taskId,
        type: 0,
        order: 0,
        text: 'What is 2 + 2?',
        points: 100,
        timeLimitMs: 60000,
        correctOptionId: '44444444-4444-4444-4444-444444444444',
        options: [
          { id: '44444444-4444-4444-4444-444444444444', text: '4', isActive: true, sortOrder: 0 },
          { id: '55555555-5555-5555-5555-555555555555', text: '5', isActive: true, sortOrder: 1 },
        ],
      },
    ],
  };
}

const stats = {
  gameId,
  attemptsCount: 2,
  averageScore: 75,
  averageTimeMs: 42000,
  perfectRate: 0.5,
  tasks: [
    {
      taskId,
      text: 'What is 2 + 2?',
      type: 0,
      attempts: 2,
      correctAnswers: 1,
      incorrectAnswers: 1,
      neutralAnswers: 0,
      totalAnswers: 2,
      accuracyRate: 0.5,
      recentOpenAnswers: [],
      pollOptions: [],
    },
  ],
};

async function mockApi(page: any) {
  let submitted = false;
  await page.route('https://localhost:7267/**', async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (url.pathname === '/v1/games') return route.fulfill({ json: [game(1)] });
    if (url.pathname === `/v1/games/${gameId}`) return route.fulfill({ json: game(1) });
    if (url.pathname === `/v1/games/${gameId}/leaderboard`) {
      return route.fulfill({
        json: [
          {
            userId: '66666666-6666-6666-6666-666666666666',
            displayName: 'Player One',
            totalTimeMs: 32000,
            finishedAtUtc: '2026-05-15T10:30:00Z',
            score: 100,
            maxScore: 100,
            correctAnswers: 1,
            totalTasks: 1,
          },
        ],
      });
    }

    if (url.pathname === '/v1/my/games') return route.fulfill({ json: [game(submitted ? 1 : 0)] });
    if (url.pathname === `/v1/my/games/${gameId}`) return route.fulfill({ json: game(submitted ? 1 : 0) });
    if (url.pathname === `/v1/my/games/${gameId}/stats`) return route.fulfill({ json: stats });
    if (url.pathname === `/v1/my/games/${gameId}/submit-for-verification` && method === 'POST') {
      submitted = true;
      return route.fulfill({ json: { status: 1, moderationDecision: 'Approved by local AI moderation (4/5 YES).' } });
    }
    if (url.pathname === `/v1/my/games/${gameId}/stats/export.csv`) {
      return route.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="game-results.csv"',
        },
        body: 'attemptId,displayName,taskText\n1,Player One,What is 2 + 2?\n',
      });
    }

    return route.fulfill({ status: 404, body: 'not mocked' });
  });
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('catalog, game details and leaderboard render verified games', async ({ page }) => {
  await page.goto('/games');
  await expect(page.getByRole('heading', { name: 'Игры' })).toBeVisible();
  await expect(page.getByText('Algebra Sprint')).toBeVisible();
  await page.getByText('Открыть игру').click();
  await expect(page.getByText('VERIFIED')).toBeVisible();
  await expect(page.getByText('Approved by local AI moderation')).toBeVisible();
  await expect(page.getByText('Player One')).toBeVisible();
  await expect(page.getByText('100/100')).toBeVisible();
});

test('author dashboard shows moderation, stats and CSV export', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kusafe_access_token', 'test-token'));
  await page.goto('/my-games');
  await expect(page.getByRole('complementary').getByText('Мои игры')).toBeVisible();
  await expect(page.getByText('Algebra Sprint')).toBeVisible();
  await expect(page.getByText('Статистика')).toBeVisible();
  await expect(page.getByText('ответов 2 · верных 1 · ошибок 1')).toBeVisible();

  await page.getByRole('button', { name: 'На проверку' }).click();
  await expect(page.getByText('VERIFIED').first()).toBeVisible();
  await expect(page.getByText('Approved by local AI moderation')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('Algebra Sprint-results.csv');
});
