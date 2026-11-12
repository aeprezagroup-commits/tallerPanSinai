import { normalizarPlaca } from '../utils/placas';
import { crearRepositorio } from '../firebase/repositorio';
import { registrarBitacora, TIPOS_BITACORA } from './bitacoraService';

export const DEPARTAMENTOS_EL_SALVADOR = [
  'San Salvador',
  'La Libertad',
  'Santa Ana',
  'San Miguel',
  'Sonsonate',
  'Usulután',
  'Ahuachapán',
  'La Paz',
  'Chalatenango',
  'Cuscatlán',
  'Morazán',
  'San Vicente',
  'Cabañas',
  'La Unión'
];

export const RUTAS_PREDETERMINADAS = [
  'Ruta 01 - San Salvador Centro & Escalerón',
  'Ruta 02 - Soyapango / Ilopango / San Martín',
  'Ruta 03 - Santa Tecla / Antiguo Cuscatlán / Lourdes',
  'Ruta 04 - Occidente 1: Santa Ana Centro / Chalchuapa',
  'Ruta 05 - Occidente 2: Sonsonate / Acajutla',
  'Ruta 06 - Oriente 1: San Miguel / Usulután',
  'Ruta 07 - Oriente 2: La Unión / San Alejo',
  'Ruta 08 - Paracentral: Zacatecoluca / La Paz',
  'Ruta 09 - Norte: Chalatenango / Aguilares',
  'Ruta 10 - Troncal del Norte / Apopa / Nejapa',
  'Ruta 11 - Mayorista Nocturna Pan & Harinas',
  'Ruta 12 - Cojutepeque / San Vicente'
];

export const ANIOS_VEHICULO = (() => {
  const tope = new Date().getFullYear();
  const lista = [];
  for (let anio = tope; anio >= 1970; anio--) lista.push(String(anio));
  return lista;
})();

export function opcionesCatalogo(catalogo, valorHeredado) {
  const valor = String(valorHeredado ?? '').trim();
  if (valor && !catalogo.includes(valor)) return [valor, ...catalogo];
  return catalogo;
}

export const RUTAS_POR_DEPARTAMENTO = {
  'San Salvador': [
    'Ruta 01 - San Salvador Centro & Escalerón',
    'Ruta 02 - Soyapango / Ilopango / San Martín',
    'Ruta 10 - Troncal del Norte / Apopa / Nejapa',
    'Ruta 11 - Mayorista Nocturna Pan & Harinas'
  ],
  'La Libertad': [
    'Ruta 03 - Santa Tecla / Antiguo Cuscatlán / Lourdes'
  ],
  'Santa Ana': [
    'Ruta 04 - Occidente 1: Santa Ana Centro / Chalchuapa'
  ],
  'Sonsonate': [
    'Ruta 05 - Occidente 2: Sonsonate / Acajutla'
  ],
  'Ahuachapán': [
    'Ruta 04 - Occidente 1: Santa Ana Centro / Chalchuapa'
  ],
  'San Miguel': [
    'Ruta 06 - Oriente 1: San Miguel / Usulután'
  ],
  'Usulután': [
    'Ruta 06 - Oriente 1: San Miguel / Usulután'
  ],
  'La Unión': [
    'Ruta 07 - Oriente 2: La Unión / San Alejo'
  ],
  'Morazán': [
    'Ruta 06 - Oriente 1: San Miguel / Usulután'
  ],
  'La Paz': [
    'Ruta 08 - Paracentral: Zacatecoluca / La Paz'
  ],
  'Chalatenango': [
    'Ruta 09 - Norte: Chalatenango / Aguilares'
  ],
  'Cuscatlán': [
    'Ruta 12 - Cojutepeque / San Vicente'
  ],
  'San Vicente': [
    'Ruta 12 - Cojutepeque / San Vicente'
  ],
  'Cabañas': [
    'Ruta 12 - Cojutepeque / San Vicente'
  ]
};

export function obtenerRutasPorDepartamento(depto) {
  if (!depto) return RUTAS_PREDETERMINADAS;
  return RUTAS_POR_DEPARTAMENTO[depto] || RUTAS_PREDETERMINADAS;
}

function reemplazar(destino, nuevos) {
  destino.length = 0;
  destino.push(...nuevos);
}

