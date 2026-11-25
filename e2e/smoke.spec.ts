import { expect, test } from '@playwright/test';

test('app loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Lớp Nhạc Vui' })).toBeVisible();
});
