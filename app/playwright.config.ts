import { defineConfig } from '@playwright/test';

// E2E com o motor fake (sem rede). Usa o build em ../treinar servido pelo `vite preview`.
const porta = Number(process.env.E2E_PORTA ?? 4179);
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: { baseURL: process.env.E2E_URL ?? `http://127.0.0.1:${porta}/`, viewport: { width: 1280, height: 860 } },
  webServer: process.env.E2E_URL
    ? undefined
    : { command: `npx vite preview --port ${porta} --strictPort --host 127.0.0.1`, url: `http://127.0.0.1:${porta}/`, reuseExistingServer: false },
});
