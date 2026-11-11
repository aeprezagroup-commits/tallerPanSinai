
import { AREAS_SELECT } from '../constants/areas';

export const GRUPOS_MANTENIMIENTO = [
  { id: 'mantenimiento_5000', nombre: 'Servicio 5,000 km', km: 5000, resumen: 'Preventivo menor: fluidos, filtros y revisión de rutina.' },
  { id: 'mantenimiento_20000', nombre: 'Servicio 20,000 km', km: 20000, resumen: 'Preventivo mayor: incluye el de 5,000 km y servicios extendidos.' }
];

export const MOTIVOS_INGRESO = [
  { id: 'mantenimiento', label: 'Mantenimiento programado', modo: 'mantenimiento' },
  { id: 'falla', label: 'Fallas o daños', modo: 'reparacion' }
];

const TAREAS_5000 = [
  { clave: 'mtto5k-aceite', descripcion: 'Cambiar aceite de motor y filtro de aceite', area: 'Motor', tiempoEstimadoMinutos: 40 },
  { clave: 'mtto5k-filtro-aire', descripcion: 'Revisar y limpiar filtro de aire', area: 'Motor', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto5k-niveles', descripcion: 'Verificar niveles (aceite, refrigerante, frenos, dirección, limpiaparabrisas)', area: 'General', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto5k-neumaticos', descripcion: 'Revisar presión y estado de neumáticos', area: 'Suspensión', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto5k-rotacion', descripcion: 'Rotación de neumáticos', area: 'Suspensión', tiempoEstimadoMinutos: 30 },
  { clave: 'mtto5k-frenos', descripcion: 'Revisar frenos (pastillas, discos y nivel de líquido)', area: 'Frenos', tiempoEstimadoMinutos: 30 },
  { clave: 'mtto5k-luces', descripcion: 'Revisar funcionamiento de luces e impermeables', area: 'Sistema Eléctrico', tiempoEstimadoMinutos: 15 },
  { clave: 'mtto5k-correas', descripcion: 'Revisar estado de correas y mangueras', area: 'Motor', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto5k-bateria', descripcion: 'Revisar batería, bornes y carga del alternador', area: 'Sistema Eléctrico', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto5k-lubricacion', descripcion: 'Lubricar bisagras, cerraduras y puntos de lubricación', area: 'General', tiempoEstimadoMinutos: 15 },
  { clave: 'mtto5k-prueba', descripcion: 'Prueba de ruta y verificación final', area: 'General', tiempoEstimadoMinutos: 20 }
];

const TAREAS_EXTENDIDAS_20000 = [
  { clave: 'mtto20k-filtro-combustible', descripcion: 'Cambiar filtro de combustible', area: 'Motor', tiempoEstimadoMinutos: 40 },
  { clave: 'mtto20k-filtro-habitaculo', descripcion: 'Cambiar filtro de habitáculo (cabina)', area: 'General', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto20k-liquido-frenos', descripcion: 'Cambiar líquido de frenos y purgar el sistema', area: 'Frenos', tiempoEstimadoMinutos: 45 },
  { clave: 'mtto20k-direccion', descripcion: 'Revisar y ajustar sistema de dirección', area: 'Dirección', tiempoEstimadoMinutos: 40 },
  { clave: 'mtto20k-amortiguadores', descripcion: 'Revisar amortiguadores y elementos de suspensión', area: 'Suspensión', tiempoEstimadoMinutos: 40 },
  { clave: 'mtto20k-correa-distribucion', descripcion: 'Revisar/cambiar correa de distribución (según aplique)', area: 'Motor', tiempoEstimadoMinutos: 90 },
  { clave: 'mtto20k-transmision', descripcion: 'Servicio de transmisión (cambio de aceite de caja)', area: 'Transmisión', tiempoEstimadoMinutos: 60 },
  { clave: 'mtto20k-enfriamiento', descripcion: 'Revisar sistema de enfriamiento (termostato, mangueras, radiador)', area: 'Motor', tiempoEstimadoMinutos: 45 },
  { clave: 'mtto20k-aire-acondicionado', descripcion: 'Revisar sistema de aire acondicionado', area: 'Aire Acondicionado', tiempoEstimadoMinutos: 30 },
  { clave: 'mtto20k-escaner', descripcion: 'Diagnóstico por escáner / revisión electrónica', area: 'Sistema Eléctrico', tiempoEstimadoMinutos: 30 },
  { clave: 'mtto20k-valvulas', descripcion: 'Ajuste de válvulas (según aplique)', area: 'Motor', tiempoEstimadoMinutos: 60 },
];

const TAREAS_20000 = [...TAREAS_EXTENDIDAS_20000, ...TAREAS_5000];

const TAREAS_POR_AREA_EMPRESA = {
  Motor: [
    'Aceite',
    'Balero Tensor',
    'Bomba diésel',
    'Cigüeñal',
    'Culata',
    'Faja de Alternador',
    'Faja de Power Steering',
    'Filtro aceite',
    'Filtro aire',
    'Filtro de combustible',
    'Manguera de Admisión',
    'Manguera inferior de radiador',
    'Manguera superior de radiador',
    'Pistones',
    'Radiador',
    'Tanque de combustible',
    'Tapón de Radiador',
    'Resorte de Acelerador',
    'Cable de acelerador',
    'Ajuste de motor',
    'Cambio de Inyectores',
    'Manguera de retorno de aceite',
    'Aspa de Ventilador',
    'Faja de tiempo',
    'agua refrigerante',
    'Soldar Escape'
  ],
  Frenos: [
    'balero de bufa',
    'Bomba auxiliar',
    'Bomba Central',
    'Cables de freno de mano',
    'Caliper derecho',
    'Caliper Izquierdo',
    'Discos de Freno',
    'grasa para frenos',
    'Pastillas',
    'Pernos de Caliper',
    'Regulación de frenos',
    'Solución',
    'Tambor',
    'Zapatas',
    'Espárragos delanteros',
    'Espárragos traseros',
    'Manguera de frenos'
  ],
  Suspensión: [
    'Amortiguadores delanteros',
    'Amortiguadores traseros',
    'Buje tijera grande',
    'Buje tijera pequeño',
    'Bushing hojas de resorte',
    'Hoja resorte',
    'puente delantero',
    'tijera inferior derecha',
    'tijera inferior izquierda',
    'tijera superior derecha',
    'tijera superior izquierda',
    'hules de barra estabilizadora'
  ],
  Dirección: [
    'barra de dirección',
    'Cremallera',
    'Eje delantero',
    'Flecha derecha',
    'Flecha izquierda',
    'Power Steering',
    'Solución de power',
    'Terminal dirección',
    'Reparación completa de dirección',
    'Reparación de llanta',
    'Graseras',
    'Reparación de Chasis'
  ],
  Transmisión: [
    'Ajuste pedal clutch',
    'balero de flecha',
    'baleros de corona',
    'Bomba auxiliar',
    'Bomba central',
    'Cambio de Caja velocidades',
    'Cardan',
    'collarín',
    'Cruceta',
    'Diferencial trasero',
    'Disco de clutch',
    'Flecha trasera izquierda',
    'Flechas traseras derechas',
    'kit de embrague',
    'Orquilla',
    'Prensa',
    'Reparación de caja de velocidades',
    'sello de flecha',
    'Soporte de caja',
    'Cambio de corona',
    'Bushing de palanca',
    'cambio de palanca'
  ],
  Carrocería: [
    'Bisagra lado izquierda',
    'Bisagra lado derecho',
    'Chapa derecha',
    'Chapa izquierda',
    'Direccional Derecha',
    'Direccional Izquierda',
    'Faro derecho',
    'Faro Izquierdo',
    'Manecilla exterior derecha',
    'Manecilla exterior izquierda',
    'Manecilla interior derecha',
    'Manecilla interior izquierda',
    'Reparación de furgón',
    'Reparar filtración de agua',
    'soldar escape',
    'Reparación de piso de base freno de mano',
    'Máquina sube vidrio',
    'Manecilla sube vidrio',
    'Retrovisor izquierdo',
    'Retrovisor derecho',
    'Reparación de golpe en cabina',
    'Reparación de golpe en furgón',
    'Parabrisa delantero',
    'Vidrio puerta derecha',
    'Vidrio puerta izquierda',
    'Soldadura de grada',
    'Cambio de asientos',
    'Cambio de plywood',
    'Forrado con lámina lateral derecho',
    'Forrado con lámina lateral izquierdo',
    'Forrado de puertas de furgón',
    'Instalación de publicidad',
    'Pintar furgon interno',
    'Pintar cama de furgon exterior'
  ],
  'Sistema Eléctrico': [
    'Alternador',
    'Batería',
    'bocina',
    'Cricos',
    'Incandescentes',
    'luces Intermitentes',
    'Luz de Furgón',
    'Luz de Placa',
    'Luz de Retroceso',
    'Cambio de foco de Stop',
    'Marcador de temperatura',
    'Motor de arranque',
    'Solenoide',
    'Silvin Derecho',
    'Silvin Izquierdo',
    'Via Derecho',
    'Via Izquierdo',
    'Terminales de Batería',
    'Relay',
    'Flasher',
    'Fusibles',
    'Switch de Luces',
    'Switch de cricos',
    'Cambio de Stop completo',
    'luces de cortesía'
  ]
};

function claveDe(area, texto) {
  const quitarAcentos = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const base = `emp-${quitarAcentos(area)}-${quitarAcentos(texto)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'emp-sin-clave';
}

function tareasDeEmpresa(area, textos) {
  const usadas = new Set();
  return textos.map((original) => {
    const texto = String(original).trim();
    const base = claveDe(area, texto);
    let clave = base;
    let intento = 2;
    while (usadas.has(clave)) clave = `${base}-${intento++}`;
    usadas.add(clave);
    return { clave, descripcion: texto, area, tiempoEstimadoMinutos: 60 };
  });
}

const TAREAS_REPARACION_GENERICAS = [
  { clave: 'rep-pint-completo', descripcion: 'Pintura de carrocería completa', area: 'Pintura', tiempoEstimadoMinutos: 480 },
  { clave: 'rep-pint-area', descripcion: 'Pintura por área (retoque localizado)', area: 'Pintura', tiempoEstimadoMinutos: 180 },
  { clave: 'rep-pint-pulido', descripcion: 'Pulido y encerado', area: 'Pintura', tiempoEstimadoMinutos: 120 },
  { clave: 'rep-aa-gas', descripcion: 'Recarga de gas de aire acondicionado', area: 'Aire Acondicionado', tiempoEstimadoMinutos: 60 },
  { clave: 'rep-aa-compresor', descripcion: 'Reparación / cambio de compresor', area: 'Aire Acondicionado', tiempoEstimadoMinutos: 180 },
  { clave: 'rep-aa-evaporador', descripcion: 'Limpieza de evaporador', area: 'Aire Acondicionado', tiempoEstimadoMinutos: 90 },
  { clave: 'rep-gen-inspeccion', descripcion: 'Inspección general del vehículo', area: 'General', tiempoEstimadoMinutos: 60 },
  { clave: 'rep-gen-prueba', descripcion: 'Prueba de ruta y verificación', area: 'General', tiempoEstimadoMinutos: 30 },
  { clave: 'rep-gen-ajustes', descripcion: 'Ajustes varios', area: 'General', tiempoEstimadoMinutos: 60 }
];

const TAREAS_REPARACION = [
  ...Object.entries(TAREAS_POR_AREA_EMPRESA)
    .flatMap(([area, textos]) => tareasDeEmpresa(area, textos)),
  ...TAREAS_REPARACION_GENERICAS
];

const conId = (grupo, lista) => lista.map(t => ({ id: `${grupo}:${t.clave}`, grupo, ...t }));

const CATALOGO = {
  mantenimiento_5000: conId('mantenimiento_5000', TAREAS_5000),
  mantenimiento_20000: conId('mantenimiento_20000', TAREAS_20000),
  reparacion: conId('reparacion', TAREAS_REPARACION)
};

export function obtenerTareasMantenimiento(grupo) {
  return CATALOGO[grupo] || [];
}

export function obtenerTareasReparacion(area) {
  const todas = CATALOGO.reparacion;
  if (!area) return todas;
  return todas.filter(t => t.area === area);
}

export const AREAS_REPARACION = AREAS_SELECT;


function reemplazar(destino, nuevos) {
  destino.length = 0;
  destino.push(...nuevos);
}

function conGrupo(grupo, lista) {
  return (Array.isArray(lista) ? lista : []).map(t => ({ ...t, id: `${grupo}:${t.clave}`, grupo }));
}

function clonarLista(lista) {
  return (Array.isArray(lista) ? lista : []).map(t => ({ ...t }));
}

function clonarMapa(mapa) {
  const salida = {};
  Object.entries(mapa || {}).forEach(([clave, textos]) => {
    salida[clave] = Array.isArray(textos) ? [...textos] : [];
  });
  return salida;
}

function reconstruirReparacion() {
  const nuevas = [
    ...Object.entries(TAREAS_POR_AREA_EMPRESA)
      .flatMap(([area, textos]) => tareasDeEmpresa(area, textos)),
    ...TAREAS_REPARACION_GENERICAS,
  ];
  reemplazar(CATALOGO.reparacion, conGrupo('reparacion', nuevas));
}

export function aplicarTareas(datos) {
  if (!datos || typeof datos !== 'object') return;

  const base = datos.mantenimiento?.base5000;
  const extendidas = datos.mantenimiento?.extendidas20000;

  if (Array.isArray(base)) {
    reemplazar(CATALOGO.mantenimiento_5000, conGrupo('mantenimiento_5000', base));
    const mayor = [...base, ...(Array.isArray(extendidas) ? extendidas : clonarLista(TAREAS_EXTENDIDAS_20000))];
    reemplazar(CATALOGO.mantenimiento_20000, conGrupo('mantenimiento_20000', mayor));
  } else if (Array.isArray(extendidas)) {
    reemplazar(CATALOGO.mantenimiento_20000, conGrupo('mantenimiento_20000', [...TAREAS_5000, ...extendidas]));
  }

  if (datos.empresa && typeof datos.empresa === 'object') {
    Object.keys(TAREAS_POR_AREA_EMPRESA).forEach(k => delete TAREAS_POR_AREA_EMPRESA[k]);
    Object.entries(datos.empresa).forEach(([area, textos]) => {
      TAREAS_POR_AREA_EMPRESA[area] = (Array.isArray(textos) ? textos : [])
        .map(t => String(t || '').trim())
        .filter(Boolean);
    });
  }

  if (Array.isArray(datos.genericas)) {
    reemplazar(TAREAS_REPARACION_GENERICAS, datos.genericas.map(t => ({ ...t })));
  }

  reconstruirReparacion();
}

export function obtenerEditorTareas() {
  return {
    mantenimiento: {
      base5000: clonarLista(TAREAS_5000),
      extendidas20000: clonarLista(TAREAS_EXTENDIDAS_20000),
    },
    empresa: clonarMapa(TAREAS_POR_AREA_EMPRESA),
    genericas: clonarLista(TAREAS_REPARACION_GENERICAS),
  };
}
