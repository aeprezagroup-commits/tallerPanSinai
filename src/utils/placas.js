export function normalizarPlaca(valor) {
  return String(valor ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
