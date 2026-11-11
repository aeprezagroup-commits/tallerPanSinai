
export const AREAS_TRABAJO = [
  'Motor',
  'Frenos',
  'Suspensión',
  'Dirección',
  'Transmisión',
  'Sistema Eléctrico',
  'Pintura',
  'Carrocería',
  'Aire Acondicionado',
  'General'
];

export const AREAS_TRABAJO_CON_TODAS = ['Todas', ...AREAS_TRABAJO];

export const AREAS_CON_CODIGO = [
  { nombre: 'Motor', codigo: 'MTR' },
  { nombre: 'Frenos', codigo: 'FRN' },
  { nombre: 'Suspensión', codigo: 'SUSP' },
  { nombre: 'Dirección', codigo: 'DIR' },
  { nombre: 'Transmisión', codigo: 'TRNS' },
  { nombre: 'Sistema Eléctrico', codigo: 'ELEC' },
  { nombre: 'Pintura', codigo: 'PINT' },
  { nombre: 'Carrocería', codigo: 'CARRO' },
  { nombre: 'Aire Acondicionado', codigo: 'A/A' },
  { nombre: 'General', codigo: 'GEN' }
];

export const AREAS_SELECT = AREAS_TRABAJO.filter(a => a !== 'General');

export function opcionesArea(valorHeredado) {
  if (valorHeredado && !AREAS_SELECT.includes(valorHeredado)) {
    return [...AREAS_SELECT, valorHeredado];
  }
  return AREAS_SELECT;
}

function reemplazar(destino, nuevos) {
  destino.length = 0;
  destino.push(...nuevos);
}

function codigoAutomatico(nombre) {
  const iniciales = String(nombre)
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
  return iniciales || 'GEN';
}

export function aplicarAreas(areas, codigos) {
  const entrada = (Array.isArray(areas) ? areas : [])
    .map(a => String(a || '').trim())
    .filter(Boolean);
  const lista = entrada.length ? entrada : AREAS_TRABAJO.slice();
  const final = lista.includes('General') ? lista : [...lista, 'General'];

  const codigosPrevios = new Map(AREAS_CON_CODIGO.map(c => [c.nombre, c.codigo]));
  const nuevosCodigos = (codigos && typeof codigos === 'object') ? codigos : {};

  reemplazar(AREAS_TRABAJO, final);
  reemplazar(AREAS_TRABAJO_CON_TODAS, ['Todas', ...final]);
  reemplazar(AREAS_SELECT, final.filter(a => a !== 'General'));
  reemplazar(AREAS_CON_CODIGO, final.map(nombre => ({
    nombre,
    codigo: nuevosCodigos[nombre] || codigosPrevios.get(nombre) || codigoAutomatico(nombre),
  })));
}
