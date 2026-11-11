// BITÁCORA / AUDITORÍA DEL SISTEMA
// Registra TODO lo que pasa en el taller: sesiones, altas, ediciones,
// eliminaciones y bajas. Es la fuente del panel de super administración.
//
// Colección: "bitacora"
// Orden:     fechaMs descendente
//
// Principios:
//  - NUNCA lanza ni bloquea la interfaz (fire and forget).
//  - Si Firestore no responde, el evento queda en una cola local y se
//    reenvía después (no se pierde nada).
//  - Se poda sola para no llenar la base.
import { db, isFirebaseConfigured } from '../firebase/config';
import {
  collection, addDoc, query, orderBy, limit as limitFs, getDocs,
  getCountFromServer, deleteDoc,
} from 'firebase/firestore';

const COLECCION = 'bitacora';
const MAX_REGISTROS = 4000;        // tope de la bitácora en la base
const COLA_LOCAL = 'pan_sinai_bitacora_cola';
const COLA_MAX = 200;              // eventos que se guardan sin conexión

/** Tipos de evento que reconoce el panel. */
export const TIPOS_BITACORA = {
  SESION: 'sesion',
  USUARIO: 'usuario',
  VEHICULO: 'vehiculo',
  FOTO: 'foto',
  ORDEN: 'orden',
  GASTO: 'gasto',
  SISTEMA: 'sistema',
};

// Quién está actuando (se lee de la sesión guardada)
export function usuarioActual() {
  try {
    const crudo = localStorage.getItem('pan_sinai_auth_user');
    if (!crudo) return { usuario: 'Anónimo', rol: '—' };
    const u = JSON.parse(crudo);
    return {
      usuario: u?.nombre || 'Sin nombre',
      rol: u?.rol || '—',
      id: u?.id || '',
    };
  } catch {
    return { usuario: 'Anónimo', rol: '—' };
  }
}

// Limpieza de datos: Firestore rechaza undefined, NaN y tipos raros
function limpiar(valor, prof = 0) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string') return valor.slice(0, 400);
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (valor instanceof Date) return valor.toISOString();
  if (prof >= 3) return '…';
  if (Array.isArray(valor)) return valor.slice(0, 20).map((v) => limpiar(v, prof + 1));
  if (typeof valor === 'object') {
    const salida = {};
    for (const [k, v] of Object.entries(valor)) {
      if (v === undefined || typeof v === 'function') continue;
      salida[String(k).slice(0, 60)] = limpiar(v, prof + 1);
    }
    return salida;
  }
  return String(valor).slice(0, 400);
}

