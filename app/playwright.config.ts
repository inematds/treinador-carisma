import { defineConfig } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// E2E com o motor fake (sem rede). Usa o build em ../treinar servido pelo `vite preview`.
// Com E2E_GATEWAY=http://127.0.0.1:8787 roda também o mãos-livres contra o gateway local
// (Whisper + voz de verdade, microfone falso do Chromium tocando um WAV gerado na hora).
const porta = Number(process.env.E2E_PORTA ?? 4179);
const gateway = process.env.E2E_GATEWAY;
const audio = (nome: string) => join(dirname(fileURLToPath(import.meta.url)), 'e2e', '.audio', nome);
const microfone = (nome: string) => ({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${audio(nome)}`, '--autoplay-policy=no-user-gesture-required'],
  },
  permissions: ['microphone'],
});

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  globalSetup: './e2e/preparar-audio.ts',
  use: { baseURL: process.env.E2E_URL ?? `http://127.0.0.1:${porta}/`, viewport: { width: 1280, height: 860 } },
  projects: [
    { name: 'fake', testMatch: 'fluxo.spec.ts' },
    ...(gateway
      ? [
          { name: 'maos-livres', testMatch: 'maoslivres.spec.ts', grep: /conversa contínua/, use: { baseURL: `${gateway}/`, ...microfone('conversa.wav') } },
          { name: 'interrupcao', testMatch: 'maoslivres.spec.ts', grep: /interrompe/, use: { baseURL: `${gateway}/`, ...microfone('interrompe.wav') } },
          { name: 'sessao-real', testMatch: 'sessao-real.spec.ts', use: { baseURL: `${gateway}/`, ...microfone('conversa.wav'), video: 'on' } },
        ]
      : []),
  ],
  webServer: process.env.E2E_URL
    ? undefined
    : { command: `npx vite preview --port ${porta} --strictPort --host 127.0.0.1`, url: `http://127.0.0.1:${porta}/`, reuseExistingServer: false },
});
