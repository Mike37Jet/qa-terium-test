// Resolución del entorno bajo prueba. Fuente única para playwright.config.js y global-setup.js.
import dotenv from 'dotenv';
import path from 'path';

// El .env solo se carga en local: en CI las variables las inyecta el runner.
if (!process.env.CI) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

export const BASE_URL = process.env.BASE_URL || 'https://demo.staging.terium-labs.com';

// Herd sirve los dominios .test con una CA local que Playwright no reconoce; sin esto
// el primer goto falla por certificado. Se activa solo en entornos locales, nunca en staging.
export const IS_LOCAL_ENV = /(\.test$)|^localhost$|^127\.0\.0\.1$/
  .test(new URL(BASE_URL).hostname);
