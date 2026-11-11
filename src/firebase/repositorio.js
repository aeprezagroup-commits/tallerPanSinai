// REPOSITORIO CON FUENTE DE VERDAD ÚNICA
//
// Firestore     → fuente de verdad (todos los equipos ven lo mismo)
// localStorage  → espejo de respaldo (sigue funcionando sin red y
//                  sobrevive a reinicios del navegador)
// memoria       → caché para las lecturas SÍNCRONAS, de modo que no hay
//                  que reescribir las ~29 llamadas existentes a
//                  obtenerUsuarios() / obtenerFlotaVehiculos()
//
// Flujo:
//   1. Al arrancar, hidratar() trae Firestore → memoria → espejo.
//   2. Si Firestore está vacío, siembra desde el espejo (migración).
//   3. Si Firestore no responde, se queda con el espejo y sigue andando.
//   4. Toda escritura actualiza memoria + espejo al instante y manda a
//      Firestore sin bloquear la interfaz.
import { db, isFirebaseConfigured } from './config';
import {
  collection, getDocs, doc, setDoc, deleteDoc,
} from 'firebase/firestore';
import { contarLectura, contarEscritura, aproximarBytes } from '../services/metricasService';

/**
 * @param {object}   opciones
 * @param {string}   opciones.coleccion  Colección en Firestore
 * @param {string}   opciones.claveLocal Clave del espejo en localStorage
 * @param {Array}    opciones.semilla    Datos iniciales si no hay nada
 * @param {Function} opciones.idDe       (registro) => valor del id (ej. u => u.id)
 * @param {string}   opciones.campoId    Nombre del campo donde va el id
 *                                       (ej. 'id', 'placa')
 * @param {string}   opciones.evento     Evento de ventana al cambiar
 * @param {string}   opciones.nombre     Etiqueta para mensajes de consola
 */
