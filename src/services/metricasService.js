// MÉTRICAS DE USO REAL DE LA APLICACIÓN
// Cuenta lo que el sistema consume de verdad: lecturas, escrituras y
// bytes aproximados que viajan a la base de datos, más las sesiones.
//
// Colección: "metricas" · documento: "uso"
//
// IMPORTANTE: se vuelca de forma AGRUPADA (coalescida). Si se contara cada
// operación con una escritura, medir el consumo costaría más que el propio
// consumo. Por eso los contadores se acumulan en memoria y se envían como
// máximo una vez por minuto (o al llegar a cierto volumen).
import { db, isFirebaseConfigured } from '../firebase/config';
import { doc, setDoc, getDoc, increment } from 'firebase/firestore';

const REFERENCIA = 'metricas/uso';
const INTERVALO_VUELCO_MS = 60_000;   // 1 minuto
const UMBRAL_VUELCO = 50;             // o antes, si se juntan muchas

/** @type {Record<string, number>} */
let buffer = {
  lecturas: 0,
  escrituras: 0,
  bytesLeidos: 0,
  bytesEscritos: 0,
  sesiones: 0,
};

let temporizador = null;
let volcando = false;

function programarVuelco() {
  if (temporizador || volcando) return;
  temporizador = setTimeout(() => {
    temporizador = null;
    volcar();
  }, INTERVALO_VUELCO_MS);
}

function hayAlgo() {
  return Object.values(buffer).some((v) => v > 0);
}

/** Vuelca el acumulado a la base. Nunca lanza. */
async function volcar() {
  if (!isFirebaseConfigured || !db || !hayAlgo()) return false;
  if (volcando) return false;
  volcando = true;
  // Se copia ANTES del try: en el catch se necesita para devolver el
  // acumulado al buffer y una const declarada dentro del try no es visible
  // allí (ReferenceError en tiempo de ejecución).
  const pendiente = { ...buffer };
  try {
    // Se limpia ANTES de esperar: si algo llega mientras se envía, queda
    // para el siguiente vuelco y no se pierde.
    buffer = { lecturas: 0, escrituras: 0, bytesLeidos: 0, bytesEscritos: 0, sesiones: 0 };

    const delta = {};
    for (const [k, v] of Object.entries(pendiente)) {
      if (v > 0) delta[k] = increment(v);
    }
    if (!Object.keys(delta).length) { volcando = false; return false; }

    await setDoc(doc(db, 'metricas', 'uso'), delta, { merge: true });
    return true;
  } catch (e) {
    // Si falla, se devuelve el acumulado al buffer para no perderlo
    for (const [k, v] of Object.entries(pendiente)) {
      buffer[k] = (buffer[k] || 0) + v;
    }
    console.warn('[metricas] no se pudo volcar:', e?.message || e);
    return false;
  } finally {
    volcando = false;
  }
}

function acumular(campo, n = 1) {
  if (!Number.isFinite(n) || n <= 0) return;
  buffer[campo] = (buffer[campo] || 0) + n;
  const total = Object.values(buffer).reduce((a, b) => a + b, 0);
  if (total >= UMBRAL_VUELCO) {
    if (temporizador) { clearTimeout(temporizador); temporizador = null; }
    volcar();
  } else {
    programarVuelco();
  }
}

// Registro público — llamado desde los servicios

/** Una lectura de la base (un getDocs/getDoc). */
export function contarLectura(bytesAprox = 0) {
  acumular('lecturas', 1);
  if (bytesAprox > 0) acumular('bytesLeidos', Math.round(bytesAprox));
}

/** Una escritura de la base (setDoc/addDoc/deleteDoc/lote). */
export function contarEscritura(bytesAprox = 0) {
  acumular('escrituras', 1);
  if (bytesAprox > 0) acumular('bytesEscritos', Math.round(bytesAprox));
}

/** Alguien inició sesión. */
export function contarSesion() {
  acumular('sesiones', 1);
}

/** Bytes aproximados de un objeto JSON. */
export function aproximarBytes(objeto) {
  try {
    return new Blob([JSON.stringify(objeto || {})]).size;
  } catch {
    return 0;
  }
}

/** Vuelca lo acumulado de inmediato (al salir de la aplicación). */
export function volcarAhora() {
  return volcar();
}

// Lectura (para el panel de super administración)
export async function leerMetricas() {
  const local = { ...buffer, pendienteEnMemoria: true };
  if (!isFirebaseConfigured || !db) {
    return { ...local, origen: 'sin-base' };
  }
  try {
    const snap = await getDoc(doc(db, 'metricas', 'uso'));
    if (!snap.exists()) {
      return { lecturas: 0, escrituras: 0, bytesLeidos: 0, bytesEscritos: 0, sesiones: 0, origen: 'nuevo' };
    }
    const d = snap.data();
    return {
      lecturas: d.lecturas || 0,
      escrituras: d.escrituras || 0,
      bytesLeidos: d.bytesLeidos || 0,
      bytesEscritos: d.bytesEscritos || 0,
      sesiones: d.sesiones || 0,
      actualizadoMs: d.actualizadoMs || 0,
      origen: 'base',
    };
  } catch (e) {
    return { ...local, origen: 'error', error: e?.message };
  }
}

// Vuelco al salir de la página: es el momento en que más se pierde
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (temporizador) { clearTimeout(temporizador); temporizador = null; }
    volcar();
  });
}
