// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import path from 'path';
import { TIMEOUT } from './tests/data/timeouts';
import { BASE_URL, IS_LOCAL_ENV } from './tests/data/env';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  outputDir: 'test-results',
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI, y 1 reintento en local para absorber flakes residuales mientras se estabiliza la suite. */
  retries: process.env.CI ? 2 : 1,
  /* workers:1. Paralelizar (workers>1) NO es seguro: todos comparten la misma cuenta de staging
   * (auth.json) y el backend pisa la sesión → "El paciente es obligatorio" en concurrencia.
   * El acoplamiento "primera fila" YA se resolvió (id desde la respuesta del POST); el bloqueante
   * restante es la cuenta compartida (haría falta storageState por worker). */
  workers: 1,
  /* Timeout por test: los flujos de creación por UI son largos. */
  timeout: TIMEOUT.TEST,
  /* Timeout por defecto de todas las aserciones expect(), centralizado en
   * tests/data/timeouts.js junto al resto. */
  expect: { timeout: TIMEOUT.EXPECT },
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [['html'], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : 'html',
  globalSetup: path.resolve(__dirname, 'global-setup.js'),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    headless: true,
    /* Conserva video solo cuando el test falla: ahorra disco y acelera las corridas verdes. */
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    baseURL: BASE_URL,
    /* Certificado de la CA local de Herd: solo se ignora en entornos .test/localhost. */
    ignoreHTTPSErrors: IS_LOCAL_ENV,
    storageState: path.resolve(__dirname, 'auth.json'),
    trace: 'on-first-retry',
    /* Timeouts de acción y navegación centralizados en tests/data/timeouts.js. */
    actionTimeout: TIMEOUT.ACTION,
    navigationTimeout: TIMEOUT.NAVIGATION_DEFAULT,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});

