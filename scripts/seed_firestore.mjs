// ============================================
// Seed de datos de prueba → Firestore
// Siembra la colección `ordenes_trabajo` (órdene demo)
// y el contador correlativo `contadores/ordenes_trabajo`.
//
// Uso:  node scripts/seed_firestore.mjs
// Lee la config de las variables VITE_ del .env (vía process.env tras cargar .env).
// Reproducible: extrae DATOS_DEMO_INICIALES desde el código fuente (no del navegador).
// ============================================
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, collection, getDocs, writeBatch, Timestamp, query, orderBy
} from 'firebase/firestore';

// --- Config (mismos valores que src/firebase/config.js) ---
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCkbvLBhkgt1XYt_UQQH_FRubxNHPOhvd4',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'tallerpansinaisv.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'tallerpansinaisv',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'tallerpansinaisv.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '321610608273',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:321610608273:web:d8d9b28e8a73d21aff9930'
};

const ORDERS_COLLECTION = 'ordenes_trabajo';
const COUNTERS_COLLECTION = 'contadores';

// --- Extracción de un array literal desde un módulo fuente ---
function skipString(src, start) {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (quote === '`' && c === '$' && src[i + 1] === '{') {
      // template ${...}: balancear llaves
      let depth = 1; i += 2;
      while (i < src.length && depth > 0) {
        const d = src[i];
        if (d === '{') depth++;
        else if (d === '}') depth--;
        else if (d === "'" || d === '"' || d === '`') { i = skipString(src, i); continue; }
        i++;
      }
      continue;
    }
    if (c === quote) return i;
    i++;
  }
  return i;
}

function extractArray(src, name) {
  const marker = `const ${name} =`;
  const m = src.indexOf(marker);
  if (m < 0) throw new Error(`No se encontró "${marker}"`);
  const open = src.indexOf('[', m + marker.length);
  if (open < 0) throw new Error(`No se encontró "[" para ${name}`);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') { j = skipString(src, j); continue; }
    if (c === '/' && src[j + 1] === '/') { while (j < src.length && src[j] !== '\n') j++; continue; }
    if (c === '/' && src[j + 1] === '*') { const e = src.indexOf('*/', j); if (e < 0) break; j = e + 1; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
  throw new Error(`Array no balanceado para ${name}`);
}

// Convierte mock { toDate } / ISO / Date → Timestamp de Firestore
function toTs(v) {
  if (v == null) return null;
  if (typeof v.toDate === 'function') return Timestamp.fromDate(v.toDate());
  if (v instanceof Date) return Timestamp.fromDate(v);
  if (typeof v === 'string') { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d); }
  return null;
}

// Construye el documento canónico de orden (misma forma que escribe crearOrden en Firestore)
function buildOrdenDoc(item, numeroOrden) {
  return {
    placa: item.placa || '',
    marca: item.marca || '',
    modelo: item.modelo || '',
    numMotor: item.numMotor || '',
    vin: (item.vin || '').toUpperCase(),
    anio: item.anio || '',
    kilometraje: Number(item.kilometraje) || 0,
    departamento: item.departamento || 'San Salvador',
    ruta: item.ruta || '',
    fechaIngreso: toTs(item.fechaIngreso) || Timestamp.now(),
    conductorEntrega: item.conductorEntrega || '',
    mecanicoReceptor: item.mecanicoReceptor || '',
    diagnosticoInicial: item.diagnosticoInicial || '',
    problemasEncontrados: item.problemasEncontrados || '',
    solucionAplicada: item.solucionAplicada || '',
    costoRepuestos: Number(item.costoRepuestos) || 0,
    costoManoObra: Number(item.costoManoObra) || 0,
    costoTotal: Number(item.costoTotal) || 0,
    tipoTrabajo: item.tipoTrabajo || 'Correctivo',
    tipoAtencion: item.tipoAtencion || 'taller',
    numeroOrden,
    areaPrincipal: item.areaPrincipal || 'General',
    mecanicoAsignado: item.mecanicoAsignado || '',
    tiempoEstimadoHoras: Number(item.tiempoEstimadoHoras) || 0,
    tiempoRealMinutos: Number(item.tiempoRealMinutos) || 0,
    tiempoInicioTrabajo: toTs(item.tiempoInicioTrabajo),
    tiempoFinTrabajo: toTs(item.tiempoFinTrabajo),
    trabajoEnCurso: Boolean(item.trabajoEnCurso),
    estado: item.estado || 'ingresado',
    fechaSalida: toTs(item.fechaSalida),
    personaRetira: item.personaRetira || '',
    observacionesFinales: item.observacionesFinales || '',
    recomendaciones: item.recomendaciones || '',
    actividades: Array.isArray(item.actividades) ? item.actividades : [],
    historialEstados: Array.isArray(item.historialEstados) ? item.historialEstados : [],
    fotosLados: item.fotosLados || { frontal: '', lateralIzquierdo: '', lateralDerecho: '', trasera: '' },
    fotosIngreso: Array.isArray(item.fotosIngreso) ? item.fotosIngreso : [],
    fotosSalida: Array.isArray(item.fotosSalida) ? item.fotosSalida : [],
    creadoPor: item.creadoPor || 'Sistema',
    actualizadoEn: Timestamp.now()
  };
}

async function main() {
  const src = readFileSync(new URL('../src/firebase/ordenesService.js', import.meta.url), 'utf8');
  const arrText = extractArray(src, 'DATOS_DEMO_INICIALES');
  const demo = new Function(`return (${arrText});`)();

  // Asignar numeroOrden cronológico (replica asignarNumerosFaltantes)
  const ordenados = [...demo].sort((a, b) => {
    const ma = a.fechaIngreso?.toDate ? a.fechaIngreso.toDate().getTime() : new Date(a.fechaIngreso || 0).getTime();
    const mb = b.fechaIngreso?.toDate ? b.fechaIngreso.toDate().getTime() : new Date(b.fechaIngreso || 0).getTime();
    return ma - mb;
  });
  ordenados.forEach((o, i) => { o.__num = i + 1; });

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, undefined, { experimentalForceLongPolling: true });

  const batch = writeBatch(db);
  for (const item of demo) {
    const id = item.id;
    if (!id) throw new Error('Orden demo sin id: ' + JSON.stringify(item.placa));
    const data = buildOrdenDoc(item, item.__num);
    batch.set(doc(db, ORDERS_COLLECTION, id), data);
    console.log(`  + ${id}  OT-${String(item.__num).padStart(4, '0')}  ${item.placa}  [${item.estado}]`);
  }

  const maxNum = demo.reduce((m, o) => Math.max(m, o.__num || 0), 0);
  batch.set(doc(db, COUNTERS_COLLECTION, ORDERS_COLLECTION), { valor: maxNum });
  console.log(`  + contador ${COUNTERS_COLLECTION}/${ORDERS_COLLECTION} = ${maxNum}`);

  await batch.commit();
  console.log(`\n✔ ${demo.length} órdenes sembradas en "${ORDERS_COLLECTION}" (contador=${maxNum}).`);

  // Verificación de lectura
  const snap = await getDocs(query(collection(db, ORDERS_COLLECTION), orderBy('fechaIngreso', 'desc')));
  console.log(`✔ Verificación: Firestore resuelve ${snap.size} documentos ordenados por fechaIngreso desc.`);
  snap.docs.forEach(d => {
    const x = d.data();
    console.log(`   - ${d.id}  OT-${String(x.numeroOrden).padStart(4, '0')}  ${x.placa}  [${x.estado}]  ingreso=${x.fechaIngreso?.toDate?.().toISOString?.() || '—'}`);
  });

  process.exit(0);
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
