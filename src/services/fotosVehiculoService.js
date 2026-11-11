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
      contarLectura(aproximarBytes(crudos)); 
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

export async function guardarFotosBase(placa, cambios = {}, usuario = '') {
  const key = normalizarPlaca(placa);
  if (!key) throw new Error('Se requiere la placa para actualizar la base fotográfica');

  const actual = await obtenerFotosBase(key);
  const nuevo = { ...actual, placa: key };
  const errores = [];

  for (const lado of LADOS_VEHICULO) {
    const val = cambios[lado];
    if (val === undefined || val === null) continue;

    if (val === '') {
      if (actual[lado] && actual[lado].startsWith('http')) {
        await eliminarFoto(actual[lado]);
      }
      nuevo[lado] = '';
      continue;
    }

    if (typeof val === 'string') {
      nuevo[lado] = val;
      continue;
    }

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
      nuevo[lado] = actual[lado] || ''; 
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

export async function eliminarFotosVehiculo(placa) {
  const key = normalizarPlaca(placa);
  if (!key) {
    return { archivosBorrados: 0, registroEliminado: false, ordenesLimpiadas: 0, bytesLiberados: 0 };
  }

  let archivosBorrados = 0;
  let ordenesLimpiadas = 0;
  let bytesLiberados = 0;

  if (isFirebaseConfigured) {
    archivosBorrados += await eliminarCarpeta(`vehiculos/${key}`);
    archivosBorrados += await eliminarCarpeta(`ordenes/${key}`);
  }

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

  borrarLocal(key);

  registrarBitacora({
    tipo: TIPOS_BITACORA.FOTO,
    accion: 'eliminar',
    detalle: `Eliminó la base fotográfica completa de ${key} (${archivosBorrados} archivo(s))`,
    datos: { placa: key, archivosBorrados, ordenesLimpiadas, bytesLiberados },
  });

  return { archivosBorrados, registroEliminado, ordenesLimpiadas, bytesLiberados };
}
