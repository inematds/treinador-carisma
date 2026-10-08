// Sessão real gravada (evidência da Fase 2): gateway + Ollama de verdade + microfone falso, mãos-livres.
// Rodar: E2E_GATEWAY=http://127.0.0.1:8787 E2E_MODELO=qwen3:30b npx playwright test --project sessao-real
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

test.describe.configure({ timeout: 240_000 });

test('sessão real: duas trocas por voz com o modelo local, latência medida no navegador', async ({ page }, info) => {
  const modelo = process.env.E2E_MODELO ?? 'qwen3:30b';
  page.on('pageerror', (e) => {
    throw e;
  });
  page.on('console', (m) => m.text().startsWith('[tc-latencia]') && console.log(m.text()));
  await page.addInitScript((m) => {
    localStorage.setItem(
      'tc-config-v1',
      JSON.stringify({ tipo: 'gateway', gatewayMotor: 'ollama', modelo: m, modo: 'carisma', treinador: 'executivo', iniciado: true, maosLivres: true, vozAuto: true, pausaAuto: true }),
    );
  }, modelo);
  await page.goto('./');
  await page.locator('[data-cena="feedback-atraso"]').click();
  await page.getByRole('button', { name: /Entrar na cena/ }).click();
  await expect(page.getByTestId('maos-livres')).toBeVisible();
  const minhas = page.locator('.balao.eu');
  await expect(minhas.nth(1)).toBeVisible({ timeout: 150_000 });
  await expect(page.locator('.balao.personagem').nth(2)).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(4000);
  const lat = await page.evaluate(() => window.__tcLatencias ?? []);
  const transcricao = await page.locator('.balao').allInnerTexts();
  console.log(`latências (ms): ${lat.join(', ')}`);
  const pasta = process.env.E2E_EVIDENCIAS;
  if (pasta) {
    mkdirSync(pasta, { recursive: true });
    writeFileSync(
      join(pasta, 'sessao-real.json'),
      JSON.stringify({ quando: new Date().toISOString(), modelo, latencias_ms: lat, transcricao: transcricao.map((t) => t.replace(/\n/g, ': ')) }, null, 2),
    );
  }
  info.annotations.push({ type: 'latencias', description: lat.join(', ') });
  expect(lat.length).toBeGreaterThanOrEqual(2);
});
