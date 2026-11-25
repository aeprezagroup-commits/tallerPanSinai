import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');

function extraer(texto, desde, hasta) {
  const i = texto.indexOf(desde);
  const j = texto.indexOf(hasta, i);
  if (i === -1 || j === -1) throw new Error(`No se encontró el bloque: ${desde}`);
  return texto.slice(i, j);
}

const servicio = leer('src/services/vehiculosService.js');
const bloqueSanitizar = extraer(
  servicio,
  'function sanitizarVehiculoCatalogo',
  'export function registrarVehiculoCatalogo',
);
const bloqueCsv = servicio.slice(servicio.indexOf('const COLUMNAS_CSV'));

const codigo = `
function normalizarPlaca(valor) {
  return String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function validarVIN(v) {
  const vin = String(v ?? '').trim().toUpperCase();
  if (!vin) return null;
  if (!/^[A-Z0-9]+$/.test(vin)) return 'El VIN sólo puede contener letras y números (sin caracteres especiales).';
  if (vin.length !== 17) return 'El VIN debe tener exactamente 17 caracteres.';
  if (/[IOQ]/.test(vin)) return 'El VIN no puede contener las letras I, O ni Q.';
  return null;
}
function centroCostoPorDepartamento(departamento) {
  if (!departamento) return '';
  return String(departamento).trim().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase();
}
let flota = [];
const persistidos = [];
const bitacoras = [];
const repoVehiculos = { persistirUno: (r) => { persistidos.push(JSON.parse(JSON.stringify(r))); } };
const TIPOS_BITACORA = { VEHICULO: 'vehiculo' };
function obtenerFlotaVehiculos() { return flota; }
function guardarFlotaVehiculos(f) { flota = f; }
function registrarBitacora(e) { bitacoras.push(e); }
function flotaRef() { return flota; }

${bloqueSanitizar}
${bloqueCsv}

export { flotaRef, persistidos, bitacoras };
`;

const archivoTmp = path.join(raiz, 'scripts', '.tmp-csv-vehiculos.mjs');
fs.writeFileSync(archivoTmp, codigo, 'utf8');

const mod = await import(`file:///${archivoTmp.replace(/\\/g, '/')}`);
const { generarPlantillaCSV, importarVehiculosCSV, decodificarCSVBuffer, flotaRef, persistidos, bitacoras } = mod;

let fallos = 0;
function ok(cond, etiqueta) {
  if (cond) console.log(`  PASS  ${etiqueta}`);
  else { fallos++; console.log(`  FAIL  ${etiqueta}`); }
}

console.log('\n1. Plantilla descargable');
const plantilla = generarPlantillaCSV();
const lineas = plantilla.split('\n').filter((l) => l.trim());
const encabezado = lineas[0];
ok(
  ['PLACA', 'MARCA', 'MODELO', 'NUMERO_MOTOR', 'ANIO', 'TIPO_UNIDAD', 'CONDUCTOR_HABITUAL', 'VIN', 'DEPARTAMENTO', 'RUTA', 'OBSERVACIONES']
    .every((c) => encabezado.includes(c)),
  'encabezados completos (incluye VIN, DEPARTAMENTO y RUTA)',
);
ok(lineas.length === 3, `encabezado + 2 filas de ejemplo (${lineas.length} línea(s))`);

console.log('\n2. La fila de ejemplo no se importa');
try {
  importarVehiculosCSV(plantilla);
  ok(false, 'subir sólo la plantilla lanza error');
} catch (e) {
  ok(/no se encontraron veh/i.test(e.message), `subir sólo la plantilla lanza error: "${e.message.slice(0, 70)}"`);
}

console.log('\n3. Round-trip: plantilla + fila válida (comillas y comas dentro de campos)');
const filaValida = 'P20376;Hino;500;HN998877;2021;Camión de Reparto;"Monge, David";1HGBH41JXMN109188;La Libertad;Ruta 03 - Santa Tecla / Antiguo Cuscatlán / Lourdes;"Mantención preventiva, cada 5,000 km"';
const res = importarVehiculosCSV(plantilla + filaValida + '\n');
ok(res.total === 1 && res.altas === 1 && res.actualizaciones === 0 && res.omitidos === 0,
  `total=1 altas=1 omitidos=0 (obtuvo ${JSON.stringify(res)})`);
const v = flotaRef().find((x) => x.placa === 'P20376');
ok(Boolean(v), 'vehículo importado con placa normalizada');
ok(v && v.conductorHabitual === 'Monge, David', `comillas respetadas en CONDUCTOR_HABITUAL ("${v?.conductorHabitual}")`);
ok(v && v.observaciones === 'Mantención preventiva, cada 5,000 km', `comas dentro de un campo respetadas ("${v?.observaciones}")`);
ok(v && v.departamento === 'La Libertad' && v.centroCosto === 'LA LIBERTAD', `departamento y centroCosto derivado ("${v?.centroCosto}")`);
ok(v && v.ruta.startsWith('Ruta 03'), 'columna RUTA importada');
ok(v && v.vin === '1HGBH41JXMN109188', 'VIN importado');
ok(persistidos.length === 1, 'registro persistido una vez');
ok(bitacoras.length === 1 && bitacoras[0].accion === 'importar', 'bitácora registra la importación');

