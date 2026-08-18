// global-setup.js
import { chromium } from '@playwright/test';
import path from 'path';
import { BASE_URL, IS_LOCAL_ENV } from './tests/data/env';

export default async (config) => {
  const baseURL = BASE_URL;
  const user = process.env.AUTH_USER;
  const password = process.env.AUTH_PASS;

  if (!user || !password) {
    throw new Error('AUTH_USER and AUTH_PASS must be set in environment (.env) for global-setup.');
  }

  const browser = await chromium.launch();
  // newPage() NO hereda `use` de playwright.config.js: sin esto el login contra Herd
  // falla por certificado antes de que arranque un solo test.
  const page = await browser.newPage({ ignoreHTTPSErrors: IS_LOCAL_ENV });
  await page.goto(`${baseURL}/login`);

  await page.fill('input[name="correo"]', user);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]:has-text("Ingresar")');

  await page.waitForURL(/.*bienvenida/);

  const storagePath = path.resolve(process.cwd(), 'auth.json');
  await page.context().storageState({ path: storagePath });

  await browser.close();
  return;
};
