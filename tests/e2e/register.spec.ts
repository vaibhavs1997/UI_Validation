import { expect, test } from '@playwright/test';

test.describe('VisionQA registration', () => {
  test('renders the registration form and sign-in link', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(page.getByLabel('Work email')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  test('validates name, email, password, confirmation, and terms', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Please enter your full name.')).toBeVisible();
    await expect(page.getByText('Please enter your email address.')).toBeVisible();
    await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible();
    await expect(page.getByText('Please confirm your password.')).toBeVisible();
    await expect(page.getByText('You must agree to the Terms and Privacy Policy.')).toBeVisible();

    await page.getByLabel('Full name').fill('QA User');
    await page.getByLabel('Work email').fill('invalid');
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('short');
    await page.getByRole('textbox', { name: 'Confirm password' }).fill('different');
    await expect(page.getByRole('button', { name: 'Show password' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Show password' }).first().click();
    await expect(page.getByRole('textbox', { name: 'Password', exact: true })).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Passwords do not match.')).toBeVisible();
  });

  test('requires terms and routes a configured Firebase registration to dashboard', async ({ page }) => {
    test.skip(process.env.FIREBASE_E2E_RUN !== 'true', 'Set FIREBASE_E2E_RUN=true for Firebase E2E verification.');
    await page.goto('/register');
    await page.getByLabel('Full name').fill('QA User');
    await page.getByLabel('Work email').fill(`qa-${Date.now()}@example.com`);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('Secure123');
    await page.getByRole('textbox', { name: 'Confirm password' }).fill('Secure123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('You must agree to the Terms and Privacy Policy.')).toBeVisible();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('button', { name: 'Creating account...' })).toBeDisabled();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
