import { db, isFirebaseConfigured } from '../firebase/config';
import {
  collection, addDoc, query, orderBy, limit as limitFs, getDocs,
  getCountFromServer, deleteDoc,
} from 'firebase/firestore';

const COLECCION = 'bitacora';
const MAX_REGISTROS = 4000;        
const COLA_LOCAL = 'pan_sinai_bitacora_cola';
const COLA_MAX = 200;              

export const TIPOS_BITACORA = {
  SESION: 'sesion',
  USUARIO: 'usuario',
  VEHICULO: 'vehiculo',
  FOTO: 'foto',
  ORDEN: 'orden',
  GASTO: 'gasto',
  SISTEMA: 'sistema',
};

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
  }
}

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

export function registrarBitacora({ tipo, accion, detalle, datos, quien } = {}) {
  try {
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

    enviar(evento).then((ok) => {
      if (!ok) {
        const cola = leerCola();
        cola.push(evento);
        escribirCola(cola);
      } else {
        vaciarCola();
      }
    });

    return evento;
  } catch (e) {
    console.warn('[bitacora] registro fallido:', e);
    return null;
  }
}

async function vaciarCola() {
  const cola = leerCola();
  if (!cola.length || !firebaseListo()) return 0;
  let enviados = 0;
  const pendientes = [];
  for (const ev of cola) {
    const ok = await enviar(ev);
    if (ok) enviados++;
    else pendientes.push(ev); 
  }
  escribirCola(pendientes);
  return enviados;
}

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

export async function contarBitacora() {
  if (!firebaseListo()) return 0;
  try {
    const r = await getCountFromServer(collection(db, COLECCION));
    return r.data().count;
  } catch {
    return 0;
  }
}

export function colaPendiente() {
  return leerCola().length;
}
