// Mãos-livres contra o gateway local: microfone falso do Chromium + Whisper + voz de verdade.
// Cérebro fake (?motor=fake) para o teste não depender do modelo. Rodar com E2E_GATEWAY.
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

async function entrarNaCena(page: Page) {
  page.on('pageerror', (e) => {
    throw e;
  });
  page.on('console', (m) => m.text().startsWith('[tc-latencia]') && console.log(m.text()));
  await page.goto('?motor=fake');
  await page.getByRole('button', { name: /Carisma/ }).first().click();
  await page.getByRole('button', { name: /Ricardo Alves/ }).click();
  await page.getByRole('button', { name: /Começar o treino/ }).click();
  await page.getByLabel('Sua fala').fill('Quero treinar conversa difícil');
  await page.getByLabel('Sua fala').press('Enter');
  await page.getByRole('button', { name: /Ensaiar:/ }).click();
  await page.getByRole('button', { name: /Entrar na cena/ }).click();
  await page.getByTestId('alternar-maos-livres').check();
  await expect(page.getByTestId('maos-livres')).toBeVisible();
}

test('conversa contínua: ouve, responde em voz e volta a ouvir sem clicar', async ({ page }) => {
  await entrarNaCena(page);
  const minhas = page.locator('.balao.eu');
  await expect(minhas.first()).toContainText(/marcos|minuto|reuni/i, { timeout: 45_000 });
  await expect(page.locator('.balao.personagem').nth(1)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('latencia')).toBeVisible({ timeout: 20_000 });
  // o WAV repete: a segunda fala chega sozinha (o microfone voltou a ouvir depois do personagem)
  await expect(minhas.nth(1)).toBeVisible({ timeout: 45_000 });
  const lat = await page.evaluate(() => window.__tcLatencias ?? []);
  console.log(`latências no navegador (ms): ${lat.join(', ')}`);
  expect(lat.length).toBeGreaterThanOrEqual(1);
});

test('interrompe: falar por cima corta o personagem', async ({ page }) => {
  await entrarNaCena(page);
  await expect(page.locator('.balao.eu').first()).toContainText(/conta mais/i, { timeout: 45_000 });
  await expect(page.getByText('Você interrompeu')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.balao.eu').filter({ hasText: /espera|completar/i })).toBeVisible({ timeout: 30_000 });
  // a fala longa do personagem foi cortada: não chegou à última frase
  await expect(page.locator('.balao.personagem').filter({ hasText: 'ninguém decide nada' })).toHaveCount(0);
});