console.log('\n4. Validaciones equivalentes al formulario individual');
const filasMalas = [
  'AB123;Hino 500;X;HN1;2020;;;;;;;',
  'AB124;Hino;300!;HN1;2020;;;;;;',
  'AB125;Hino;300;HN1;1899;;;;;;',
  'AB126;Hino;300;HN1;2020;;;1HGBH41JXMN10918I;;;',
  ';Hino;300;;;;;;;;',
];
try {
  importarVehiculosCSV(encabezado + '\n' + filasMalas.join('\n') + '\n');
  ok(false, 'sólo filas inválidas → lanza error');
} catch (e) {
  ok(/omitidos: 5/i.test(e.message), `sólo filas inválidas → error con motivos: "${e.message.slice(0, 110)}"`);
}

console.log('\n5. Archivo antiguo (8 columnas, sin VIN/DEPARTAMENTO/RUTA) sigue funcionando');
const viejo = 'PLACA,MARCA,MODELO,NUMERO_MOTOR,ANIO,TIPO_UNIDAD,CONDUCTOR_HABITUAL,OBSERVACIONES\n'
  + 'P77777,Mercedes,Bus,BN555,2019,Camión de Reparto,Carlos López,Ruta norte\n';
const res3 = importarVehiculosCSV(viejo);
const v777 = flotaRef().find((x) => x.placa === 'P77777');
ok(res3.total === 1 && v777 && v777.anio === '2019' && v777.tipo === 'Camión de Reparto',
  `formato antiguo importa (${JSON.stringify(res3)})`);

console.log('\n6. Columnas en otro orden (encabezados reconocidos por nombre)');
const revuelto = 'OBSERVACIONES,RUTA,DEPARTAMENTO,VIN,CONDUCTOR_HABITUAL,TIPO_UNIDAD,ANIO,NUMERO_MOTOR,MODELO,MARCA,PLACA\n'
  + 'Obs,,,,,Camión de Reparto,2020,M1,Fuso,Hino,P00001\n';
try {
  const r6 = importarVehiculosCSV(revuelto);
  const v1 = flotaRef().find((x) => x.placa === 'P00001');
  ok(r6.total === 1 && v1 && v1.marca === 'Hino' && v1.modelo === 'Fuso', `se reconocen por nombre (${JSON.stringify(r6)})`);
} catch (e) {
  ok(false, `columnas en otro orden → ${e.message}`);
}

console.log('\n7. Actualiza registros existentes sin borrar campos extra');
const previa = flotaRef().find((x) => x.placa === 'P20376');
flotaRef().length = 0;
flotaRef().push({ ...previa, qrGenerado: true, fotos: 3 });
const res4 = importarVehiculosCSV('PLACA,MARCA,MODELO\n' + 'P20376,Hino,500\n');
const v2 = flotaRef().find((x) => x.placa === 'P20376');
ok(res4.total === 1 && res4.altas === 0 && res4.actualizaciones === 1,
  `detecta actualización (${JSON.stringify(res4)})`);
ok(v2 && v2.qrGenerado === true && v2.fotos === 3, 'conserva campos extra del registro previo');

console.log('\n8. Separador detectado: punto y coma (Excel es-SV) y coma (Excel EN)');
const conPuntoYComa = 'PLACA;MARCA;MODELO\nP88888;Hino;300\n';
const r8 = importarVehiculosCSV(conPuntoYComa);
const v888 = flotaRef().find((x) => x.placa === 'P88888');
ok(r8.total === 1 && v888 && v888.marca === 'Hino', `separador ";" importa (${JSON.stringify(r8)})`);

const conComa = 'PLACA,MARCA,MODELO\nP88889,Hino,500\n';
const r9 = importarVehiculosCSV(conComa);
const v889 = flotaRef().find((x) => x.placa === 'P88889');
ok(r9.total === 1 && v889 && v889.modelo === '500', `separador "," importa (${JSON.stringify(r9)})`);

console.log('\n9. Decodificación UTF-8 con respaldo Windows-1252 (Excel en ANSI)');
const ansi = Buffer.from('PLACA,MARCA,MODELO\nP99991,Cami\xf3n,Reparto\n', 'latin1');
const utf8 = Buffer.from('PLACA,MARCA,MODELO\nP99992,Camión,Reparto\n', 'utf8');
const tAnsi = decodificarCSVBuffer(ansi);
const tUtf8 = decodificarCSVBuffer(utf8);
ok(tAnsi.includes('Camión'), `ANSI se lee sin romper acentos ("${tAnsi.split('\n')[1]}")`);
ok(tUtf8.includes('Camión'), 'UTF-8 se lee directo');
const rAnsi = importarVehiculosCSV(tAnsi);
const vAnsi = flotaRef().find((x) => x.placa === 'P99991');
ok(rAnsi.total === 1 && vAnsi && vAnsi.marca === 'Camión', 'archivo ANSI importa con acentos correctos');

fs.unlinkSync(archivoTmp);
console.log(`\n${fallos === 0 ? 'TODO OK' : `${fallos} FALLO(S)`}\n`);
process.exit(fallos === 0 ? 0 : 1);
