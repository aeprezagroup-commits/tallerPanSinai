import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { contarLectura, contarEscritura, aproximarBytes } from './metricasService';
import { registrarBitacora, TIPOS_BITACORA } from './bitacoraService';

const GASTOS_COLLECTION = 'gastos_vehiculo';
const LOCAL_KEY = 'pan_sinai_gastos_v1';

export const CENTROS_COSTO = [
  'ADMINISTRATIVO',
  'AUDITORIA',
  'CARTONERA',
  'CHALATENANGO',
  'CONSTRUCCION',
  'ESTRUCTURA',
  'MAQUINARIA',
  'PESADO',
  'PUBLICIDAD',
  'SAN MIGUEL',
  'SAN SALVADOR',
  'SAN VICENTE',
  'SANEAMIENTO',
  'SANTA ANA',
  'SANTO DOMINGO',
  'SONSONATE',
  'TALLER AUTOMOTRIZ',
  'TERCEROS POR ACCIDENTES',
  'TALLER'
];

function getLocalGastos() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLocalGastos(lista) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(lista));
  window.dispatchEvent(new Event('pan_sinai_gastos_updated'));
}

export function montoConDescuento(g) {
  const base = Number(g?.monto) || 0;
  const desc = Number(g?.descuento) || 0;
  return Math.max(0, base - desc);
}

export function escucharGastos(callback) {
  if (isFirebaseConfigured && db) {
    const q = query(collection(db, GASTOS_COLLECTION), orderBy('fecha', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const gastos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      contarLectura(aproximarBytes(gastos));
      callback(gastos);
    });
  }
  const handler = () => callback(getLocalGastos());
  window.addEventListener('pan_sinai_gastos_updated', handler);
  setTimeout(() => callback(getLocalGastos()), 0);
  return () => window.removeEventListener('pan_sinai_gastos_updated', handler);
}

export async function guardarGasto(gasto) {
  const limpio = { ...gasto };
  if (isFirebaseConfigured && db) {
    await addDoc(collection(db, GASTOS_COLLECTION), { ...limpio, creadoEn: serverTimestamp() });
    contarEscritura(aproximarBytes(limpio));
    registrarBitacora({
      tipo: TIPOS_BITACORA.GASTO,
      accion: 'crear',
      detalle: `Registró un gasto de ${limpio.proveedor || 'sin proveedor'} por $${Number(limpio.monto) || 0} (${limpio.unidad || 'sin unidad'})`,
      datos: { placa: limpio.unidad, proveedor: limpio.proveedor, monto: Number(limpio.monto) || 0 },
    });
  } else {
    const lista = getLocalGastos();
    lista.push({ id: `g-${Date.now()}`, ...limpio });
    saveLocalGastos(lista);
  }
}

export async function actualizarGasto(id, cambios) {
  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, GASTOS_COLLECTION, id), { ...cambios, actualizadoEn: serverTimestamp() });
    contarEscritura(aproximarBytes(cambios));
    registrarBitacora({
      tipo: TIPOS_BITACORA.GASTO,
      accion: 'editar',
      detalle: `Editó un gasto (${id})`,
      datos: { id, campos: Object.keys(cambios).slice(0, 12) },
    });
  } else {
    const lista = getLocalGastos().map(g => (g.id === id ? { ...g, ...cambios } : g));
    saveLocalGastos(lista);
  }
}

export async function eliminarGasto(id) {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, GASTOS_COLLECTION, id));
    contarEscritura();
    registrarBitacora({
      tipo: TIPOS_BITACORA.GASTO,
      accion: 'eliminar',
      detalle: `Eliminó el gasto ${id}`,
      datos: { id },
    });
  } else {
    saveLocalGastos(getLocalGastos().filter(g => g.id !== id));
  }
}
