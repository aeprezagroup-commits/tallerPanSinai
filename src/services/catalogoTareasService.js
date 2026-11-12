
import { AREAS_SELECT } from '../constants/areas';

export const GRUPOS_MANTENIMIENTO = [
  { id: 'mantenimiento_5000', nombre: 'Servicio 5,000 km', km: 5000, resumen: 'Preventivo menor: lista oficial del taller (21 tareas).' },
  { id: 'mantenimiento_20000', nombre: 'Servicio 20,000 km', km: 20000, resumen: 'Preventivo mayor: lista oficial del taller (29 actividades).' }
];

export const MOTIVOS_INGRESO = [
  { id: 'mantenimiento', label: 'Mantenimiento programado', modo: 'mantenimiento' },
  { id: 'falla', label: 'Fallas o daños', modo: 'reparacion' }
];

// ============================================================
// Listas OFICIALES de mantenimiento (documentos del cliente):
//   - "MANTTO 5000 KM.docx" → 21 tareas
//   - "Mantenimiento Preventivo 20,000 km.docx" → 29 actividades
// Cada servicio carga exactamente SU lista, sin mezclarla con la
// del otro. Los textos se transcriben tal cual del formulario.
// ============================================================
const TAREAS_5000 = [
  { clave: 'mtto5k-aceite', descripcion: 'Cambio de Aceite (Motor)', area: 'Motor', tiempoEstimadoMinutos: 30 },
  { clave: 'mtto5k-filtro-aceite', descripcion: 'Cambio de Filtro de Aceite (Motor)', area: 'Motor', tiempoEstimadoMinutos: 15 },
  { clave: 'mtto5k-fugas-aceite', descripcion: 'Fugas de Aceite en Motor (Revisión)', area: 'Motor', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto5k-filtro-aire', descripcion: 'Filtro de Aire (Cambio o Revisión)', area: 'Motor', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto5k-filtro-combustible', descripcion: 'Filtro de Combustible (Cambio o Revisión)', area: 'Motor', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto5k-niveles', descripcion: 'Nivel de Liquido Power Steering y Freno (Revisión)', area: 'General', tiempoEstimadoMinutos: 15 },
  { clave: 'mtto5k-agua', descripcion: 'Revisión de Agua', area: 'Motor', tiempoEstimadoMinutos: 10 },
  { clave: 'mtto5k-fajas', descripcion: 'Fajas (Revisión)(Apretar)', area: 'Motor', tiempoEstimadoMinutos: 15 },
  { clave: 'mtto5k-luces-principales', descripcion: 'Luces principales (Revisión)', area: 'Sistema Eléctrico', tiempoEstimadoMinutos: 10 },
  { clave: 'mtto5k-luces-direccionales', descripcion: 'Luces Direccionales (vías) – (Revisión)', area: 'Sistema Eléctrico', tiempoEstimadoMinutos: 10 },
  { clave: 'mtto5k-luces-freno', descripcion: 'Luces de Freno (Revisión)', area: 'Sistema Eléctrico', tiempoEstimadoMinutos: 10 },
  { clave: 'mtto5k-bateria', descripcion: 'Batería (Revisión)', area: 'Sistema Eléctrico', tiempoEstimadoMinutos: 15 },
  { clave: 'mtto5k-frenos-limpieza', descripcion: 'Limpieza y Revisión de frenos (desmontar tambor para lijar fricciones y pastillas)', area: 'Frenos', tiempoEstimadoMinutos: 60 },
  { clave: 'mtto5k-frenos-regulacion', descripcion: 'Regulación general de frenos', area: 'Frenos', tiempoEstimadoMinutos: 30 },
  { clave: 'mtto5k-freno-mano', descripcion: 'Revisión de Freno de Mano', area: 'Frenos', tiempoEstimadoMinutos: 15 },
  { clave: 'mtto5k-engrase', descripcion: 'Engrase General', area: 'General', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto5k-reaprieto-chasis', descripcion: 'Reaprieto de Tuercas y Tornillos de Chasis', area: 'General', tiempoEstimadoMinutos: 30 },
  { clave: 'mtto5k-soporte-cardan', descripcion: 'Revisión de Soporte de Cardan', area: 'Transmisión', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto5k-tapones-hule', descripcion: 'Revisión de Tapones de Hule (cambiar)', area: 'Motor', tiempoEstimadoMinutos: 10 },
  { clave: 'mtto5k-crucetas-cardan', descripcion: 'Revisión de crucetas de Cardan', area: 'Transmisión', tiempoEstimadoMinutos: 30 },
  { clave: 'mtto5k-cambio-eje', descripcion: 'Cambio de EJE', area: 'Transmisión', tiempoEstimadoMinutos: 40 }
];

const TAREAS_20000 = [
  { clave: 'mtto20k-fricciones', descripcion: 'Fricciones desmontar tambores para lijar fricciones y pastillas', area: 'Frenos', tiempoEstimadoMinutos: 60 },
  { clave: 'mtto20k-baleros-ruedas', descripcion: 'Revisión de baleros de ruedas', area: 'Suspensión', tiempoEstimadoMinutos: 45 },
  { clave: 'mtto20k-engrase', descripcion: 'Engrase general', area: 'General', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto20k-reapriete-chasis', descripcion: 'Reapreté de tuercas y tornillos de chasis', area: 'General', tiempoEstimadoMinutos: 30 },
  { clave: 'mtto20k-manecillas', descripcion: 'Revisión de manecillas de puertas', area: 'Carrocería', tiempoEstimadoMinutos: 15 },
  { clave: 'mtto20k-sube-vidrios', descripcion: 'Revisión de sistema sube vidrios', area: 'Carrocería', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto20k-soporte-cardan', descripcion: 'Revisión de soporte de cardan', area: 'Transmisión', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto20k-soportes-caja', descripcion: 'Soportes caja de velocidades (revisión)', area: 'Transmisión', tiempoEstimadoMinutos: 30 },
  { clave: 'mtto20k-soportes-motor', descripcion: 'Soportes de motor (revisión)', area: 'Motor', tiempoEstimadoMinutos: 30 },
  { clave: 'mtto20k-bomba-combustible', descripcion: 'Bomba de Combustible (revisión)', area: 'Motor', tiempoEstimadoMinutos: 40 },
  { clave: 'mtto20k-filtro-aire', descripcion: 'Filtro de Aire (cambio)', area: 'Motor', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto20k-filtro-combustible', descripcion: 'Filtro de Combustible (revisión)', area: 'Motor', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto20k-tuberias', descripcion: 'Revisión tuberías de combustible y escape', area: 'Motor', tiempoEstimadoMinutos: 25 },
  { clave: 'mtto20k-amortiguadores', descripcion: 'Amortiguadores (revisión)', area: 'Suspensión', tiempoEstimadoMinutos: 40 },
  { clave: 'mtto20k-faja-ps', descripcion: 'Faja de Power Steeting (revisión)', area: 'Motor', tiempoEstimadoMinutos: 15 },
  { clave: 'mtto20k-direccion', descripcion: 'Revisión de dirección, terminales y barra tensora', area: 'Dirección', tiempoEstimadoMinutos: 45 },
  { clave: 'mtto20k-hojas-resorte', descripcion: 'Revisión de hojas de resortes', area: 'Suspensión', tiempoEstimadoMinutos: 40 },
  { clave: 'mtto20k-bomba-agua', descripcion: 'Bomba de agua (revisión)', area: 'Motor', tiempoEstimadoMinutos: 35 },
  { clave: 'mtto20k-mangueras-agua', descripcion: 'Mangueras de agua (revisión)', area: 'Motor', tiempoEstimadoMinutos: 15 },
  { clave: 'mtto20k-ventiladores', descripcion: 'Ventiladores de radiador (revisión)', area: 'Motor', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto20k-pastillas-zapatas', descripcion: 'Pastillas y Zapatas de Frenos', area: 'Frenos', tiempoEstimadoMinutos: 60 },
  { clave: 'mtto20k-aceite', descripcion: 'Aceite (cambio)', area: 'Motor', tiempoEstimadoMinutos: 30 },
  { clave: 'mtto20k-fajas-tiempo', descripcion: 'Fajas de tiempo (revisión)', area: 'Motor', tiempoEstimadoMinutos: 45 },
  { clave: 'mtto20k-filtro-aceite', descripcion: 'Filtro de aceite (cambio)', area: 'Motor', tiempoEstimadoMinutos: 15 },
  { clave: 'mtto20k-fugas-aceite', descripcion: 'Fugas de aceite en motor (revisión)', area: 'Motor', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto20k-fugas-hidraulico', descripcion: 'Fugas en sistema hidráulico (revisión)', area: 'Dirección', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto20k-lavado-motor', descripcion: 'Lavado de motor', area: 'Motor', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto20k-soluciones', descripcion: 'Revisión de soluciones', area: 'General', tiempoEstimadoMinutos: 20 },
  { clave: 'mtto20k-circuito-luces', descripcion: 'Circuito de Luces (revisión)', area: 'Sistema Eléctrico', tiempoEstimadoMinutos: 20 }
];

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

  const lista5000 = datos.mantenimiento?.lista5000;
  const lista20000 = datos.mantenimiento?.lista20000;

  if (Array.isArray(lista5000)) {
    reemplazar(CATALOGO.mantenimiento_5000, conGrupo('mantenimiento_5000', lista5000));
  }
  if (Array.isArray(lista20000)) {
    reemplazar(CATALOGO.mantenimiento_20000, conGrupo('mantenimiento_20000', lista20000));
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
      lista5000: clonarLista(TAREAS_5000),
      lista20000: clonarLista(TAREAS_20000),
    },
    empresa: clonarMapa(TAREAS_POR_AREA_EMPRESA),
    genericas: clonarLista(TAREAS_REPARACION_GENERICAS),
  };
}
