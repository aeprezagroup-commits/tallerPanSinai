
export const DTC_DATABASE = [
  {
    codigo: 'P0300',
    sistema: 'Motor / Encendido',
    descripcion: 'Detección de fallo de encendido en cilindros aleatorios o múltiples',
    severidad: 'critico',
    sensorAfectado: 'Sensor CKP / Bobinas / Inyectores',
    solucionRecomendada: 'Inspeccionar bujías, bobinas de ignición y calibración de inyectores diésel/gasolina.',
    freezeFrame: { rpm: '2,420 RPM', coolantTemp: '98 °C', fuelTrim: '+14.2%', speed: '62 km/h' }
  },
  {
    codigo: 'P0420',
    sistema: 'Emisiones / Escape',
    descripcion: 'Eficiencia del sistema catalítico por debajo del umbral (Banco 1)',
    severidad: 'advertencia',
    sensorAfectado: 'Sensor O2 Posterior / Convertidor Catalítico',
    solucionRecomendada: 'Verificar sensor de oxígeno aguas abajo y limpiar/inspeccionar catalizador o DPF.',
    freezeFrame: { rpm: '1,850 RPM', coolantTemp: '89 °C', fuelTrim: '+3.1%', speed: '55 km/h' }
  },
  {
    codigo: 'P0171',
    sistema: 'Combustible / Admisión',
    descripcion: 'Mezcla demasiado pobre en el sistema (Banco 1)',
    severidad: 'advertencia',
    sensorAfectado: 'Sensor MAF / Presión Riel de Combustible',
    solucionRecomendada: 'Limpieza de sensor de flujo másico de aire (MAF) y revisión de fugas de vacío en múltiple.',
    freezeFrame: { rpm: '850 RPM', coolantTemp: '85 °C', fuelTrim: '+21.5%', speed: '0 km/h' }
  },
  {
    codigo: 'U0100',
    sistema: 'Red CAN-Bus / Módulos',
    descripcion: 'Pérdida de comunicación con el Módulo de Control del Motor (ECM/PCM)',
    severidad: 'critico',
    sensorAfectado: 'Bus de datos CAN Hi/Low',
    solucionRecomendada: 'Revisar arnés de cableado principal, masa de chasis y fusibles de alimentación ECU.',
    freezeFrame: { rpm: '0 RPM', coolantTemp: '24 °C', fuelTrim: '0.0%', speed: '0 km/h' }
  },
  {
    codigo: 'B1318',
    sistema: 'Sistema Eléctrico / Carrocería',
    descripcion: 'Voltaje de batería del vehículo inferior al mínimo operativo (< 11.5V)',
    severidad: 'advertencia',
    sensorAfectado: 'Alternador / Regulador de Voltaje / Batería',
    solucionRecomendada: 'Realizar prueba de carga a batería y verificar diodos rectificadores del alternador.',
    freezeFrame: { rpm: '780 RPM', coolantTemp: '72 °C', fuelTrim: '-1.0%', speed: '0 km/h' }
  },
  {
    codigo: 'C0035',
    sistema: 'Frenos ABS / Control de Tracción',
    descripcion: 'Circuito del sensor de velocidad de rueda delantera izquierda fuera de rango',
    severidad: 'critico',
    sensorAfectado: 'Sensor ABS Rueda Delantera Izq',
    solucionRecomendada: 'Limpiar captor magnético en maza de rueda y comprobar continuidad de cableado.',
    freezeFrame: { rpm: '1,200 RPM', coolantTemp: '82 °C', fuelTrim: '0.0%', speed: '34 km/h' }
  },
  {
    codigo: 'P0299',
    sistema: 'Turbo / Sobrealimentación',
    descripcion: 'Baja presión de carga en el turbocompresor (Underboost)',
    severidad: 'advertencia',
    sensorAfectado: 'Sensor MAP / Válvula Wastegate Turbo',
    solucionRecomendada: 'Comprobar mangueras de intercooler por fisuras y verificar actuador de la válvula de alivio.',
    freezeFrame: { rpm: '2,900 RPM', coolantTemp: '91 °C', fuelTrim: '+8.4%', speed: '78 km/h' }
  },
  {
    codigo: 'P0500',
    sistema: 'Transmisión / Velocidad',
    descripcion: 'Mal funcionamiento en el sensor de velocidad del vehículo (VSS)',
    severidad: 'informativo',
    sensorAfectado: 'Sensor VSS Transmisión',
    solucionRecomendada: 'Reemplazar sensor de velocidad montado en la cola de la caja de cambios.',
    freezeFrame: { rpm: '2,100 RPM', coolantTemp: '88 °C', fuelTrim: '+0.5%', speed: 'ERR' }
  }
];

