// Formatos estándar del sistema: dinero siempre con signo $ y dos decimales,
// miles siempre separados por coma (convención es-SV / en-US: 1,234.56).

export function formatearDinero(n) {
  const valor = Number(n);
  if (!Number.isFinite(valor)) return '$0.00';
  return `$${valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatearMiles(n) {
  const valor = Number(n);
  if (!Number.isFinite(valor)) return '0';
  return valor.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Valor para mostrar en inputs de kilometraje: conserva vacío y agrupa miles.
export function formatoKmEntrada(v) {
  if (v === '' || v === null || v === undefined) return '';
  const digitos = String(v).replace(/[^\d]/g, '');
  if (digitos === '') return '';
  return formatearMiles(digitos);
}

// Entrada de kilometraje: sólo dígitos (la coma no viaja al estado).
export function soloDigitos(v) {
  return String(v ?? '').replace(/[^\d]/g, '');
}
