// POLÍTICA DE CONTRASEÑAS DEL SISTEMA
// ---------------------------------------------------------------------------
// Una sola fuente de verdad para la app: la usan el alta/edición de personal,
// el reinicio que hace el administrador y el cambio obligatorio del ingreso.
//
// Reglas (definidas con la administración del taller):
//   - 8 caracteres como mínimo.
//   - Al menos una letra MAYÚSCULA.
//   - Al menos un carácter especial (! @ # $ % * ? . _ -).
//
// Firebase Auth exige además 6 caracteres como mínimo; con 8 se cumple de
// sobra y las cuentas quedan listas para la migración.
export const PASSWORD_MINIMA = 8;
export const PASSWORD_MAXIMA = 64;

const MAYUSCULA = /[A-ZÁÉÍÓÚÑÜ]/;
const ESPECIAL = /[^A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü]/;
const SIN_ESPACIOS = /^\S+$/;

/**
 * Valida una contraseña contra la política del sistema.
 *
 * @param {string} password contraseña escrita por la persona
 * @param {{obligatoria?: boolean}} opciones si es `false`, el vacío es válido
 *        (se usa al editar un usuario sin cambiarle la contraseña)
 * @returns {string|null} mensaje de error, o `null` si cumple
 */
export function validarPassword(password, { obligatoria = true } = {}) {
  const valor = String(password ?? '');

  if (!valor) {
    return obligatoria ? 'La contraseña es obligatoria.' : null;
  }
  if (valor.length < PASSWORD_MINIMA) {
    return `La contraseña debe tener al menos ${PASSWORD_MINIMA} caracteres.`;
  }
  if (valor.length > PASSWORD_MAXIMA) {
    return `La contraseña no puede superar los ${PASSWORD_MAXIMA} caracteres.`;
  }
  if (!SIN_ESPACIOS.test(valor)) {
    return 'La contraseña no puede contener espacios.';
  }
  if (!MAYUSCULA.test(valor)) {
    return 'La contraseña debe incluir al menos una letra mayúscula.';
  }
  if (!ESPECIAL.test(valor)) {
    return 'La contraseña debe incluir al menos un carácter especial (por ejemplo: ! # $ % *).';
  }
  return null;
}

/**
 * Indica si una contraseña ya cumple la política (sin lanzar mensajes).
 * @param {string} password
 * @returns {boolean}
 */
export function passwordCumplePolitica(password) {
  return validarPassword(password) === null;
}

/**
 * Genera una contraseña temporal para el reinicio que hace el administrador.
 * Evita caracteres ambiguos (0/O, 1/l/I) porque se dicta o se copia a mano.
 *
 * @returns {string} contraseña de 10 caracteres que cumple la política
 */
export function generarPasswordTemporal() {
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minusculas = 'abcdefghijkmnopqrstuvwxyz';
  const numeros = '23456789';
  const especiales = '!@#$%*?';

  const azar = (texto) => texto[Math.floor(Math.random() * texto.length)];

  // Se garantiza una de cada grupo y se rellena el resto al azar.
  const obligatorios = [azar(mayusculas), azar(minusculas), azar(numeros), azar(especiales)];
  const resto = Array.from({ length: 6 }, () =>
    azar(mayusculas + minusculas + numeros + especiales)
  );

  const todo = [...obligatorios, ...resto];
  for (let i = todo.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [todo[i], todo[j]] = [todo[j], todo[i]];
  }
  return todo.join('');
}
