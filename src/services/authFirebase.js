import { auth, db, isFirebaseConfigured } from '../firebase/config';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { registrarUidFirebase } from './usuariosService';

export const PASSWORD_MINIMA_AUTH = 6;

let cola = Promise.resolve();
function enCola(tarea) {
  const resultado = cola.then(tarea, tarea);
  cola = resultado.then(() => undefined, () => undefined);
  return resultado;
}

export function emailDeSesion(usuario) {
  const propio = String(usuario?.email || '').trim().toLowerCase();
  if (propio) return propio;

  const base = String(usuario?.id || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'usuario'}@pansinai.com`;
}

export async function guardarUidUsuario(usuarioId, uid) {
  if (!db || !usuarioId || !uid) return false;
  try {
    await updateDoc(doc(db, 'usuarios', String(usuarioId)), { uid: String(uid) });
    registrarUidFirebase(String(usuarioId), String(uid));
    return true;
  } catch (e) {
    console.warn('[auth] no se pudo guardar el uid:', e?.code || e?.message || e);
    return false;
  }
}

export async function abrirSesionFirebase(usuario, password) {
  if (!isFirebaseConfigured || !auth) {
    return { uid: null, email: '', origen: 'sin-firebase' };
  }

  const email = emailDeSesion(usuario);
  const clave = String(password ?? '');

  if (clave.length < PASSWORD_MINIMA_AUTH) {
    console.warn(
      `[auth] ${usuario?.nombre || email}: la contraseña tiene ${clave.length} caracteres ` +
      `y Firebase Auth exige ${PASSWORD_MINIMA_AUTH}. La aplicación sigue abriendo la sesión ` +
      'normalmente; sube la contraseña en Administración → Personal para poder migrarla.'
    );
    return { uid: null, email, origen: 'sin-migrar', error: 'auth/weak-password' };
  }

  return enCola(async () => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, clave);
      return { uid: cred.user.uid, email, origen: 'existente' };
    } catch (e) {
      const codigo = e?.code || '';
      const noExiste = codigo === 'auth/user-not-found' || codigo === 'auth/invalid-credential';
      if (!noExiste) {
        console.warn('[auth] no se pudo abrir sesión:', codigo || e?.message || e);
        return { uid: null, email, origen: 'sin-migrar', error: codigo || String(e?.message) };
      }
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, clave);
      return { uid: cred.user.uid, email, origen: 'creada' };
    } catch (e) {
      const codigo = e?.code || '';
      console.warn('[auth] no se pudo crear la cuenta:', codigo || e?.message || e);
      return { uid: null, email, origen: 'sin-migrar', error: codigo || String(e?.message) };
    }
  });
}

// Sesión anónima: sirve para LEER antes del login (pantalla de login y la
// página pública /vehiculo). No permite escribir: las reglas de Firestore
// exigen una cuenta real para eso.
export function asegurarSesionAnonima() {
  if (!isFirebaseConfigured || !auth) return Promise.resolve(false);
  if (auth.currentUser) return Promise.resolve(true);
  return enCola(async () => {
    if (auth.currentUser) return true;
    try {
      await signInAnonymously(auth);
      return true;
    } catch (e) {
      console.warn(
        '[auth] no se pudo abrir la sesión anónima (revisar Authentication → Método de acceso → Anónimo):',
        e?.code || e?.message || e
      );
      return false;
    }
  });
}

export function cerrarSesionFirebase() {
  if (!isFirebaseConfigured || !auth) return Promise.resolve();
  return enCola(async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('[auth] no se pudo cerrar la sesión:', e?.code || e?.message || e);
    }
  });
}

export function sincronizarPasswordFirebase(nuevaPassword) {
  if (!isFirebaseConfigured || !auth) return Promise.resolve(false);
  const actual = auth.currentUser;
  if (!actual) return Promise.resolve(false);

  return enCola(async () => {
    try {
      await updatePassword(actual, String(nuevaPassword));
      return true;
    } catch (e) {
      console.warn('[auth] no se pudo sincronizar la contraseña:', e?.code || e?.message || e);
      return false;
    }
  });
}
