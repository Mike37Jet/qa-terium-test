# qa-terium

Suite de pruebas end-to-end (Playwright) para Terium.

Cubre los flujos críticos de la aplicación: login, creación de pedidos (*indents*),
creación de órdenes y la conversión de pedido a orden. Se ejecuta sobre **Chromium** y **WebKit**.

## Requisitos

- Node.js 18 o superior
- La aplicación levantada, en local (Herd) o accesible en staging

## Instalación

```bash
npm run setup
```

Instala dependencias y navegadores. Después, configura las credenciales sin salir
del terminal:

```bash
npm run configure
```

Pregunta usuario y contraseña (la contraseña no se muestra al teclearla) y genera el
`.env`. Si ya existía uno, guarda una copia en `.env.bak` antes de sobrescribirlo.

La URL no se pregunta: si esta carpeta está dentro del proyecto de la aplicación se
detecta sola. Para fijarla, `npm run configure -- --url=https://otro-entorno.com`.

Modo desatendido, para automatizar:

```bash
npm run configure -- --user=a@b.com --pass=secreto
```

> La descarga de navegadores son ~870 MB y tarda unos minutos. Se guarda una única vez
> por máquina en `~/Library/Caches/ms-playwright/`, no por proyecto.
>
> Si el proceso parece congelarse, mátalo y relánzalo **una sola vez**: dos
> `playwright install` simultáneos se bloquean entre sí por un lockfile y quedan colgados
> sin mostrar ningún error.

Usa `npm ci` y no `npm install`: instala exactamente las versiones del `package-lock.json`.
Cada versión de Playwright exige una revisión concreta de navegador, y mezclarlas provoca
errores de "Executable doesn't exist".

## Configuración

**Si la suite está dentro del repo de la aplicación** (por ejemplo en `/e2e`), la URL se
detecta sola: se lee `APP_URL` del `.env` de Laravel, que ya es tu dominio de Herd. No hay
nada que configurar. Al arrancar, la suite imprime contra qué entorno va a correr y de dónde
sacó esa URL.

El resto se controla desde el `.env` de la suite:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `BASE_URL` | No | Entorno bajo prueba. Precedencia: esta variable › `APP_URL` de la aplicación › staging. |
| `AUTH_USER` | **Sí** | Usuario con el que se autentican las pruebas. |
| `AUTH_PASS` | **Sí** | Contraseña de ese usuario. |

Sin `AUTH_USER` / `AUTH_PASS` la suite se detiene antes de ejecutar ningún test.

Cuando `BASE_URL` apunta a un dominio `.test`, `localhost` o `127.0.0.1`, se ignoran
automáticamente los errores de certificado — necesario porque Herd usa una CA local.

## Ejecución

```bash
npm run e2e                                  # entorno detectado automáticamente
BASE_URL=https://otro-entorno.com npm run e2e   # apuntando a otro entorno
```

Depuración:

```bash
npm run test:ui         # modo interactivo, el más útil para escribir tests
npm run test:headed     # con navegador visible
npm run test:debug      # paso a paso
npm run report          # abre el informe HTML de la última corrida
```

Un solo test o un solo navegador:

```bash
npx playwright test tests/login.spec.js
npx playwright test --project=chromium
```

## Trabajar contra tu entorno local

Es la forma recomendada. Cada dev corre contra **su propia base de datos**, así que nadie
pisa los datos de nadie y staging no se ensucia.

Si la suite vive dentro del repo de la aplicación no hay que hacer nada: la URL sale de
`APP_URL`. Si está en un repo aparte, apunta `BASE_URL` a tu dominio de Herd.

**Tu base de datos local necesita datos.** Las pruebas seleccionan el primer elemento de
varios catálogos: pacientes, clientes, médicos, diagnósticos y exámenes. Contra una base
recién migrada y vacía fallan todas. Ejecuta los seeders del proyecto antes de correrlas.

## Estructura

```
tests/
  *.spec.js        Casos de prueba
  pages/           Page objects (login, indent, order, helpers)
  data/            Selectores, rutas, timeouts, datos y entorno
  utils/           Utilidades de formato y comparación de snapshots
global-setup.js    Login único; guarda la sesión en auth.json
```

## Notas de ejecución

Las pruebas corren con **un solo worker** (`workers: 1`). No es un descuido: todas comparten
la misma cuenta, y en paralelo el backend pisa la sesión. Ver el comentario en
`playwright.config.js` antes de cambiarlo.

Correr contra staging **crea registros reales** (pedidos y órdenes), y los duplica porque
la suite se ejecuta en dos navegadores. Es otra razón para preferir el entorno local.

Si dos personas corren la suite contra staging a la vez, pueden aparecer fallos
espurios: los tests verifican que el registro recién creado encabeza el listado, y otra
corrida simultánea puede adelantarse. El reintento configurado suele absorberlo.
