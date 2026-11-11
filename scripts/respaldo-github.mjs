// ============================================
// RESPALDO DE FOTOS → GITHUB
// Refleja las fotos que viven en Firestore dentro de un
// repositorio de Git (fotos/...), decodificándolas a archivos
// reales (.webp/.jpg/.png) y borrando lo que ya no existe.
//
// Así el repo queda sincronizado: si un vehículo se da de baja y
// sus fotos se eliminan, también desaparecen aquí.
//
// ORIGEN 'firestore' (por defecto):
//   Lee Firestore por REST. Con FIREBASE_AUTH_EMAIL y
//   FIREBASE_AUTH_PASSWORD (cuenta de respaldo) inicia sesión y
//   manda el token: así funciona con las reglas de la Fase 2,
//   donde leer exige sesión abierta. Sin esas variables usa sólo
//   la API key, que sirve mientras las reglas estén abiertas.
//
// ORIGEN 'storage':
//   Refleja el bucket de Firebase Storage (para cuando el proyecto
//   tenga el plan Blaze). Requiere FIREBASE_STORAGE_SA_JSON.
//
// Uso local:  node scripts/respaldo-github.mjs
// Uso en CI:  corre desde .github/workflows/respaldo-fotos.yml
// ============================================
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const PROYECTO = process.env.FIREBASE_PROJECT_ID || 'tallerpansinaisv';
const API_KEY =
  process.env.FIREBASE_API_KEY || 'AIzaSyCkbvLBhkgt1XYt_UQQH_FRubxNHPOhvd4';
const ORIGEN = (process.env.RESPALDO_ORIGEN || 'firestore').toLowerCase();

const DESTINO = path.resolve(process.cwd(), 'fotos');
const MANIFIESTO_JSON = path.resolve(process.cwd(), '.respaldo-manifiesto.json');
const MANIFIESTO_CSV = path.resolve(process.cwd(), 'MANIFIESTO.csv');

const LADOS = ['frontal', 'lateralIzquierdo', 'lateralDerecho', 'trasera'];
const COLECCION_BASE = 'vehiculos_fotos_base';
const COLECCION_ORDENES = 'ordenes_trabajo';

// ---------------------------------------------
// 1. Firestore REST (con sesión de respaldo)
// ---------------------------------------------
// Las reglas de la Fase 2 exigen sesión abierta para leer. La cuenta
// de respaldo llega desde FIREBASE_AUTH_EMAIL / FIREBASE_AUTH_PASSWORD
// (secretos del repositorio en CI) y su token se pide una sola vez.
let tokenRespaldo = null;
async function obtenerTokenRespaldo() {
  if (tokenRespaldo) return tokenRespaldo;
  const email = process.env.FIREBASE_AUTH_EMAIL;
  const password = process.env.FIREBASE_AUTH_PASSWORD;
  if (!email || !password) return null;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    throw new Error(
      `Firebase Auth respondió ${res.status} al abrir la sesión de respaldo: ${await res.text()}`
    );
  }
  const cuerpo = await res.json();
  tokenRespaldo = cuerpo.idToken;
  return tokenRespaldo;
}

function decodificarValor(v) {
  if (v === null || v === undefined) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('referenceValue' in v) return v.referenceValue;
  if ('bytesValue' in v) return Buffer.from(v.bytesValue, 'base64');
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodificarValor);
  if ('mapValue' in v) return decodificarCampos(v.mapValue.fields || {});
  return null;
}

function decodificarCampos(fields) {
  const salida = {};
  for (const [clave, valor] of Object.entries(fields || {})) {
    salida[clave] = decodificarValor(valor);
  }
  return salida;
}

