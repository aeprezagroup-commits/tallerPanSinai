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

// ---------------------------------------------------------------
// VIN / Número de chasis — norma ISO 3779:
//   • exactamente 17 caracteres
//   • letras (A–Z) y números (0–9), sin caracteres especiales
//   • sin las letras I, O ni Q (se confunden con1,0 y O)
// El campo es opcional: vacío = sin VIN registrado.
// ---------------------------------------------------------------
export function filtrarVIN(v) {
  return String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
}

export function validarVIN(v) {
  const vin = String(v ?? '').trim().toUpperCase();
  if (!vin) return null;
  if (!/^[A-Z0-9]+$/.test(vin)) {
    return 'El VIN sólo puede contener letras y números (sin caracteres especiales).';
  }
  if (vin.length !== 17) {
    return 'El VIN debe tener exactamente 17 caracteres.';
  }
  if (/[IOQ]/.test(vin)) {
    return 'El VIN no puede contener las letras I, O ni Q.';
  }
  return null;
}

// ---------------------------------------------------------------
// Campos de texto (nombres, marcas): sólo letras con tildes/ñ,
// espacios y los signos . ' - (p. ej. "Mercedes-Benz").
// ---------------------------------------------------------------
export function filtrarTexto(v) {
  return String(v ?? '').replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]/g, '');
}

// ---------------------------------------------------------------
// Campos alfanuméricos (modelos, números de motor): letras con
// tildes/ñ, números y los símbolos comunes - . / (p. ej. "Hilux
// D-4D 4x4", "4HK1-903125"). Sin caracteres especiales.
// ---------------------------------------------------------------
export function filtrarAlfanumerico(v) {
  return String(v ?? '').replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ\s.'/-]/g, '');
}

// ---------------------------------------------------------------
// Cantidad numérica (gastos): sólo números con un solo punto
// decimal. Las letras y símbolos nunca llegan al estado.
// ---------------------------------------------------------------
export function filtrarCantidad(v) {
  const limpio = String(v ?? '').replace(/[^\d.]/g, '');
  const i = limpio.indexOf('.');
  if (i === -1) return limpio;
  return limpio.slice(0, i + 1) + limpio.slice(i + 1).replace(/\./g, '');
}

// Teléfono de El Salvador:8 dígitos (o11 con503) → +503 XXXX-XXXX.
// Lo que no sea un número local estándar se muestra como se guardó.
export function formatearTelefono(tel) {
  const crudo = String(tel ?? '').trim();
  if (!crudo) return '';
  const digitos = crudo.replace(/[^\d]/g, '');
  if (digitos.length === 8) {
    return `+503 ${digitos.slice(0, 4)}-${digitos.slice(4)}`;
  }
  if (digitos.length === 11 && digitos.startsWith('503')) {
    return `+503 ${digitos.slice(3, 7)}-${digitos.slice(7)}`;
  }
  return crudo;
}
