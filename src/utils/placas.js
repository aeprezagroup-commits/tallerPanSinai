// Normalización única de placas salvadoreñas.
// Formato oficial: letra de clase + 6 caracteres, sin guiones (P123456, C812034).
// Tolera el guión y espacios por compatibilidad con datos y hábitos previos.
export function normalizarPlaca(valor) {
  return String(valor ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