async function listarDocumentos(coleccion) {
  const base =
    `https://firestore.googleapis.com/v1/projects/${PROYECTO}` +
    `/databases/(default)/documents/${coleccion}`;
  const documentos = [];
  let pageToken = '';

  do {
    const url = `${base}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}&key=${API_KEY}`;
    const token = await obtenerTokenRespaldo();
    const res = await fetch(
      url,
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    );
    if (!res.ok) {
      throw new Error(`Firestore respondió ${res.status} al leer "${coleccion}": ${await res.text()}`);
    }
    const cuerpo = await res.json();
    for (const doc of cuerpo.documents || []) {
      documentos.push({
        id: doc.name.split('/').pop(),
        campos: decodificarCampos(doc.fields),
      });
    }
    pageToken = cuerpo.nextPageToken || '';
  } while (pageToken);

  return documentos;
}

/** Convierte un valor de foto (DataURL o URL) en un archivo o en un pendiente. */
function aArchivo(valor) {
  if (typeof valor !== 'string' || !valor) return null;

  if (valor.startsWith('data:')) {
    const corte = valor.indexOf(',');
    const cabecera = valor.slice(5, corte); // image/webp;base64
    const mime = cabecera.split(';')[0] || 'image/webp';
    const ext =
      mime === 'image/jpeg' ? 'jpg' :
      mime === 'image/png' ? 'png' :
      mime === 'image/gif' ? 'gif' :
      mime.split('/')[1] || 'webp';
    try {
      return { ext, datos: Buffer.from(valor.slice(corte + 1), 'base64') };
    } catch {
      return null;
    }
  }

  if (valor.startsWith('http')) {
    return { url: valor }; // URL legada de Storage: se registra pero no se descarga
  }
  return null;
}

async function recolectarFirestore() {
  const archivos = new Map(); // rutaRelativa -> Buffer
  const pendientes = [];      // URLs que no se pudieron descargar
  const stats = { vehiculos: 0, ordenes: 0, fotos: 0, bytes: 0 };

  const agregar = (rutaRel, archivo) => {
    if (!archivo || !archivo.datos) return;
    archivos.set(rutaRel, archivo.datos);
    stats.fotos += 1;
    stats.bytes += archivo.datos.length;
  };

  // --- Base fotográfica (4 costados por placa) ---
  const vehiculos = await listarDocumentos(COLECCION_BASE);
  stats.vehiculos = vehiculos.length;
  for (const { id, campos } of vehiculos) {
    for (const lado of LADOS) {
      const archivo = aArchivo(campos[lado]);
      if (!archivo) continue;
      if (archivo.url) { pendientes.push(`${id}/${lado}: ${archivo.url}`); continue; }
      agregar(`vehiculos/${id}/${lado}.${archivo.ext}`, archivo);
    }
  }

  // --- Fotos dentro de cada orden ---
  const ordenes = await listarDocumentos(COLECCION_ORDENES);
  stats.ordenes = ordenes.length;
  for (const { id, campos } of ordenes) {
    const base = campos.fotosLados || {};
    for (const lado of LADOS) {
      const archivo = aArchivo(base[lado]);
      if (!archivo) continue;
      if (archivo.url) { pendientes.push(`${id}/base-${lado}: ${archivo.url}`); continue; }
      agregar(`ordenes/${id}/ingreso-${lado}.${archivo.ext}`, archivo);
    }
    for (const campo of ['fotosIngreso', 'fotosSalida']) {
      const lista = Array.isArray(campos[campo]) ? campos[campo] : [];
      lista.forEach((valor, i) => {
        const archivo = aArchivo(valor);
        if (!archivo) return;
        if (archivo.url) { pendientes.push(`${id}/${campo}[${i}]: ${archivo.url}`); return; }
        const prefijo = campo === 'fotosIngreso' ? 'ingreso' : 'salida';
        agregar(`ordenes/${id}/${prefijo}-${String(i + 1).padStart(2, '0')}.${archivo.ext}`, archivo);
      });
    }
  }

  return { archivos, pendientes, stats };
}

