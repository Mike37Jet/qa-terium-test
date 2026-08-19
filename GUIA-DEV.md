# Ejecutar las pruebas E2E en tu entorno local

Esta suite automatiza los flujos críticos del sistema (login, creación de pedidos,
creación de órdenes y conversión de pedido a orden) sobre Chromium y WebKit.

Corre contra **tu propia base de datos local**, no contra staging. Así nadie pisa los
datos de nadie y no se ensucia el entorno compartido.

Son cinco comandos y no hay que editar ningún archivo.

---

## Antes de empezar

Necesitas dos cosas:

1. **El sistema levantado en Herd**, respondiendo en su dominio `.test`.
2. **La base de datos con datos.** Las pruebas seleccionan el primer elemento de cinco
   catálogos: pacientes, clientes, médicos, diagnósticos y exámenes. Con la base vacía
   fallan todas. Ejecuta los seeders del proyecto si aún no lo has hecho.

También necesitas Node.js 18 o superior.

---

## Los pasos

### 1. Sitúate en la carpeta del proyecto

```bash
cd ~/ruta/a/tu/proyecto
```

**Qué hace:** te coloca en la raíz del sistema, la carpeta donde está el `artisan`.

**Por qué importa:** al ejecutarse, la suite mira el directorio superior y lee el `APP_URL`
de tu `.env` de Laravel para saber contra qué URL correr. Instalándola aquí dentro no
tendrás que configurar ninguna dirección: ya la tienes ahí.

> **No es obligatorio.** Puedes clonarla donde quieras; lo único que cambia es que tendrás
> que indicar la URL a mano, y el paso 4 te la preguntará. Todo lo demás funciona igual.

---

### 2. Clona la suite

```bash
git clone https://github.com/Mike37Jet/qa-terium-test.git e2e
```

**Qué hace:** descarga las pruebas en una subcarpeta `e2e/`.

**Por qué así:** la suite vive en su propio repositorio, mantenido por QA. Clonarla aquí
dentro no modifica el repositorio del sistema — es una carpeta más, sin versionar por él.
El nombre `e2e` es solo una convención; puedes usar otro.

Opcional, para que no te aparezca como archivo sin seguimiento en `git status`:

```bash
echo "e2e/" >> .git/info/exclude
```

Esto la ignora **solo en tu máquina**, sin tocar el `.gitignore` compartido del equipo.

---

### 3. Instala

```bash
cd e2e && npm run setup
```

**Qué hace dos cosas:**

- `npm ci` instala las dependencias exactas del `package-lock.json`.
- `playwright install` descarga los navegadores Chromium y WebKit.

**Cuánto tarda:** los navegadores son ~870 MB, unos minutos con buena conexión. Se guardan
una sola vez por máquina en `~/Library/Caches/ms-playwright/`, compartidos entre proyectos:
no se vuelve a descargar nunca más.

> Si el proceso parece congelarse, córtalo con Ctrl+C y relánzalo **una sola vez**. Dos
> instalaciones simultáneas se bloquean entre sí por un lockfile y quedan colgadas sin
> mostrar ningún error.

---

### 4. Configura tus credenciales

```bash
npm run configure
```

**Qué hace:** pregunta usuario y contraseña en el terminal y genera el archivo `.env`.
La contraseña no se muestra mientras la tecleas.

**Qué credenciales poner:** las de un usuario **que exista en tu base de datos local**.
No sirven las de staging: son bases distintas. Si no sabes cuál usar, míralo en los
seeders del proyecto.

**Qué pasa con la URL:** si la suite está dentro del proyecto, no te la pregunta — se
detecta sola desde tu `APP_URL`. Si está fuera, te la pedirá, porque no hay forma de
adivinarla y correr contra el entorno equivocado sería peor.

Si prefieres una sola línea sin preguntas:

```bash
npm run configure -- --user=tu@usuario.com --pass=tuClave
```

Y si necesitas fijar la URL explícitamente:

```bash
npm run configure -- --url=https://mi-proyecto.test
```

---

### 5. Ejecuta

```bash
npm run e2e
```

**Qué hace:** inicia sesión una vez, guarda esa sesión y ejecuta los 14 tests (7 casos en
dos navegadores).

**Cuánto tarda:** unos 3 minutos. Van de uno en uno a propósito, no en paralelo.

Lo primero que verás es contra qué entorno va a correr:

```
Entorno: https://tu-proyecto.test  (origen: APP_URL del .env de la aplicación)
```

**Comprueba esa línea.** Si no muestra tu dominio local, algo no está bien configurado:
detente y avisa antes de seguir.

---

## Si algo falla

Los mensajes de error dicen qué arreglar. Estos son los tres habituales:

**La aplicación no responde**

```
No se pudo abrir https://tu-proyecto.test/login
  La aplicación no parece estar levantada.
```

Herd no está sirviendo el sitio, o el dominio no coincide con tu `APP_URL`.

**Faltan credenciales**

```
Faltan credenciales: AUTH_USER y AUTH_PASS.
```

No se ejecutó el paso 4, o quedó vacío. Repite `npm run configure`.

**El login no pasa**

```
El login no llegó a la página de bienvenida.
```

Ese usuario no existe en tu base local, o la contraseña no es correcta.

**Fallo al seleccionar paciente, cliente, médico, diagnóstico o examen**

No es un problema de configuración: tu base no tiene datos en ese catálogo. Ejecuta los
seeders.

---

## Después

```bash
npm run report      # informe HTML de la última corrida, con capturas y vídeos de los fallos
npm run test:ui     # modo interactivo, útil para ver qué hace cada test
npm run test:headed # con el navegador visible
```

Un solo archivo o un solo navegador:

```bash
npx playwright test tests/login.spec.js
npx playwright test --project=chromium
```

Para actualizar las pruebas cuando QA suba cambios:

```bash
cd e2e && git pull
```

Solo hará falta repetir `npm run setup` si cambia la versión de Playwright.

---

## Qué reportar

Si algo falla, pasa **el texto literal del error** y la línea de `Entorno:` que aparece al
arrancar. Con eso se identifica enseguida si es entorno, datos o credenciales.

Interesa saber también cuánto tardó la instalación completa en tu máquina.
