import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = dirname(fileURLToPath(import.meta.url));
const backendProject = resolve(configDir, '..', '..', 'KuSaFeBackend', 'KuSaFeBackend.csproj');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'on-first-retry',
    acceptDownloads: true,
  },
  webServer: [
    {
      command: `dotnet run --no-restore --project "${backendProject}" --no-launch-profile --urls http://127.0.0.1:5267`,
      url: 'http://127.0.0.1:5267/v1/health',
      reuseExistingServer: true,
      timeout: 120000,
      env: {
        ASPNETCORE_ENVIRONMENT: 'E2E',
        ASPNETCORE_URLS: 'http://127.0.0.1:5267',
        Moderation__Provider: process.env.KUSAFE_E2E_OLLAMA === '1' ? 'Ollama' : 'Deterministic',
        Ai__Provider: 'Deterministic',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5174',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: true,
      timeout: 120000,
      env: {
        VITE_API_BASE_URL: 'http://127.0.0.1:5267',
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