// ---------------------------------------------
// 2. Firebase Storage (para cuando haya Blaze)
// ---------------------------------------------
async function recolectarStorage() {
  let Storage;
  try {
    ({ Storage } = await import('@google-cloud/storage'));
  } catch {
    console.error('❌ Falta @google-cloud/storage. Ejecuta: npm i -D @google-cloud/storage');
    process.exit(1);
  }

  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET || `${PROYECTO}.firebasestorage.app`;
  const opciones = { projectId: PROYECTO };
  const json = process.env.FIREBASE_STORAGE_SA_JSON;
  if (json) {
    const tmp = path.join(process.cwd(), `.sa-${Date.now()}.json`);
    await fs.writeFile(tmp, json.trim(), 'utf8');
    opciones.keyFile = tmp;
    process.on('exit', () => fs.rm(tmp, { force: true }).catch(() => {}));
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    opciones.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  } else {
    console.error('❌ Falta FIREBASE_STORAGE_SA_JSON para leer Storage.');
    process.exit(1);
  }

  const bucket = new Storage(opciones).bucket(bucketName);
  const [archivosBucket] = await bucket.getFiles({ autoPagute: true, autoPaginate: true });
  const archivos = new Map();
  let bytes = 0;

  for (const archivo of archivosBucket) {
    const peso = Number(archivo.metadata.size || 0);
    if (peso > 100 * 1024 * 1024) continue; // límite de GitHub
    try {
      const [datos] = await archivo.download();
      archivos.set(archivo.name, datos);
      bytes += datos.length;
    } catch (err) {
      console.error(`   ⚠️ No se pudo descargar ${archivo.name}: ${err.message}`);
    }
  }

  return {
    archivos,
    pendientes: [],
    stats: { vehiculos: 0, ordenes: 0, fotos: archivos.size, bytes },
  };
}

// ---------------------------------------------
// 3. Espejo en disco + manifiesto
// ---------------------------------------------
async function escribirEspejo(archivos, stats, pendientes) {
  await fs.rm(DESTINO, { recursive: true, force: true });
  await fs.mkdir(DESTINO, { recursive: true });

  const filas = ['ruta;campo;bytes;sha256'];

  for (const [rutaRel, datos] of archivos) {
    const destino = path.join(DESTINO, rutaRel);
    await fs.mkdir(path.dirname(destino), { recursive: true });
    await fs.writeFile(destino, datos);
    const hash = crypto.createHash('sha256').update(datos).digest('hex').slice(0, 16);
    filas.push(`"fotos/${rutaRel}";${datos.length};${hash}`);
  }

  await fs.writeFile(MANIFIESTO_CSV, filas.join('\n'), 'utf8');
  await fs.writeFile(
    MANIFIESTO_JSON,
    JSON.stringify({ origen: ORIGEN, generadoEn: new Date().toISOString(), ...stats }, null, 2),
    'utf8'
  );

  return { total: archivos.size };
}

// ---------------------------------------------
// Main
// ---------------------------------------------
console.log(`\n🔎 Respaldo desde ${ORIGEN} (proyecto ${PROYECTO})...\n`);

const { archivos, pendientes, stats } =
  ORIGEN === 'storage' ? await recolectarStorage() : await recolectarFirestore();

const { total } = await escribirEspejo(archivos, stats, pendientes);

const MB = (n) => `${(n / 1048576).toFixed(2)} MB`;
console.log('──────────────────────────────────────────────');
console.log('📦 Respaldo listo para commit');
console.log(`   Origen:            ${ORIGEN}`);
console.log(`   Vehículos:         ${stats.vehiculos}`);
console.log(`   Órdenes:           ${stats.ordenes}`);
console.log(`   Archivos de foto:  ${total}`);
console.log(`   Peso total:        ${MB(stats.bytes)}`);
if (pendientes.length) {
  console.log(`   ⚠️ URLs legadas sin descargar: ${pendientes.length}`);
  pendientes.slice(0, 10).forEach((p) => console.log(`      - ${p}`));
}
console.log('──────────────────────────────────────────────\n');

if (total === 0) {
  console.log('⚠️ No hay fotos que respaldar (¿Firestore está vacío?).');
}
