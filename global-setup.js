// global-setup.js
import { chromium } from '@playwright/test';
import path from 'path';
import { BASE_URL, BASE_URL_SOURCE, IS_LOCAL_ENV } from './tests/data/env';

export default async (config) => {
  const baseURL = BASE_URL;
  const user = process.env.AUTH_USER;
  const password = process.env.AUTH_PASS;

  if (!baseURL) {
    throw new Error(
      `No hay ningún entorno configurado.\n` +
      `  Esta carpeta no está dentro del proyecto de la aplicación (no se encontró su APP_URL)\n` +
      `  y el .env no define BASE_URL.\n` +
      `  Indícalo con:  npm run configure -- --url=https://tu-proyecto.test`,
    );
  }

  console.log(`\n  Entorno: ${baseURL}  (origen: ${BASE_URL_SOURCE})\n`);

  if (!user || !password) {
    throw new Error(
      `Faltan credenciales: AUTH_USER y AUTH_PASS.\n` +
      `  Copia la plantilla y rellénala:  cp .env.example .env`,
    );
  }

  const browser = await chromium.launch();
  // newPage() NO hereda `use` de playwright.config.js: sin esto el login contra Herd
  // falla por certificado antes de que arranque un solo test.
  const page = await browser.newPage({ ignoreHTTPSErrors: IS_LOCAL_ENV });

  // Comprobación previa: si la app no responde, el fallo nativo es un timeout opaco
  // a mitad del login. Mejor detenerse aquí con el motivo real.
  try {
    await page.goto(`${baseURL}/login`);
  } catch (error) {
    await browser.close();
    throw new Error(
      `No se pudo abrir ${baseURL}/login\n` +
      (IS_LOCAL_ENV
        ? `  La aplicación no parece estar levantada. Comprueba que Herd la esté sirviendo\n` +
          `  y que BASE_URL coincida con su dominio.\n`
        : `  El entorno no responde. Revisa BASE_URL y tu conexión.\n`) +
      `  Detalle: ${error.message.split('\n')[0]}`,
    );
  }

  await page.fill('input[name="correo"]', user);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]:has-text("Ingresar")');

  try {
    await page.waitForURL(/.*bienvenida/);
  } catch {
    await browser.close();
    throw new Error(
      `El login no llegó a la página de bienvenida.\n` +
      `  Usuario: ${user}\n` +
      `  Revisa que las credenciales sean válidas en ${baseURL}.`,
    );
  }

  const storagePath = path.resolve(process.cwd(), 'auth.json');
  await page.context().storageState({ path: storagePath });

  await browser.close();
  return;
};
