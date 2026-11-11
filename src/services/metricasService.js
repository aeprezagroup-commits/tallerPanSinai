import { db, isFirebaseConfigured } from '../firebase/config';
import { doc, setDoc, getDoc, increment } from 'firebase/firestore';

const REFERENCIA = 'metricas/uso';
const INTERVALO_VUELCO_MS = 60_000;   
const UMBRAL_VUELCO = 50;             

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

async function volcar() {
  if (!isFirebaseConfigured || !db || !hayAlgo()) return false;
  if (volcando) return false;
  volcando = true;
  const pendiente = { ...buffer };
  try {
    buffer = { lecturas: 0, escrituras: 0, bytesLeidos: 0, bytesEscritos: 0, sesiones: 0 };

    const delta = {};
    for (const [k, v] of Object.entries(pendiente)) {
      if (v > 0) delta[k] = increment(v);
    }
    if (!Object.keys(delta).length) { volcando = false; return false; }

    await setDoc(doc(db, 'metricas', 'uso'), delta, { merge: true });
    return true;
  } catch (e) {
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


export function contarLectura(bytesAprox = 0) {
  acumular('lecturas', 1);
  if (bytesAprox > 0) acumular('bytesLeidos', Math.round(bytesAprox));
}

export function contarEscritura(bytesAprox = 0) {
  acumular('escrituras', 1);
  if (bytesAprox > 0) acumular('bytesEscritos', Math.round(bytesAprox));
}

export function contarSesion() {
  acumular('sesiones', 1);
}

export function aproximarBytes(objeto) {
  try {
    return new Blob([JSON.stringify(objeto || {})]).size;
  } catch {
    return 0;
  }
}

export function volcarAhora() {
  return volcar();
}

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

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (temporizador) { clearTimeout(temporizador); temporizador = null; }
    volcar();
  });
}
