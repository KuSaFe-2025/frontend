import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    acceptDownloads: true,
  },
  webServer: [
    {
      command: 'dotnet run --project ..\\..\\KuSaFeBackend\\KuSaFeBackend.csproj --no-launch-profile --urls http://127.0.0.1:5267',
      url: 'http://127.0.0.1:5267/v1/health',
      reuseExistingServer: true,
      timeout: 120000,
      env: {
        ASPNETCORE_ENVIRONMENT: 'E2E',
        ASPNETCORE_URLS: 'http://127.0.0.1:5267',
        Moderation__Provider: process.env.KUSAFE_E2E_OLLAMA === '1' ? 'Ollama' : 'Deterministic',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      url: 'http://127.0.0.1:5173',
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