export const PUNTOS_INSPECCION_360 = [
  { id: 'frenos_del', nombre: 'Frenos Delanteros', zona: 'chasis', icono: 'circle', x: 22, y: 32 },
  { id: 'tren_del', nombre: 'Tren Delantero & Rótulas', zona: 'suspension', icono: 'tool', x: 28, y: 32 },
  { id: 'motor', nombre: 'Motor & Inyección Diésel', zona: 'mecanica', icono: 'cpu', x: 25, y: 50 },
  { id: 'bateria', nombre: 'Batería & Alternador 12V/24V', zona: 'electrico', icono: 'zap', x: 30, y: 68 },
  { id: 'transmision', nombre: 'Caja & Embrague', zona: 'mecanica', icono: 'layers', x: 48, y: 50 },
  { id: 'cardan', nombre: 'Cardán & Crucetas', zona: 'transmision', icono: 'maximize', x: 62, y: 50 },
  { id: 'suspension_tras', nombre: 'Suspensión Paquete de Muelles', zona: 'suspension', icono: 'shield', x: 74, y: 32 },
  { id: 'frenos_tras', nombre: 'Frenos Tambor / Disco Trasero', zona: 'chasis', icono: 'circle', x: 78, y: 68 },
  { id: 'diferencial', nombre: 'Diferencial & Eje Posterior', zona: 'mecanica', icono: 'tool', x: 76, y: 50 },
  { id: 'luces', nombre: 'Sistema de Alumbrado y Señalización', zona: 'electrico', icono: 'sun', x: 92, y: 50 }
];

export function obtenerTelemetriaVehiculo(placa = '') {
  const seed = (placa || 'DEFAULT').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const bateria = (12.2 + ((seed % 18) / 10)).toFixed(1);
  const tempRefrigerante = 82 + (seed % 16);
  const presionAceite = 38 + (seed % 14);
  const nivelCombustible = 25 + (seed % 70);
  const milActivo = (seed % 3) === 0;
  const rpmIdle = 750 + (seed % 50);
  const saludGeneral = Math.max(70, Math.min(99, 100 - ((seed % 28))));
  const vidaAceite = Math.max(15, Math.min(95, 100 - ((seed * 3) % 85)));

  const dtcIndices = [(seed % DTC_DATABASE.length)];
  if (milActivo) {
    dtcIndices.push((seed + 2) % DTC_DATABASE.length);
  }
  const codigos = dtcIndices.map(i => DTC_DATABASE[i]);

  const hashIntegridad = Array.from({ length: 16 }, (_, i) =>
    ((seed * (i + 1) * 31) % 256).toString(16).padStart(2, '0')
  ).join('');

  return {
    placa,
    bateria: parseFloat(bateria),
    tempRefrigerante,
    presionAceite,
    nivelCombustible,
    milActivo,
    rpmIdle,
    saludGeneral,
    vidaAceite,
    codigos,
    hashIntegridad: `OBD-${hashIntegridad.toUpperCase()}`,
    timestamp: new Date().toISOString()
  };
}

export function generarCertificadoAuditoria(orden) {
  const fecha = new Date().toISOString();
  const rawStr = `${orden.id || 'ORD'}-${orden.placa || 'PLACA'}-${orden.estado}-${fecha}`;
  let hash = 0;
  for (let i = 0; i < rawStr.length; i++) {
    hash = (hash << 5) - hash + rawStr.charCodeAt(i);
    hash |= 0;
  }
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  return {
    codigoCertificado: `SINAI-CERT-${hexHash}`,
    selloDigital: `SHA256-${hexHash}${Math.abs(hash * 3).toString(16).toUpperCase()}`,
    fechaCertificacion: new Date().toLocaleString('es-SV'),
    estacionEmisora: 'TALLER CENTRAL PAN SINAÍ',
    estatusNorma: 'ACTA EMITIDA CONFORME AL PROTOCOLO DE TALLER PAN SINAÍ'
  };
}
