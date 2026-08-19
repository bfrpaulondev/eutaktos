import { expect, test } from '@playwright/test';

test('core shell is keyboard reachable and responsive', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await expect(page.getByText('Smart Assign')).toBeVisible();
});

test('preference changes persist after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Idioma').selectOption('en');
  await page.reload();
  await expect(page.getByText('Everything that needs your attention.')).toBeVisible();
});
