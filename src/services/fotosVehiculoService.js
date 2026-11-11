// BASE FOTOGRÁFICA DEL VEHÍCULO (estado ACTUAL)
// Fotos de los 4 costados guardadas POR PLACA (no por orden).
// - Al actualizar una foto, la anterior se elimina de Storage.
// - Un vehículo ACTIVO debe tener sus 4 fotos completas.
// - Al dar de BAJA un vehículo se eliminan todas sus fotos.
import { normalizarPlaca } from '../utils/placas';
import { subirFoto, eliminarFoto, eliminarCarpeta } from '../firebase/storageService';
import { buscarPorPlaca, actualizarOrden } from '../firebase/ordenesService';
import { pesoFotosDe } from '../firebase/fotosConfig';
import { db, isFirebaseConfigured } from '../firebase/config';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { contarLectura, contarEscritura, aproximarBytes } from './metricasService';
import { registrarBitacora, TIPOS_BITACORA } from './bitacoraService';

export const LADOS_VEHICULO = ['frontal', 'lateralIzquierdo', 'lateralDerecho', 'trasera'];

const COLECCION = 'vehiculos_fotos_base';
const LOCAL_KEY = 'pan_sinai_fotos_base_v1';

function registroVacio(placa) {
  return {
    placa: normalizarPlaca(placa),
    frontal: '',
    lateralIzquierdo: '',
    lateralDerecho: '',
    trasera: '',
    actualizadoEn: '',
    actualizadoPor: ''
  };
}

function leerLocal(placa) {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const todo = raw ? JSON.parse(raw) : {};
    return todo[normalizarPlaca(placa)] || registroVacio(placa);
  } catch (e) {
    console.warn('Error leyendo base de fotos local:', e);
    return registroVacio(placa);
  }
}

function guardarLocal(registro) {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const todo = raw ? JSON.parse(raw) : {};
    todo[registro.placa] = registro;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(todo));
  } catch (e) {
    console.error('Error guardando base de fotos local:', e);
  }
}

function borrarLocal(placa) {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return;
    const todo = JSON.parse(raw);
    delete todo[normalizarPlaca(placa)];
    localStorage.setItem(LOCAL_KEY, JSON.stringify(todo));
  } catch (e) {
    console.warn('Error limpiando registro local de fotos:', e);
  }
}

// Obtiene la base fotográfica actual del vehículo (4 costados)
export async function obtenerFotosBase(placa) {
  if (!placa) return registroVacio('');
  const key = normalizarPlaca(placa);
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDoc(doc(db, COLECCION, key));
      const reg = snap.exists() ? { placa: key, ...snap.data() } : registroVacio(key);
      contarLectura(aproximarBytes(reg));
      return reg;
    } catch (e) {
      console.warn('Error leyendo base de fotos en Firebase, usando local:', e);
      return leerLocal(key);
    }
  }
  return leerLocal(key);
}

/**
 * Estado fotográfico de un vehículo (para exigir fotos a los ACTIVOS).
 * @returns {{total:number, completas:number, faltantes:string[], completo:boolean}}
 */
export async function estadoFotosVehiculo(placa) {
  const reg = await obtenerFotosBase(placa);
  const faltantes = LADOS_VEHICULO.filter((lado) => !reg[lado]);
  return {
    total: LADOS_VEHICULO.length,
    completas: LADOS_VEHICULO.length - faltantes.length,
    faltantes,
    completo: faltantes.length === 0,
  };
}

function estadoDesdeRegistro(registro) {
  const faltantes = LADOS_VEHICULO.filter((lado) => !registro[lado]);
  return {
    total: LADOS_VEHICULO.length,
    completas: LADOS_VEHICULO.length - faltantes.length,
    faltantes,
    completo: faltantes.length === 0,
  };
}

/**
 * Mapa { PLACA: estado } con el estado fotográfico de TODA la flota.
 * Se usa en Administración para exigir fotos a los vehículos ACTIVOS.
 */
export async function mapaEstadoFotos() {
  const mapa = {};

  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, COLECCION));
      const crudos = [];
      snap.forEach((d) => {
        const dato = d.data();
        crudos.push(dato);
        mapa[d.id] = estadoDesdeRegistro({ ...dato, placa: d.id });
      });
      contarLectura(aproximarBytes(crudos)); // bytes reales: incluyen las fotos
      return mapa;
    } catch (e) {
      console.warn('Error leyendo estado fotográfico de la flota:', e);
    }
  }

  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const todo = raw ? JSON.parse(raw) : {};
    for (const [placa, reg] of Object.entries(todo)) {
      mapa[placa] = estadoDesdeRegistro(reg || {});
    }
  } catch (e) {
    console.warn('Error leyendo estado fotográfico local:', e);
  }
  return mapa;
}

/**
 * Guarda cambios en la base del vehículo.
 * cambios: { frontal: File | '' | 'url', ... }
 * - File  → se sube a Storage (comprimida) y la foto ANTERIOR se elimina
 * - ''    → limpia la foto del costado y también la borra de Storage
 * - string→ se toma como URL ya existente
 *
 * Si una subida falla, se conserva la foto anterior (nunca se pierde
 * la evidencia ni se guarda base64 dentro de Firestore).
 *
 * @returns {Promise<{registro:object, errores:string[]}>}
 */
