
export function formatearDinero(n) {
  const valor = Number(n);
  if (!Number.isFinite(valor)) return '$0.00';
  return `$${valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function aTitulo(texto) {
  return String(texto || '')
    .toLowerCase()
    .replace(/(^|[\s'’./-])([a-záéíóúüñ])/g, (m, separador, letra) => separador + letra.toUpperCase());
}

export function formatearMiles(n) {
  const valor = Number(n);
  if (!Number.isFinite(valor)) return '0';
  return valor.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function formatoKmEntrada(v) {
  if (v === '' || v === null || v === undefined) return '';
  const digitos = String(v).replace(/[^\d]/g, '');
  if (digitos === '') return '';
  return formatearMiles(digitos);
}

export function soloDigitos(v) {
  return String(v ?? '').replace(/[^\d]/g, '');
}

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

export function filtrarTexto(v) {
  return String(v ?? '').replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]/g, '');
}

export function filtrarAlfanumerico(v) {
  return String(v ?? '').replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ\s.'/-]/g, '');
}

export function filtrarCantidad(v) {
  const limpio = String(v ?? '').replace(/[^\d.]/g, '');
  const i = limpio.indexOf('.');
  if (i === -1) return limpio;
  return limpio.slice(0, i + 1) + limpio.slice(i + 1).replace(/\./g, '');
}

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