// Cola de respaldo: si la base no recibe el evento, no se pierde
function leerCola() {
  try {
    const crudo = localStorage.getItem(COLA_LOCAL);
    const arr = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function escribirCola(lista) {
  try {
    localStorage.setItem(COLA_LOCAL, JSON.stringify(lista.slice(-COLA_MAX)));
  } catch {
    // sin espacio: se pierde el evento más viejo, no la app
  }
}

// Escritura
function firebaseListo() {
  return Boolean(isFirebaseConfigured && db);
}

async function enviar(evento) {
  if (!firebaseListo()) return false;
  try {
    await addDoc(collection(db, COLECCION), evento);
    return true;
  } catch (e) {
    console.warn('[bitacora] no se pudo guardar en la base:', e?.message || e);
    return false;
  }
}

/**
 * Registra un evento en la bitácora.
 * Nunca lanza ni devuelve errores: la app no depende de esto.
 *
 * @param {object}  p
 * @param {string}  p.tipo     ver TIPOS_BITACORA
 * @param {string}  p.accion   crear | editar | eliminar | baja | login | logout | ...
 * @param {string}  p.detalle  texto legible para humanos
 * @param {object}  p.datos    datos complementarios (se limpian solos)
 */
export function registrarBitacora({ tipo, accion, detalle, datos, quien } = {}) {
  try {
    // `quien` permite indicar explícitamente quién actúa (el login lo usa,
    // porque en ese instante la sesión todavía no se ha escrito en local).
    const activo = quien || usuarioActual();
    const ahora = Date.now();

    const evento = {
      fechaMs: ahora,
      fecha: new Date(ahora).toISOString(),
      tipo: String(tipo || TIPOS_BITACORA.SISTEMA).slice(0, 30),
      accion: String(accion || 'accion').slice(0, 40),
      detalle: String(detalle || '').slice(0, 500),
      usuario: activo.usuario || 'Anónimo',
      rol: activo.rol || '—',
      datos: limpiar(datos) || {},
      navegador: typeof navigator !== 'undefined' ? String(navigator.userAgent).slice(0, 200) : '',
    };

    // Primero se intenta en la base; si falla, queda en la cola local
    enviar(evento).then((ok) => {
      if (!ok) {
        const cola = leerCola();
        cola.push(evento);
        escribirCola(cola);
      } else {
        // aprovecha para reenviar lo que había quedado pendiente
        vaciarCola();
      }
    });

    return evento;
  } catch (e) {
    console.warn('[bitacora] registro fallido:', e);
    return null;
  }
}

/** Reenvía los eventos que quedaron guardados sin conexión. */
async function vaciarCola() {
  const cola = leerCola();
  if (!cola.length || !firebaseListo()) return 0;
  let enviados = 0;
  const pendientes = [];
  for (const ev of cola) {
    const ok = await enviar(ev);
    if (ok) enviados++;
    else pendientes.push(ev); // si falla otra vez, se queda para después
  }
  escribirCola(pendientes);
  return enviados;
}

// Poda: la bitácora no debe crecer sin límite
let podaHecha = false;

export async function podarBitacora(max = MAX_REGISTROS) {
  if (!firebaseListo() || podaHecha) return { borrados: 0 };
  podaHecha = true;
  try {
    const ref = collection(db, COLECCION);
    const conteo = await getCountFromServer(ref);
    const total = conteo.data().count;
    if (total <= max) return { borrados: 0, total };

    const excedente = total - max;
    const viejas = await getDocs(query(ref, orderBy('fechaMs', 'asc'), limitFs(excedente)));
    let borrados = 0;
    // Se elimina con deleteDoc concurrente en lotes para evitar el endpoint :batchWrite (bloqueado 403)
    const docs = viejas.docs;
    const CHUNK_SIZE = 25;
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const lote = docs.slice(i, i + CHUNK_SIZE);
      await Promise.all(lote.map((d) => deleteDoc(d.ref)));
      borrados += lote.length;
    }
    return { borrados, total };
  } catch (e) {
    console.warn('[bitacora] poda fallida:', e?.message || e);
    return { borrados: 0, error: e?.message };
  }
}

// Lectura (para el panel de super administración)
/**
 * Trae los últimos eventos de la bitácora.
 * El filtrado se hace en el cliente para no depender de índices compuestos.
 */
export async function leerBitacora(cantidad = 500) {
  if (!firebaseListo()) return { eventos: [], origen: 'sin-base' };
  try {
    const ref = collection(db, COLECCION);
    const snap = await getDocs(
      query(ref, orderBy('fechaMs', 'desc'), limitFs(Math.min(cantidad, 1000))),
    );
    const eventos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { eventos, origen: 'base' };
  } catch (e) {
    console.warn('[bitacora] lectura fallida:', e?.message || e);
    return { eventos: [], origen: 'error', error: e?.message };
  }
}

/** Total de eventos que hay en la base (barato: solo devuelve un número). */
export async function contarBitacora() {
  if (!firebaseListo()) return 0;
  try {
    const r = await getCountFromServer(collection(db, COLECCION));
    return r.data().count;
  } catch {
    return 0;
  }
}

/** Eventos pendientes que aún no llegaron a la base. */
export function colaPendiente() {
  return leerCola().length;
}
