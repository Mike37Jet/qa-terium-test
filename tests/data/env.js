// Resolución del entorno bajo prueba. Fuente única para playwright.config.js y global-setup.js.
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// El .env solo se carga en local: en CI las variables las inyecta el runner.
if (!process.env.CI) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

const STAGING_URL = 'https://demo.staging.terium-labs.com';

// Cuando la suite vive dentro del repo de la app (p. ej. en /e2e), el APP_URL de Laravel
// ya es el dominio de Herd del dev: se reutiliza para que no tenga que configurar nada.
// Exige que exista `artisan` al lado del .env, para no leer un archivo ajeno por accidente.
function appUrlFromLaravel() {
  const appRoot = path.resolve(process.cwd(), '..');
  if (!fs.existsSync(path.join(appRoot, 'artisan'))) return null;

  const envPath = path.join(appRoot, '.env');
  if (!fs.existsSync(envPath)) return null;

  const match = fs.readFileSync(envPath, 'utf8').match(/^\s*APP_URL\s*=\s*(.+)$/m);
  const url = match?.[1].trim().replace(/^["']|["']$/g, '');
  return url || null;
}

// Precedencia: variable explícita > APP_URL de la app > staging.
const detected = process.env.BASE_URL ? null : appUrlFromLaravel();
export const BASE_URL = process.env.BASE_URL || detected || STAGING_URL;

// De dónde salió la URL. Se muestra al arrancar para que el dev sepa contra qué corre.
export const BASE_URL_SOURCE = process.env.BASE_URL
  ? 'variable BASE_URL'
  : detected
    ? 'APP_URL del .env de la aplicación'
    : 'valor por defecto (staging)';

// Herd sirve los dominios .test con una CA local que Playwright no reconoce; sin esto
// el primer goto falla por certificado. Se activa solo en entornos locales, nunca en staging.
export const IS_LOCAL_ENV = /(\.test$)|^localhost$|^127\.0\.0\.1$/
  .test(new URL(BASE_URL).hostname);
