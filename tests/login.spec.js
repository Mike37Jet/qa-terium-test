import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { LOGIN } from './data/test-data';
import { ROUTE } from './data/routes';

test.use({ storageState: undefined });

test.beforeEach(async ({ page, baseURL }) => {
  await page.context().clearCookies();
  await page.goto(`${baseURL ?? ''}${ROUTE.login}`, { waitUntil: 'domcontentloaded' });
});

for (const credentials of LOGIN.cases) {
  test(`Login - ${credentials.name}`, async ({ page }) => {
    const login = new LoginPage(page);

    await expect(login.email).toBeVisible();
    await expect(login.password).toBeVisible();

    await login.submitLoginForm(credentials.email, credentials.pass);

    if (credentials.expectSuccess) {
      await expect(page).toHaveURL(LOGIN.welcomeUrl);
    } else {
      await expect(page).not.toHaveURL(LOGIN.welcomeUrl);
      await expect(login.errorBanner).toBeVisible();
    }
  });
}