export function aplicarRutas(predeterminadas, porDepartamento) {
  const lista = (Array.isArray(predeterminadas) ? predeterminadas : [])
    .map(r => String(r || '').trim())
    .filter(Boolean);
  if (lista.length) reemplazar(RUTAS_PREDETERMINADAS, lista);

  if (porDepartamento && typeof porDepartamento === 'object') {
    Object.keys(RUTAS_POR_DEPARTAMENTO).forEach(k => delete RUTAS_POR_DEPARTAMENTO[k]);
    Object.entries(porDepartamento).forEach(([depto, rutas]) => {
      const limpias = (Array.isArray(rutas) ? rutas : [])
        .map(r => String(r || '').trim())
        .filter(Boolean);
      if (limpias.length) RUTAS_POR_DEPARTAMENTO[depto] = limpias;
    });
  }
}

export function obtenerEditorRutas() {
  return {
    predeterminadas: [...RUTAS_PREDETERMINADAS],
    porDepartamento: JSON.parse(JSON.stringify(RUTAS_POR_DEPARTAMENTO)),
  };
}

const FLOTA_INICIAL = [
  {
    placa: 'P345892',
    marca: 'Toyota',
    modelo: 'Hilux D-4D 4x4',
    numMotor: '2KD-7891234',
    anio: '2021',
    tipo: 'Pickup Supervisión',
    conductorHabitual: 'Mauricio Rivas',
    departamento: 'San Miguel',
    ruta: 'Ruta 06 - Oriente 1: San Miguel / Usulután',
    observaciones: 'Unidad asignada a supervisión de rutas oriente'
  },
  {
    placa: 'C812034',
    marca: 'Hyundai',
    modelo: 'HD65 Camión Furgón',
    numMotor: 'D4GA-456789',
    anio: '2020',
    tipo: 'Camión de Reparto Pan',
    conductorHabitual: 'José Guardado',
    departamento: 'San Salvador',
    ruta: 'Ruta 01 - San Salvador Centro & Escalerón',
    observaciones: 'Ruta San Salvador Centro - Capacidad 3.5 Ton'
  },
  {
    placa: 'P194553',
    marca: 'Nissan',
    modelo: 'Frontier NP300 Diésel',
    numMotor: 'YD25-110293',
    anio: '2022',
    tipo: 'Pickup Taller Móvil',
    conductorHabitual: 'Elena Salazar',
    departamento: 'La Libertad',
    ruta: 'Ruta 03 - Santa Tecla / Antiguo Cuscatlán / Lourdes',
    observaciones: 'Vehículo de asistencia en carretera'
  },
  {
    placa: 'C992140',
    marca: 'Isuzu',
    modelo: 'NPR 75L Turbo Intercooler',
    numMotor: '4HK1-903125',
    anio: '2019',
    tipo: 'Camión de Distribución Departamental',
    conductorHabitual: 'Samuel Mendoza',
    departamento: 'Santa Ana',
    ruta: 'Ruta 04 - Occidente 1: Santa Ana Centro / Chalchuapa',
    observaciones: 'Ruta Occidente - Santa Ana / Sonsonate'
  },
  {
    placa: 'C556712',
    marca: 'Kia',
    modelo: 'K2700 Doble Rodaje',
    numMotor: 'J2-984321',
    anio: '2023',
    tipo: 'Panel Reparto Rápido',
    conductorHabitual: 'Nelson Lemus',
    departamento: 'San Salvador',
    ruta: 'Ruta 02 - Soyapango / Ilopango / San Martín',
    observaciones: 'Ruta Soyapango / Ilopango'
  },
  {
    placa: 'C672109',
    marca: 'Hino',
    modelo: 'Dutro 300 Serie 616',
    numMotor: 'N04C-55678',
    anio: '2021',
    tipo: 'Camión Furgón Aislado',
    conductorHabitual: 'David Monge',
    departamento: 'Sonsonate',
    ruta: 'Ruta 05 - Occidente 2: Sonsonate / Acajutla',
    observaciones: 'Transporte de materia prima y harina'
  }
];

const repoVehiculos = crearRepositorio({
  coleccion: 'vehiculos_catalogo',
  claveLocal: 'pan_sinai_flota_vehiculos_v2',
  semilla: FLOTA_INICIAL,
  idDe: (v) => v.placa,
  campoId: 'placa',
  evento: 'pan_sinai_vehicles_updated',
  nombre: 'vehiculos',
});

