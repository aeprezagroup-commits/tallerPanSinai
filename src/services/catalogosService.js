// CATÁLOGOS DEL SISTEMA — EDITABLES POR EL SUPER ADMIN
// Rutas de camiones, áreas de taller y tareas del checklist.
//
// FUENTE DE VERDAD: Firestore (colección "catalogos", documentos
//   rutas | areas | tareas).
// RESPALDO: los valores que vienen en el código. Si la base todavía no
//   tiene el documento —o no hay red— la aplicación sigue funcionando con
//   esos valores, así que nunca se pierde el catálogo.
//
// La consola de soporte (/admin-secreto/bitacora) es la única interfaz que
// escribe aquí: no hace falta tocar la base a mano.
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { aplicarAreas } from '../constants/areas';
import { aplicarRutas } from './vehiculosService';
import { aplicarTareas } from './catalogoTareasService';
import { registrarBitacora, TIPOS_BITACORA } from './bitacoraService';

const COLECCION = 'catalogos';
const DOC_RUTAS = 'rutas';
const DOC_AREAS = 'areas';
const DOC_TAREAS = 'tareas';

// Estado de la última carga (para que la consola muestre de dónde salió)
let estado = { cargado: false, origen: 'respaldo', actualizadoEn: null, error: null };
const oyentes = new Set();

// Suscripción: la consola se entera cuando los catálogos cambian
export function suscribirCatalogos(callback) {
  oyentes.add(callback);
  return () => oyentes.delete(callback);
}

export function estadoCatalogos() {
  return { ...estado };
}

function avisar() {
  oyentes.forEach((cb) => {
    try { cb(estado); } catch (e) { console.warn('[catalogos] aviso fallido', e); }
  });
}

async function leerDocumento(id) {
  if (!isFirebaseConfigured || !db) return null;
  try {
    const snap = await getDoc(doc(db, COLECCION, id));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn(`[catalogos] no se pudo leer "${id}":`, e?.message || e);
    return null;
  }
}

async function escribirDocumento(id, datos) {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firestore no está configurado en este entorno.');
  }
  await setDoc(doc(db, COLECCION, id), datos, { merge: true });
}

function fechaMasReciente(...docs) {
  const fechas = docs
    .map(d => d?.actualizadoEn)
    .filter(Boolean)
    .map(f => Date.parse(f))
    .filter(n => !Number.isNaN(n));
  return fechas.length ? new Date(Math.max(...fechas)).toISOString() : null;
}

/**
 * Carga los tres catálogos desde Firestore y los aplica en memoria.
 * Se llama al arrancar la aplicación (no bloquea la interfaz) y después de
 * cada guardado. Nunca lanza: sin base, el sistema sigue con el respaldo.
 *
 * @returns {Promise<object>} estado de la carga
 */
export async function cargarCatalogos() {
  const [rutas, areas, tareas] = await Promise.all([
    leerDocumento(DOC_RUTAS),
    leerDocumento(DOC_AREAS),
    leerDocumento(DOC_TAREAS),
  ]);

  try {
    if (rutas) aplicarRutas(rutas.predeterminadas, rutas.porDepartamento);
    if (areas) aplicarAreas(areas.areas, areas.codigos);
    if (tareas) aplicarTareas(tareas);
  } catch (e) {
    console.warn('[catalogos] al aplicar el catálogo:', e?.message || e);
  }

  const alguno = Boolean(rutas || areas || tareas);
  estado = {
    cargado: true,
    origen: alguno ? 'firestore' : 'respaldo',
    actualizadoEn: fechaMasReciente(rutas, areas, tareas),
    error: null,
  };
  avisar();
  return { ...estado };
}

function registrarCambio(accion, detalle, datos) {
  registrarBitacora({
    tipo: TIPOS_BITACORA.SISTEMA,
    accion,
    detalle,
    datos,
  });
}

/**
 * Guarda el catálogo de rutas de camiones.
 * @param {{predeterminadas: string[], porDepartamento: Record<string,string[]>, por?: string}} editor
 */
export async function guardarCatalogoRutas({ predeterminadas, porDepartamento, por = '' } = {}) {
  const datos = {
    predeterminadas: Array.isArray(predeterminadas) ? predeterminadas : [],
    porDepartamento: porDepartamento && typeof porDepartamento === 'object' ? porDepartamento : {},
    actualizadoEn: new Date().toISOString(),
    actualizadoPor: por || 'Soporte',
  };
  await escribirDocumento(DOC_RUTAS, datos);
  aplicarRutas(datos.predeterminadas, datos.porDepartamento);
  registrarCambio('editar', `Actualizó el catálogo de rutas (${datos.predeterminadas.length} ruta(s))`, {
    rutas: datos.predeterminadas.length,
    departamentos: Object.keys(datos.porDepartamento).length,
  });
  estado = { ...estado, origen: 'firestore', actualizadoEn: datos.actualizadoEn };
  avisar();
  return datos;
}

/**
 * Guarda el catálogo de áreas del taller.
 * @param {{areas: string[], codigos: Record<string,string>, por?: string}} editor
 */
export async function guardarCatalogoAreas({ areas, codigos, por = '' } = {}) {
  const datos = {
    areas: Array.isArray(areas) ? areas : [],
    codigos: codigos && typeof codigos === 'object' ? codigos : {},
    actualizadoEn: new Date().toISOString(),
    actualizadoPor: por || 'Soporte',
  };
  await escribirDocumento(DOC_AREAS, datos);
  aplicarAreas(datos.areas, datos.codigos);
  registrarCambio('editar', `Actualizó el catálogo de áreas (${datos.areas.length} área(s))`, {
    areas: datos.areas.length,
  });
  estado = { ...estado, origen: 'firestore', actualizadoEn: datos.actualizadoEn };
  avisar();
  return datos;
}

/**
 * Guarda el catálogo de tareas (checklist).
 * @param {{mantenimiento: object, empresa: object, genericas: object[], por?: string}} editor
 */
export async function guardarCatalogoTareas({ mantenimiento, empresa, genericas, por = '' } = {}) {
  const datos = {
    mantenimiento: mantenimiento && typeof mantenimiento === 'object' ? mantenimiento : {},
    empresa: empresa && typeof empresa === 'object' ? empresa : {},
    genericas: Array.isArray(genericas) ? genericas : [],
    actualizadoEn: new Date().toISOString(),
    actualizadoPor: por || 'Soporte',
  };
  await escribirDocumento(DOC_TAREAS, datos);
  aplicarTareas(datos);
  const total = (Array.isArray(genericas) ? genericas.length : 0)
    + Object.values(datos.empresa).reduce((n, lista) => n + (Array.isArray(lista) ? lista.length : 0), 0);
  registrarCambio('editar', `Actualizó el catálogo de tareas (${total} tarea(s) de reparación)`, {
    areas: Object.keys(datos.empresa).length,
    tareas: total,
  });
  estado = { ...estado, origen: 'firestore', actualizadoEn: datos.actualizadoEn };
  avisar();
  return datos;
}
