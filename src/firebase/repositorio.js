import { db, isFirebaseConfigured } from './config';
import {
  collection, getDocs, doc, setDoc, deleteDoc,
} from 'firebase/firestore';
import { contarLectura, contarEscritura, aproximarBytes } from '../services/metricasService';

export function crearRepositorio({
  coleccion,
  claveLocal,
  semilla = [],
  idDe,
  campoId,
  evento,
  nombre = coleccion,
}) {
  let cache = null;

  let hidratando = false;
  let modificadoMientrasHidrata = false;
  let promesaHidratacion = null;

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
      console.warn(`[${nombre}] no se pudo escribir el espejo local:`, e);
    }
  }

  function avisar() {
    try {
      window.dispatchEvent(new CustomEvent(evento));
    } catch {
    }
  }

  function obtener() {
    if (!cache) {
      const local = leerLocal();
      if (local && local.length > 0) {
        cache = local;
      } else {
        cache = semilla.map((x) => ({ ...x }));
        escribirLocal(cache);
      }
    }
    return cache;
  }

  function reemplazar(lista) {
    cache = Array.isArray(lista) ? lista : [];
    escribirLocal(cache);
    if (hidratando) modificadoMientrasHidrata = true;
    avisar();
  }

  function firebaseListo() {
    return Boolean(isFirebaseConfigured && db);
  }

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

      if (modificadoMientrasHidrata) {
        console.info(`[${nombre}] hidratación: hubo escrituras locales simultáneas, se conservan`);
        return { origen: 'local-modificado', total: cache ? cache.length : local.length };
      }

      if (remotos.length > 0) {
        cache = remotos;
        escribirLocal(cache);
        avisar();
        return { origen: 'firestore', total: cache.length };
      }

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

  function hidratar() {
    promesaHidratacion = ejecutarHidratacion().catch((e) => ({
      origen: 'error',
      total: obtener().length,
      error: e?.message || String(e),
    }));
    return promesaHidratacion;
  }

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
