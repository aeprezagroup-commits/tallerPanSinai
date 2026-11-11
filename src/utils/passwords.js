import bcrypt from 'bcryptjs';

export const PASSWORD_MINIMA = 8;
export const PASSWORD_MAXIMA = 64;

const PASSWORD_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const COSTE_BCRYPT = 10;

export function esHashBcrypt(valor) {
  return typeof valor === 'string' && PASSWORD_HASH_REGEX.test(valor);
}

export function hashPassword(password) {
  return bcrypt.hashSync(String(password ?? ''), COSTE_BCRYPT);
}

export function verificarPasswordAlmacenada(password, almacenada) {
  if (esHashBcrypt(almacenada)) {
    return bcrypt.compareSync(String(password ?? ''), almacenada);
  }
  return almacenada === String(password ?? '');
}

const MAYUSCULA = /[A-ZÁÉÍÓÚÑÜ]/;
const ESPECIAL = /[^A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü]/;
const SIN_ESPACIOS = /^\S+$/;

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

export function passwordCumplePolitica(password) {
  return validarPassword(password) === null;
}

export function generarPasswordTemporal() {
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minusculas = 'abcdefghijkmnopqrstuvwxyz';
  const numeros = '23456789';
  const especiales = '!@#$%*?';

  const azar = (texto) => texto[Math.floor(Math.random() * texto.length)];

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
