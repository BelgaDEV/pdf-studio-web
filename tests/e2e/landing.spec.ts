import { expect, test } from '@playwright/test'

test('tool-first landing makes the main PDF actions immediately visible', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /O que você precisa fazer/i })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Juntar PDF' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dividir PDF' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Comprimir PDF' }).first()).toBeVisible()
  await expect(page.getByRole('textbox', { name: /Buscar ferramenta PDF/i })).toBeVisible()
})

test('all-tools navigation opens a 25-tool mega menu', async ({ page }) => {
  await page.goto('/')

  const trigger = page.getByRole('button', { name: /Todas as ferramentas/i })
  await trigger.hover()
  await expect(page.getByText('Todas as ferramentas em um só lugar')).toBeVisible()
  await expect(page.locator('.mega-menu-tool')).toHaveCount(25)
  await expect(page.getByRole('link', { name: /Comparar PDF/i }).first()).toBeVisible()
})

test('comparison has a direct navigation shortcut', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: 'Comparar PDF', exact: true }).click()
  await expect(page).toHaveURL(/\/tool\/compare$/)
  await expect(page.getByRole('heading', { name: /Comparar PDFs/i })).toBeVisible()
})

test('landing preserves privacy, redline and commercial sections', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('#legal-redline')).toContainText('Veja o que mudou')
  await expect(page.locator('#privacidade')).toContainText('Seu documento não precisa viajar')
  await expect(page.locator('#planos')).toContainText('PROFISSIONAL')
})


test('tool navigation always starts at the top of the destination tool', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.getByRole('link', { name: 'Comprimir PDF', exact: true }).first().click()
  await expect(page).toHaveURL(/\/tool\/compress$/)
  await page.waitForFunction(() => window.scrollY === 0)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})

test('mega-menu descriptions are readable and can wrap to two lines', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Todas as ferramentas/i }).hover()
  const description = page.locator('.mega-menu-tool small').first()
  await expect(description).toBeVisible()
  const metrics = await description.evaluate((el) => {
    const style = getComputedStyle(el)
    return { fontSize: parseFloat(style.fontSize), whiteSpace: style.whiteSpace }
  })
  expect(metrics.fontSize).toBeGreaterThanOrEqual(9.5)
  expect(metrics.whiteSpace).toBe('normal')
})


test('unknown routes and invalid tools render a real 404', async ({ page }) => {
  await page.goto('/nao-existe')
  await expect(page.getByRole('heading', { name: /Essa página não existe/i })).toBeVisible()
  await page.goto('/tool/nao-existe')
  await expect(page.getByRole('heading', { name: /Essa página não existe/i })).toBeVisible()
})

test('public trust pages are reachable from the footer', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Privacidade' }).last().click()
  await expect(page).toHaveURL(/\/privacy$/)
  await expect(page.getByRole('heading', { name: /Privacidade por arquitetura/i })).toBeVisible()
})
