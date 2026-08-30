import { expect, test } from '@playwright/test';

test.describe('VisionQA login', () => {
  test('redirects root and renders login', async ({ page }) => { await page.goto('/'); await expect(page).toHaveURL(/\/login$/); await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible(); await expect(page.getByLabel('Email address')).toBeVisible(); await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible(); });
  test('validates fields, toggles password, and shows safe auth errors', async ({ page }) => { const password = () => page.getByRole('textbox', { name: 'Password' }); await page.goto('/login'); await page.getByRole('button', { name: 'Sign in' }).click(); await expect(page.getByText('Email is required.')).toBeVisible(); await expect(page.getByText('Password is required.')).toBeVisible(); await page.getByLabel('Email address').fill('not-an-email'); await password().fill('wrong'); await page.getByRole('button', { name: 'Show password' }).click(); await expect(password()).toHaveAttribute('type', 'text'); await page.getByRole('button', { name: 'Sign in' }).click(); await expect(page.getByText('Please enter a valid email address.')).toBeVisible(); await page.getByLabel('Email address').fill('qa@example.com'); await page.getByRole('button', { name: 'Sign in' }).click(); await expect(page.getByRole('button', { name: 'Signing in...' })).toBeDisabled(); await expect(page.getByRole('alert')).toHaveText(/Invalid email or password|Unable to sign in/); });
  test('routes a configured Firebase login to dashboard', async ({ page }) => {
    test.skip(!process.env.FIREBASE_E2E_EMAIL || !process.env.FIREBASE_E2E_PASSWORD, 'Set FIREBASE_E2E_EMAIL and FIREBASE_E2E_PASSWORD for Firebase E2E verification.');
    await page.goto('/login');
    await page.getByLabel('Email address').fill(process.env.FIREBASE_E2E_EMAIL!);
    await page.getByRole('textbox', { name: 'Password' }).fill(process.env.FIREBASE_E2E_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
