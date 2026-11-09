import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API = process.env['E2E_API_URL'] ?? 'http://localhost:3000/api/admin';
export const ADMIN = {
  email: process.env['E2E_ADMIN_EMAIL'] ?? 'ops@masrafy.local',
  password: process.env['E2E_ADMIN_PASSWORD'] ?? 'ChangeMe_OnFirstLogin_!2026',
};

/** Sign in through the login screen, as an operator does. */
export async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('input[formcontrolname=email]', ADMIN.email);
  await page.fill('input[formcontrolname=password]', ADMIN.password);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

/** A bearer token for the cleanup calls. */
export async function apiToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: ADMIN });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { data: { accessToken: string } }).data.accessToken;
}

/** Page overflow sideways — 0 on every screen. */
export async function overflowX(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** Uncaught page errors seen while a test runs. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}
