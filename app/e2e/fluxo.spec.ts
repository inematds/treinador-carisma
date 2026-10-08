import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
});

test('ciclo completo no modo Carisma: cena → pausa → correção → refazer → comparação', async ({ page }) => {
  await page.goto('?motor=fake');
  await expect(page.getByRole('heading', { name: /Se ensaia/ })).toBeVisible();
  await page.getByRole('button', { name: /Carisma/ }).first().click();
  await page.getByRole('button', { name: /Ricardo Alves/ }).click();
  await page.getByRole('button', { name: /Começar o treino/ }).click();

  // painel: conversa com o treinador propõe uma cena
  await page.getByLabel('Sua fala').fill('Quero treinar conversa difícil');
  await page.getByLabel('Sua fala').press('Enter');
  await page.getByRole('button', { name: /Ensaiar:/ }).click();

  await page.getByRole('button', { name: /Entrar na cena/ }).click();
  const fala = page.getByLabel('Sua fala');
  for (const t of ['Oi, tudo bem?', 'Queria falar das reuniões.', 'Podemos combinar um horário?']) {
    await fala.fill(t);
    await fala.press('Enter');
    await expect(page.locator('.balao.eu').filter({ hasText: t })).toBeVisible();
  }
  // 3ª fala encerra a cena (fake) e o avaliador entra sozinho
  const correcao = page.getByTestId('correcao');
  await expect(correcao).toBeVisible();
  await expect(correcao).toContainText('Abra com um fato concreto');
  const nota1 = Number(await page.getByTestId('nota-geral').textContent());

  await page.getByRole('button', { name: /Refazer a cena/ }).click();
  await fala.fill('Marcos, nas três últimas reuniões você chegou depois das 9h15 e a gente repetiu a pauta.');
  await fala.press('Enter');
  await page.getByRole('button', { name: /Pausa: me avalie/ }).click();
  await expect(correcao).toBeVisible();
  const nota2 = Number(await page.getByTestId('nota-geral').textContent());
  expect(nota2).toBeGreaterThan(nota1);
  await expect(page.getByText('comparado à tentativa anterior')).toBeVisible();
  await expect(page.locator('.seta-sobe').first()).toBeVisible();

  // progresso registrado no painel
  await page.getByRole('button', { name: /Outra cena/ }).click();
  await expect(page.getByText('2 tentativas')).toBeVisible();
});

test('modo Conquista: escolhe treinador(a), quem aborda e troca a variante', async ({ page }) => {
  await page.goto('?motor=fake');
  await page.getByRole('button', { name: /Conquista/ }).first().click();
  await expect(page.getByRole('button', { name: /Valentina/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Henrique/ })).toBeVisible();
  await page.getByRole('button', { name: /Um homem/ }).click();
  await page.getByRole('button', { name: /Começar o treino/ }).click();
  const cena = page.locator('[data-cena="cafe-abertura"]');
  const comHomem = await cena.textContent();
  await page.getByTitle('Trocar com quem você conversa nas cenas').click();
  await expect(cena).not.toHaveText(comHomem ?? '');
  await cena.click();
  await page.getByRole('button', { name: /Entrar na cena/ }).click();
  await expect(page.getByText(/Puxe a conversa/)).toBeVisible();
});

test('configuração mostra os motores da Edição Nuvem', async ({ page }) => {
  await page.goto('?motor=fake');
  await page.getByRole('button', { name: 'Configurar IA' }).click();
  for (const nome of ['Ollama direto', 'No navegador (grátis)', 'OpenRouter (sua conta)', 'OpenAI (sua chave)', 'Anthropic (sua chave)', 'Demonstração']) {
    await expect(page.getByRole('button', { name: new RegExp(nome.replace(/[()]/g, '\\$&')) })).toBeVisible();
  }
  await page.getByRole('button', { name: /OpenRouter/ }).click();
  await expect(page.getByRole('button', { name: 'Entrar com OpenRouter' })).toBeVisible();
});

test('pausa automática: fala grosseira derruba a paciência e o treinador entra sozinho', async ({ page }) => {
  await page.goto('?motor=fake');
  await page.getByRole('button', { name: /Carisma/ }).first().click();
  await page.getByRole('button', { name: /Ricardo Alves/ }).click();
  await page.getByRole('button', { name: /Começar o treino/ }).click();
  await page.getByLabel('Sua fala').fill('Quero treinar conversa difícil');
  await page.getByLabel('Sua fala').press('Enter');
  await page.getByRole('button', { name: /Ensaiar:/ }).click();
  await page.getByRole('button', { name: /Entrar na cena/ }).click();
  const fala = page.getByLabel('Sua fala');
  await fala.fill('Bom dia, podemos conversar?');
  await fala.press('Enter');
  await expect(page.locator('.balao.personagem').last()).toBeVisible();
  await fala.fill('Tanto faz, cala a boca.');
  await fala.press('Enter');
  await expect(page.getByTestId('correcao')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.legenda').first()).toContainText('Pausa: a paciência está acabando');
});
