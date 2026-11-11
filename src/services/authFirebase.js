// SESIÓN EN FIREBASE AUTHENTICATION — FASE DE MIGRACIÓN
// ---------------------------------------------------------------------------
// La aplicación sigue validando la contraseña contra la colección "usuarios"
// (de donde también salen rol y permisos) y, EN SEGUNDO PLANO, abre la sesión
// en Firebase Authentication con esa misma contraseña.
//
// Por qué así y no de golpe:
//   - Las reglas de Firestore todavía no exigen `request.auth`, así que si
//     Auth falla la aplicación sigue funcionando: nadie se queda fuera.
//   - Las cuentas existentes se crean SOLAS la primera vez que cada persona
//     entra. No hace falta service account ni descargar claves de consola.
//   - Al terminar la migración se endurecen las reglas y Auth pasa a ser la
//     única puerta de entrada.
//
// ADVERTENCIA DE SEGURIDAD: Firebase Auth exige contraseñas de 6 caracteres
// o más. Las cuentas cuya contraseña sea más corta NO se pueden migrar y se
// quedan sin `uid`; hay que subirlas en Administración → Personal antes de
// endurecer las reglas, o esa persona no podrá entrar.
import { auth, db, isFirebaseConfigured } from '../firebase/config';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { registrarUidFirebase } from './usuariosService';

/** Mínimo de caracteres que Firebase Auth acepta para una contraseña. */
export const PASSWORD_MINIMA_AUTH = 6;

// Cola de operaciones: Auth recibe los cambios de sesión uno tras otro para
// que un cierre no pise (ni sea pisado por) el inicio que viene inmediatamente
// después. Sin esto, "cerrar sesión" y "entrar" en el mismo segundo podían
// dejar a la persona sin sesión de Firebase.
let cola = Promise.resolve();
function enCola(tarea) {
  const resultado = cola.then(tarea, tarea);
  cola = resultado.then(() => undefined, () => undefined);
  return resultado;
}

/**
 * Correo con el que la cuenta existe (o se crea) en Firebase Auth.
 * En Personal se pueden dar de alta personas sin correo: se les asigna uno
 * interno y estable a partir de su id, de modo que la cuenta sea siempre
 * reproducible aunque el formulario no pida correo.
 *
 * @param {object} usuario registro de la colección "usuarios"
 * @returns {string} correo en minúsculas
 */
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

/**
 * Guarda el uid de Firebase Auth en el documento de la persona.
 * Es la marca de que esa cuenta ya fue migrada. No genera evento de bitácora:
 * es un dato técnico, no una edición del usuario.
 *
 * @param {string} usuarioId id del documento en "usuarios"
 * @param {string} uid identificador de Firebase Auth
 * @returns {Promise<boolean>} true si se guardó
 */
export async function guardarUidUsuario(usuarioId, uid) {
  if (!db || !usuarioId || !uid) return false;
  try {
    await updateDoc(doc(db, 'usuarios', String(usuarioId)), { uid: String(uid) });
    // Reflejarlo en la caché: si no, la próxima escritura completa del usuario
    // (setDoc sin merge) borraría el uid de Firestore.
    registrarUidFirebase(String(usuarioId), String(uid));
    return true;
  } catch (e) {
    console.warn('[auth] no se pudo guardar el uid:', e?.code || e?.message || e);
    return false;
  }
}

/**
 * Abre la sesión de Firebase Auth para una persona ya validada por la app.
 * NUNCA lanza: en esta fase la sesión local manda y Auth es un refuerzo.
 *
 * @param {object}  usuario  registro validado de "usuarios"
 * @param {string}  password la misma contraseña que acaba de validar la app
 * @returns {Promise<{uid: string|null, email: string, origen: string, error?: string}>}
 *   origen: 'creada' | 'existente' | 'sin-firebase' | 'sin-migrar'
 */
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
    // 1) ¿La cuenta ya existe? → se entra con ella.
    try {
      const cred = await signInWithEmailAndPassword(auth, email, clave);
      return { uid: cred.user.uid, email, origen: 'existente' };
    } catch (e) {
      const codigo = e?.code || '';
      // 'user-not-found' e 'invalid-credential' son las dos formas en que
      // Firebase dice "esta cuenta todavía no existe".
      const noExiste = codigo === 'auth/user-not-found' || codigo === 'auth/invalid-credential';
      if (!noExiste) {
        console.warn('[auth] no se pudo abrir sesión:', codigo || e?.message || e);
        return { uid: null, email, origen: 'sin-migrar', error: codigo || String(e?.message) };
      }
    }

    // 2) Primera vez: se crea la cuenta con la MISMA contraseña que la persona
    //    acaba de escribir, para que no tenga que aprender ninguna nueva.
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, clave);
      return { uid: cred.user.uid, email, origen: 'creada' };
    } catch (e) {
      const codigo = e?.code || '';
      // 'email-already-in-use': la cuenta existe pero su contraseña de Auth ya
      // no coincide con la de "usuarios" (alguien la cambió por un lado).
      console.warn('[auth] no se pudo crear la cuenta:', codigo || e?.message || e);
      return { uid: null, email, origen: 'sin-migrar', error: codigo || String(e?.message) };
    }
  });
}

/** Cierra la sesión de Firebase Auth. NUNCA lanza ni devuelve errores. */
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

/**
 * Cambia la contraseña de Auth para la sesión abierta.
 * Es "best effort": si la cuenta todavía no tiene sesión de Auth abierta (o
 * aún no fue migrada), no hace nada y la contraseña de Auth se sincroniza en
 * el siguiente ingreso.
 *
 * @param {string} nuevaPassword contraseña nueva
 * @returns {Promise<boolean>} true si la credencial de Auth quedó actualizada
 */
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