export async function guardarFotosBase(placa, cambios = {}, usuario = '') {
  const key = normalizarPlaca(placa);
  if (!key) throw new Error('Se requiere la placa para actualizar la base fotográfica');

  const actual = await obtenerFotosBase(key);
  const nuevo = { ...actual, placa: key };
  const errores = [];

  for (const lado of LADOS_VEHICULO) {
    const val = cambios[lado];
    if (val === undefined || val === null) continue;

    // Limpieza explícita del costado
    if (val === '') {
      if (actual[lado] && actual[lado].startsWith('http')) {
        await eliminarFoto(actual[lado]);
      }
      nuevo[lado] = '';
      continue;
    }

    // URL existente
    if (typeof val === 'string') {
      nuevo[lado] = val;
      continue;
    }

    // Archivo nuevo → subir (nombre fijo por placa/lado) y borrar el anterior
    try {
      const url = await subirFoto(val, key, lado, {
        carpeta: 'vehiculos',
        nombreFijo: true,
        urlAnterior: actual[lado] || '',
      });
      if (url) nuevo[lado] = url;
    } catch (err) {
      console.error(`Error subiendo foto ${lado} de ${key}:`, err);
      errores.push(lado);
      nuevo[lado] = actual[lado] || ''; // se conserva la anterior
    }
  }

  nuevo.actualizadoEn = new Date().toISOString();
  nuevo.actualizadoPor = usuario || '';

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, COLECCION, key), nuevo);
      contarEscritura(aproximarBytes(nuevo));
      const cambiados = LADOS_VEHICULO.filter(
        (lado) => (nuevo[lado] || '') !== (actual[lado] || ''),
      );
      if (cambiados.length) {
        registrarBitacora({
          tipo: TIPOS_BITACORA.FOTO,
          accion: 'actualizar',
          detalle: `Actualizó la base fotográfica de ${key}: ${cambiados.join(', ')}`,
          datos: {
            placa: key,
            costados: cambiados,
            por: usuario || '',
            completas: LADOS_VEHICULO.filter((l) => nuevo[l]).length,
          },
        });
      }
    } catch (e) {
      console.warn('Error guardando base de fotos en Firebase, usando local:', e);
      guardarLocal(nuevo);
    }
  } else {
    guardarLocal(nuevo);
  }

  return { registro: nuevo, errores };
}

/**
 * ELIMINA TODAS LAS FOTOS de un vehículo (se usa al dar de BAJA).
 * Borra:
 *  - Las 4 fotos de estado (Firestore o Storage, según el modo)
 *  - Las fotos guardadas en SUS ÓRDENES (ingreso y salida), que es donde
 *    más espacio se acumula con el tiempo
 *  - El documento en Firestore → vehiculos_fotos_base/{placa}
 *  - El registro local (demo/local)
 *
 * @returns {Promise<{archivosBorrados:number, registroEliminado:boolean,
 *                    ordenesLimpiadas:number, bytesLiberados:number}>}
 */
export async function eliminarFotosVehiculo(placa) {
  const key = normalizarPlaca(placa);
  if (!key) {
    return { archivosBorrados: 0, registroEliminado: false, ordenesLimpiadas: 0, bytesLiberados: 0 };
  }

  let archivosBorrados = 0;
  let ordenesLimpiadas = 0;
  let bytesLiberados = 0;

  if (isFirebaseConfigured) {
    // 1. Fotos de estado en Storage (solo aplica en modo 'storage')
    archivosBorrados += await eliminarCarpeta(`vehiculos/${key}`);
    // 2. Fotos históricas de órdenes en Storage (incluye legados base_*)
    archivosBorrados += await eliminarCarpeta(`ordenes/${key}`);
  }

  // 3. Fotos guardadas DENTRO de los documentos de las órdenes de esa placa.
  //    Es la mayor fuente de crecimiento: cada orden guarda sus propias fotos.
  if (isFirebaseConfigured && db) {
    try {
      const ordenes = await buscarPorPlaca(key);
      for (const orden of ordenes) {
        const tieneFotos =
          Object.values(orden.fotosLados || {}).some(Boolean) ||
          (orden.fotosIngreso?.length || 0) > 0 ||
          (orden.fotosSalida?.length || 0) > 0;
        if (!tieneFotos) continue;

        bytesLiberados += pesoFotosDe(orden);
        await actualizarOrden(orden.id, {
          fotosLados: { frontal: '', lateralIzquierdo: '', lateralDerecho: '', trasera: '' },
          fotosIngreso: [],
          fotosSalida: [],
        });
        ordenesLimpiadas += 1;
      }
    } catch (e) {
      console.warn('No se pudieron limpiar las fotos de las órdenes de', key, e);
    }
  }

  // 4. Documento en Firestore (base de las 4 fotos)
  let registroEliminado = false;
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, COLECCION, key));
      contarEscritura();
      registroEliminado = true;
    } catch (e) {
      console.warn('No se pudo eliminar el documento de fotos:', e);
    }
  }

  // 5. Registro local
  borrarLocal(key);

  registrarBitacora({
    tipo: TIPOS_BITACORA.FOTO,
    accion: 'eliminar',
    detalle: `Eliminó la base fotográfica completa de ${key} (${archivosBorrados} archivo(s))`,
    datos: { placa: key, archivosBorrados, ordenesLimpiadas, bytesLiberados },
  });

  return { archivosBorrados, registroEliminado, ordenesLimpiadas, bytesLiberados };
}
