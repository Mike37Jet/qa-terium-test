// Genera el .env preguntando en el terminal, para no tener que abrir un editor.
// Uso:
//   npm run configure                                  (interactivo)
//   npm run configure -- --user=a@b.com --pass=secreto (desatendido)
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const ENV_PATH = path.resolve(process.cwd(), '.env');

// Misma regla que tests/data/env.js: si la suite está dentro del proyecto de la
// aplicación, la URL sale de su APP_URL y no hay que preguntarla.
function detectAppUrl() {
  const appRoot = path.resolve(process.cwd(), '..');
  if (!fs.existsSync(path.join(appRoot, 'artisan'))) return null;
  const envPath = path.join(appRoot, '.env');
  if (!fs.existsSync(envPath)) return null;
  const m = fs.readFileSync(envPath, 'utf8').match(/^\s*APP_URL\s*=\s*(.+)$/m);
  return m?.[1].trim().replace(/^["']|["']$/g, '') || null;
}

const flags = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, '').split('=');
      return [k, rest.join('=')];
    }),
);

// Lee el .env actual para poder conservar valores al reconfigurar.
function readExisting() {
  if (!fs.existsSync(ENV_PATH)) return {};
  return Object.fromEntries(
    fs.readFileSync(ENV_PATH, 'utf8')
      .split('\n')
      .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
  );
}

// Dos modos de lectura. En terminal real se usa readline (permite ocultar la
// contraseña); con la entrada redirigida se consume stdin de una vez, porque
// readline cierra al llegar al fin de fichero y dejaría colgada la 2ª pregunta.
const INTERACTIVE = Boolean(process.stdin.isTTY);

let rl = null;
let muted = false;
let piped = null;

function terminal() {
  if (rl) return rl;
  rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const write = rl._writeToOutput.bind(rl);
  rl._writeToOutput = (str) => { if (!muted) write(str); };
  return rl;
}

function ask(prompt, { mask = false } = {}) {
  if (!INTERACTIVE) {
    if (piped === null) {
      try { piped = fs.readFileSync(0, 'utf8').split('\n'); } catch { piped = []; }
    }
    const answer = (piped.shift() ?? '').trim();
    process.stdout.write(`${prompt}${mask ? '' : answer}\n`);
    return Promise.resolve(answer);
  }
  return new Promise((resolve) => {
    const io = terminal();
    io.question(prompt, (answer) => {
      if (mask) { muted = false; process.stdout.write('\n'); }
      resolve(answer.trim());
    });
    if (mask) muted = true;   // después de question(), para no ocultar el enunciado
  });
}

// Entre comillas simples, dotenv toma el valor literal: así sobreviven espacios,
// almohadillas y signos de dólar. Si el valor ya lleva una comilla simple se usan
// dobles, escapando lo que dotenv interpretaría.
function quote(value) {
  if (!value.includes("'")) return `'${value}'`;
  return `"${value.replace(/([\\"$`])/g, '\\$1')}"`;
}

const current = readExisting();

// Nota: BASE_URL solo se escribe si se pide explícitamente. Dejarla fuera permite
// que la suite la detecte desde el APP_URL de la aplicación.
const detected = detectAppUrl();
let baseUrl = flags.url ?? current.BASE_URL ?? '';

let user = flags.user ?? '';
let pass = flags.pass ?? '';

const needsPrompt = !user || !pass || (!baseUrl && !detected);

if (needsPrompt) {
  console.log('\n  Configuración de la suite E2E\n');

  if (baseUrl) {
    console.log(`  Entorno fijado: ${baseUrl}`);
  } else if (detected) {
    console.log(`  Entorno detectado desde la aplicación: ${detected}`);
  } else {
    // Sin detección no se puede asumir nada: callar aquí llevaría a correr contra
    // staging sin que el dev se entere.
    console.log('  Esta carpeta no está dentro del proyecto de la aplicación,');
    console.log('  así que hay que indicar contra qué entorno correr.\n');
    baseUrl = await ask('  URL del entorno (p. ej. https://mi-proyecto.test): ');
    if (!baseUrl) {
      console.error('\n  Sin URL no se puede continuar. No se escribió nada.\n');
      process.exit(1);
    }
    console.log('');
  }

  console.log('  Usa credenciales de un usuario que exista en ESE entorno.\n');

  const hint = current.AUTH_USER ? ` [${current.AUTH_USER}]` : '';
  user = user || (await ask(`  Usuario${hint}: `)) || current.AUTH_USER || '';
  pass = pass || (await ask('  Contraseña: ', { mask: true })) || current.AUTH_PASS || '';
}

if (rl) rl.close();

if (!user || !pass) {
  console.error('\n  Faltan usuario o contraseña. No se escribió nada.\n');
  process.exit(1);
}

// Nunca se pisa un .env existente sin dejar copia: las credenciales no se pueden recuperar.
if (fs.existsSync(ENV_PATH)) {
  const backup = `${ENV_PATH}.bak`;
  fs.copyFileSync(ENV_PATH, backup);
  fs.chmodSync(backup, 0o600);
  console.log(`\n  Copia del .env anterior en ${path.basename(backup)}`);
}

const lines = [
  '# Generado por `npm run configure`. Archivo personal: no se sube al repositorio.',
  '',
  '# Descomenta BASE_URL solo para apuntar a un entorno concreto.',
  '# Si esta carpeta está dentro del proyecto de la aplicación, se detecta sola.',
  baseUrl ? `BASE_URL=${baseUrl}` : '# BASE_URL=https://mi-app.test',
  '',
  `AUTH_USER=${quote(user)}`,
  `AUTH_PASS=${quote(pass)}`,
  '',
].join('\n');

fs.writeFileSync(ENV_PATH, lines, { mode: 0o600 });
console.log(`\n  Configuración guardada en .env`);
console.log(`  Usuario: ${user}`);
console.log(baseUrl ? `  Entorno: ${baseUrl}` : '  Entorno: detección automática');
console.log('\n  Ya puedes ejecutar:  npm run e2e\n');
