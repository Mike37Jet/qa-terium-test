import {expect} from '@playwright/test';
import { ROUTE } from '../data/routes';

export class LoginPage {
  constructor(page) {
    this.page = page;
    this.email = page.locator('input[name="correo"]');
    this.password = page.locator('input[name="password"]');
    this.submit = page.getByRole('button', { name: /Ingresar/i });
    this.errorBanner = page
      .locator(':is([role="alert"], [class*="alert-danger"], [class*="alert-warning"])')
      .or(page.getByText(/ocurrió un error al iniciar sesión|estas credenciales no coinciden/i))
      .first();
  }

  async goto() {
    await this.page.goto(ROUTE.login, { waitUntil: 'domcontentloaded' });
    await expect(this.email).toBeVisible();
    await expect(this.password).toBeVisible();
  }

  async submitLoginForm(email, password) {
    await expect(this.email).toBeVisible();
    await expect(this.password).toBeVisible();
    await this.email.fill(email);
    await this.password.fill(password);

    try {
      await this.submit.click();
    } catch {
      await this.page.click('button[type="submit"]');
    }
  }
}