export function centroCostoPorDepartamento(departamento) {
  if (!departamento) return '';
  return String(departamento)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function obtenerFlotaVehiculos() {
  try {
    return repoVehiculos.obtener();
  } catch {
    return FLOTA_INICIAL;
  }
}

export function guardarFlotaVehiculos(flota) {
  try {
    repoVehiculos.reemplazar(flota);
  } catch (e) {
    console.error('Error guardando catálogo de vehículos', e);
  }
}

export function hidratarVehiculos() {
  return repoVehiculos.hidratar().catch((e) => {
    console.warn('[vehiculos] hidratación fallida:', e);
    return { origen: 'local', total: obtenerFlotaVehiculos().length };
  });
}

export function esperarHidratacionVehiculos() {
  return repoVehiculos.esperarHidratacion();
}

export function buscarVehiculoCatalogo(query) {
  if (!query) return null;
  const flota = obtenerFlotaVehiculos();
  const qClean = query.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  const exacto = flota.find(v => v.placa.replace(/[^A-Z0-9]/g, '').toUpperCase() === qClean);
  if (exacto) return exacto;

  return flota.find(v => v.placa.replace(/[^A-Z0-9]/g, '').toUpperCase().includes(qClean)) || null;
}

export function registrarVehiculoCatalogo(vehiculo) {
  if (!vehiculo) {
    throw new Error('No se proporcionaron datos para el vehículo.');
  }

  const placaNorm = normalizarPlaca(vehiculo.placa);
  if (!placaNorm || placaNorm.length < 3) {
    throw new Error('La placa del vehículo es obligatoria y debe tener al menos 3 caracteres.');
  }

  const marcaNorm = (vehiculo.marca || '').trim();
  if (!marcaNorm || marcaNorm.length < 2) {
    throw new Error('La marca del vehículo es obligatoria.');
  }

  const modeloNorm = (vehiculo.modelo || '').trim();
  if (!modeloNorm || modeloNorm.length < 1) {
    throw new Error('El modelo del vehículo es obligatorio.');
  }

  let anioValido = '';
  if (vehiculo.anio !== undefined && vehiculo.anio !== null && String(vehiculo.anio).trim() !== '') {
    const anioNum = parseInt(vehiculo.anio, 10);
    const anioMax = new Date().getFullYear() + 1;
    if (isNaN(anioNum) || anioNum < 1970 || anioNum > anioMax) {
      throw new Error(`El año del vehículo debe ser un año válido entre 1970 y ${anioMax}.`);
    }
    anioValido = String(anioNum);
  }

  const vinNorm = (vehiculo.vin || '').trim().toUpperCase();
  if (vinNorm && vinNorm.length > 17) {
    throw new Error('El número VIN no puede superar los 17 caracteres alfanuméricos.');
  }

  const vehiculoSanitizado = {
    ...vehiculo,
    placa: placaNorm,
    marca: marcaNorm,
    modelo: modeloNorm,
    tipo: (vehiculo.tipo || 'Camión de Reparto').trim(),
    numMotor: (vehiculo.numMotor || '').trim().toUpperCase(),
    vin: vinNorm,
    anio: anioValido,
    conductorHabitual: (vehiculo.conductorHabitual || '').trim(),
    departamento: (vehiculo.departamento || '').trim(),
    ruta: (vehiculo.ruta || '').trim(),
    observaciones: (vehiculo.observaciones || '').trim()
  };

  const flota = obtenerFlotaVehiculos();
  const idx = flota.findIndex(v => normalizarPlaca(v.placa) === placaNorm);

  let registroGuardado;
  const esAlta = idx === -1;
  if (idx !== -1) {
    flota[idx] = { ...flota[idx], ...vehiculoSanitizado };
    registroGuardado = flota[idx];
  } else {
    flota.push(vehiculoSanitizado);
    registroGuardado = flota[flota.length - 1];
  }

  guardarFlotaVehiculos(flota);
  repoVehiculos.persistirUno(registroGuardado);
  registrarBitacora({
    tipo: TIPOS_BITACORA.VEHICULO,
    accion: esAlta ? 'crear' : 'editar',
    detalle: `${esAlta ? 'Registró' : 'Actualizó'} la unidad ${placaNorm} (${marcaNorm} ${modeloNorm})`,
    datos: { placa: placaNorm, marca: marcaNorm, modelo: modeloNorm, anio: anioValido },
  });
  return vehiculoSanitizado;
}

export function actualizarVehiculoCatalogo(placa, cambios = {}) {
  const placaNorm = normalizarPlaca(placa);
  if (!placaNorm) {
    throw new Error('Se requiere la placa del vehículo para actualizarlo.');
  }

  const flota = obtenerFlotaVehiculos();
  const actual = flota.find(v => normalizarPlaca(v.placa) === placaNorm);
  if (!actual) {
    throw new Error(`La unidad "${placaNorm}" no existe en el catálogo de flota.`);
  }

  return registrarVehiculoCatalogo({ ...actual, ...cambios, placa: actual.placa });
}

export function eliminarVehiculoCatalogo(placa) {
  let flota = obtenerFlotaVehiculos();
  const placaNorm = normalizarPlaca(placa);
  const previa = flota.find(v => normalizarPlaca(v.placa) === placaNorm);
  flota = flota.filter(v => normalizarPlaca(v.placa) !== placaNorm);
  guardarFlotaVehiculos(flota);
  repoVehiculos.borrarUno(placaNorm); 
  registrarBitacora({
    tipo: TIPOS_BITACORA.VEHICULO,
    accion: 'eliminar',
    detalle: `Eliminó del catálogo la unidad ${placaNorm}${previa ? ` (${previa.marca} ${previa.modelo})` : ''}`,
    datos: {
      placa: placaNorm,
      marca: previa?.marca || '',
      modelo: previa?.modelo || '',
      conductorHabitual: previa?.conductorHabitual || '',
      departamento: previa?.departamento || '',
    },
  });
}

export function generarPlantillaCSV() {
  const encabezados = 'PLACA,MARCA,MODELO,NUMERO_MOTOR,ANIO,TIPO_UNIDAD,CONDUCTOR_HABITUAL,OBSERVACIONES\n';
  return encabezados;
}

export function importarVehiculosCSV(textoCSV) {
  const lineas = textoCSV.split(/\r?\n/).filter(linea => linea.trim().length > 0);
  if (lineas.length <= 1) {
    throw new Error('El archivo CSV está vacío o no contiene filas de datos.');
  }

  const vehiculosImportados = [];
  let omitidosPorIncompletos = 0;

  for (let i = 1; i < lineas.length; i++) {
    const columnas = lineas[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (columnas.length >= 3) {
      const placa = normalizarPlaca(columnas[0]);
      const marca = (columnas[1] || '').trim();
      const modelo = (columnas[2] || '').trim();

      if (!placa || placa.length < 3 || !marca || !modelo) {
        omitidosPorIncompletos++;
        continue;
      }

      const numMotor = (columnas[3] || '').trim().toUpperCase();
      let anio = (columnas[4] || '').trim();
      const anioNum = parseInt(anio, 10);
      if (isNaN(anioNum) || anioNum < 1970 || anioNum > new Date().getFullYear() + 1) {
        anio = '';
      }

      const tipo = (columnas[5] || 'Camión de Reparto').trim();
      const conductorHabitual = (columnas[6] || '').trim();
      const observaciones = (columnas[7] || '').trim();

      vehiculosImportados.push({
        placa,
        marca,
        modelo,
        numMotor,
        anio,
        tipo,
        conductorHabitual,
        observaciones
      });
    } else {
      omitidosPorIncompletos++;
    }
  }

  if (vehiculosImportados.length === 0) {
    throw new Error(
      `No se encontraron vehículos válidos con datos completos (Placa, Marca y Modelo son obligatorios). Se omitieron ${omitidosPorIncompletos} registros incompletos.`
    );
  }

  const flotaActual = obtenerFlotaVehiculos();
  const mapa = new Map();
  flotaActual.forEach(v => mapa.set(normalizarPlaca(v.placa), v));
  vehiculosImportados.forEach(v => mapa.set(normalizarPlaca(v.placa), v));

  const nuevaFlota = Array.from(mapa.values());
  guardarFlotaVehiculos(nuevaFlota);
  vehiculosImportados.forEach((v) => repoVehiculos.persistirUno(v));

  return {
    total: vehiculosImportados.length,
    omitidos: omitidosPorIncompletos
  };
}