export function crearRepositorio({
  coleccion,
  claveLocal,
  semilla = [],
  idDe,
  campoId,
  evento,
  nombre = coleccion,
}) {
  /** @type {Array|null} */
  let cache = null;

  // Ventana de hidratación: mientras llega Firestore, la caché puede estar
  // mostrando los datos sembrados. Si en ese lapso alguien escribe algo,
  // la llegada de la base NO debe pisar ese cambio.
  let hidratando = false;
  let modificadoMientrasHidrata = false;
  /** @type {Promise|null} */
  let promesaHidratacion = null;

  // Espejo local
  function leerLocal() {
    try {
      const crudo = localStorage.getItem(claveLocal);
      if (!crudo) return null;
      const datos = JSON.parse(crudo);
      return Array.isArray(datos) ? datos : null;
    } catch (e) {
      console.warn(`[${nombre}] espejo local ilegible, se ignora:`, e);
      return null;
    }
  }

  function escribirLocal(lista) {
    try {
      localStorage.setItem(claveLocal, JSON.stringify(lista));
    } catch (e) {
      // Cuota llena o modo privado: la app sigue viva, solo se pierde el espejo
      console.warn(`[${nombre}] no se pudo escribir el espejo local:`, e);
    }
  }

  function avisar() {
    try {
      window.dispatchEvent(new CustomEvent(evento));
    } catch {
      // sin ventana (tests/node) → no hay a quién avisar
    }
  }

  // LECTURA SÍNCRONA — la que ya usan todas las pantallas
  function obtener() {
    if (!cache) {
      const local = leerLocal();
      if (local && local.length > 0) {
        cache = local;
      } else {
        // Primera ejecución en este navegador: se siembra desde los datos
        // iniciales para que SIEMPRE se pueda entrar al sistema.
        cache = semilla.map((x) => ({ ...x }));
        escribirLocal(cache);
      }
    }
    return cache;
  }

  /** Reemplaza la caché, refleja en local y avisa a las pantallas. Síncrono. */
  function reemplazar(lista) {
    cache = Array.isArray(lista) ? lista : [];
    escribirLocal(cache);
    if (hidratando) modificadoMientrasHidrata = true;
    avisar();
  }

  // ESCRITURA EN FIRESTORE
  function firebaseListo() {
    return Boolean(isFirebaseConfigured && db);
  }

  /** Escribe un registro (crea o sobrescribe). Nunca lanza. */
  async function persistirUno(registro) {
    if (!firebaseListo()) return false;
    const id = idDe(registro);
    if (id === undefined || id === null || id === '') {
      console.warn(`[${nombre}] registro sin id, no se pudo guardar`);
      return false;
    }
    try {
      await setDoc(doc(db, coleccion, String(id)), registro);
      contarEscritura(aproximarBytes(registro));
      return true;
    } catch (e) {
      console.warn(`[${nombre}] Firestore rechazó "${id}":`, e?.message || e);
      return false;
    }
  }

  /** Borra un documento. Nunca lanza. */
  async function borrarUno(id) {
    if (!firebaseListo()) return false;
    try {
      await deleteDoc(doc(db, coleccion, String(id)));
      contarEscritura();
      return true;
    } catch (e) {
      console.warn(`[${nombre}] no se pudo borrar "${id}":`, e?.message || e);
      return false;
    }
  }

  /** Escribe una colección completa en lotes controlados con setDoc (evita :batchWrite bloqueado con 403). */
  async function escribirTodos(lista) {
    if (!firebaseListo() || !lista.length) return 0;
    let guardados = 0;
    try {
      const CHUNK_SIZE = 20;
      for (let i = 0; i < lista.length; i += CHUNK_SIZE) {
        const lote = lista.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          lote.map(async (registro) => {
            const id = idDe(registro);
            if (id !== undefined && id !== null && id !== '') {
              await setDoc(doc(db, coleccion, String(id)), registro);
              guardados++;
            }
          })
        );
        contarEscritura(aproximarBytes(lote));
      }
    } catch (e) {
      console.warn(`[${nombre}] falló el lote de escritura:`, e?.message || e);
    }
    return guardados;
  }

  // HIDRATACIÓN — Firestore manda; si está vacío, se siembra
  async function ejecutarHidratacion() {
    const local = obtener();

    if (!firebaseListo()) {
      return { origen: 'local', total: local.length };
    }

    hidratando = true;
    modificadoMientrasHidrata = false;

    try {
      let remotos;
      try {
        const snap = await getDocs(collection(db, coleccion));
        remotos = snap.docs.map((d) => ({ ...d.data(), [campoId]: d.id }));
        contarLectura(aproximarBytes(remotos));
      } catch (e) {
        console.warn(`[${nombre}] Firestore no respondió, se usa el espejo local:`, e?.message || e);
        return { origen: 'local', total: obtener().length, error: e?.message || String(e) };
      }

      // Si mientras llegaba la base alguien guardó algo en este navegador,
      // se respeta lo local: la base se reescribe desde aquí en la próxima
      // operación en lugar de perder lo recién escrito.
      if (modificadoMientrasHidrata) {
        console.info(`[${nombre}] hidratación: hubo escrituras locales simultáneas, se conservan`);
        return { origen: 'local-modificado', total: cache ? cache.length : local.length };
      }

      if (remotos.length > 0) {
        // FIRESTORE ES LA VERDAD: manda sobre lo local
        cache = remotos;
        escribirLocal(cache);
        avisar();
        return { origen: 'firestore', total: cache.length };
      }

      // Firestore vacío → migrar lo que haya en este navegador
      if (local.length > 0) {
        const guardados = await escribirTodos(local);
        if (guardados > 0) {
          return { origen: 'migrado', total: guardados };
        }
      }
      return { origen: 'vacio', total: 0 };
    } finally {
      hidratando = false;
    }
  }

  /**
   * Lanza la hidratación y guarda la promesa para que quien necesite los
   * datos REALES (el login) pueda esperar a que termine.
   * Nunca rechaza.
   */
  function hidratar() {
    promesaHidratacion = ejecutarHidratacion().catch((e) => ({
      origen: 'error',
      total: obtener().length,
      error: e?.message || String(e),
    }));
    return promesaHidratacion;
  }

  /** Resuelve cuando la última hidratación terminó (o ya no hay ninguna). */
  function esperarHidratacion() {
    return promesaHidratacion
      ? promesaHidratacion.catch(() => null)
      : Promise.resolve(null);
  }

  return {
    obtener,
    reemplazar,
    hidratar,
    esperarHidratacion,
    persistirUno,
    borrarUno,
    escribirTodos,
    claveLocal,
    coleccion,
    campoId,
  };
}
