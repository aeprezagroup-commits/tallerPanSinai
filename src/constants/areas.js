// ÁREAS DE TRABAJO DEL TALLER — FUENTE ÚNICA

// Áreas en las que se puede clasificar una orden / actividad.
// 'General' es el valor por defecto cuando no se especifica otra.
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

// Para desplegables de filtro (añade "Todas" al inicio)
export const AREAS_TRABAJO_CON_TODAS = ['Todas', ...AREAS_TRABAJO];

// Versión con código corto (usada por el Dashboard para etiquetas)
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

// Áreas que el mecánico puede elegir como "área principal a trabajar"
// (excluye 'General', que es el valor por defecto)
export const AREAS_SELECT = AREAS_TRABAJO.filter(a => a !== 'General');

// Opciones de un desplegable de área: TODAS las especialidades del taller
// (Pintura, Carrocería y Aire Acondicionado incluidos) sin ofrecer 'General'.
// Si el registro ya está guardado con un valor fuera del catálogo (órdenes
// antiguas con 'General'), se añade al final para que el desplegable lo
// muestre en vez de mostrar un área que no corresponde.
export function opcionesArea(valorHeredado) {
  if (valorHeredado && !AREAS_SELECT.includes(valorHeredado)) {
    return [...AREAS_SELECT, valorHeredado];
  }
  return AREAS_SELECT;
}

// ---------------------------------------------------------------------------
// CATÁLOGO EDITABLE (super admin)
// Aplica los cambios guardados por la consola de soporte. Los listados se
// MUTAN en el sitio para que todos los módulos que ya los importaron
// (desplegables, filtros, reportes y el checklist) vean el catálogo nuevo
// sin necesidad de recargar la aplicación.
// ---------------------------------------------------------------------------
function reemplazar(destino, nuevos) {
  destino.length = 0;
  destino.push(...nuevos);
}

// Código corto para un área nueva: iniciales de cada palabra (máx. 4).
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

/**
 * Sustituye el catálogo de áreas por el guardado en Firestore.
 * 'General' se conserva siempre: es el valor por defecto del sistema.
 *
 * @param {string[]} areas lista de nombres de área
 * @param {Record<string,string>} codigos código corto por área (Dashboard)
 */
export function aplicarAreas(areas, codigos) {
  const entrada = (Array.isArray(areas) ? areas : [])
    .map(a => String(a || '').trim())
    .filter(Boolean);
  const lista = entrada.length ? entrada : AREAS_TRABAJO.slice();
  // 'General' es el valor por defecto del sistema: siempre queda en el catálogo.
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
