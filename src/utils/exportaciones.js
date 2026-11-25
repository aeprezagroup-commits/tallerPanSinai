
import { formatearDinero } from './formato';

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MIME_CSV = 'text/csv;charset=utf-8;';

function esColumnaDinero(encabezado) {
  const h = String(encabezado || '').trim();
  return h.includes('$') ||
    /^(costo|monto|descuento|total|precio|gasto|gastos|presupuesto|salario|pago)/i.test(h);
}

function descargar(nombreArchivo, contenido, mime) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', nombreArchivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


export function escaparCampoCSV(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export function contenidoCSV(encabezados, filas) {
  const dinero = encabezados.map(esColumnaDinero);
  const celda = (v, i) =>
    dinero[i] && typeof v === 'number' && Number.isFinite(v) ? formatearDinero(v) : v;
  const lineas = [encabezados.map(escaparCampoCSV).join(',')];
  for (const fila of filas) lineas.push(fila.map((v, i) => escaparCampoCSV(celda(v, i))).join(','));
  return '\uFEFF' + lineas.join('\r\n');
}

export function descargarCSV(nombreArchivo, encabezados, filas) {
  const nombre = nombreArchivo.toLowerCase().endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`;
  descargar(nombre, contenidoCSV(encabezados, filas), MIME_CSV);
}


function escaparXML(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function nombreColumna(indice) {
  let i = indice + 1;
  let s = '';
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function hojaXML(encabezados, filas) {
  const estilos = encabezados.map(h => (esColumnaDinero(h) ? ' s="1"' : ''));
  const celda = (ref, v, estilo = '') => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      return `<c r="${ref}"${estilo}><v>${v}</v></c>`;
    }
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escaparXML(v)}</t></is></c>`;
  };
  const filasXML = [];
  filasXML.push(`<row r="1">${encabezados.map((h, i) => celda(`${nombreColumna(i)}1`, h)).join('')}</row>`);
  filas.forEach((fila, f) => {
    const r = f + 2;
    filasXML.push(`<row r="${r}">${fila.map((v, i) => celda(`${nombreColumna(i)}${r}`, v, estilos[i] || '')).join('')}</row>`);
  });
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${filasXML.join('')}</sheetData></worksheet>`;
}


const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function unir(partes) {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of partes) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function construirZIP(archivos) {
  const encoder = new TextEncoder();
  const ahora = new Date();
  const hora = ((ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1)) & 0xFFFF;
  const fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();

  const locales = [];
  const centrales = [];
  let offset = 0;

  for (const archivo of archivos) {
    const nombreBytes = encoder.encode(archivo.nombre);
    const bytes = archivo.bytes;
    const crc = crc32(bytes);

    const local = new Uint8Array(30 + nombreBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, hora, true);
    lv.setUint16(12, fecha, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, bytes.length, true);
    lv.setUint32(22, bytes.length, true);
    lv.setUint16(26, nombreBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nombreBytes, 30);
    locales.push(local, bytes);

    const central = new Uint8Array(46 + nombreBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, hora, true);
    cv.setUint16(14, fecha, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, bytes.length, true);
    cv.setUint32(24, bytes.length, true);
    cv.setUint16(28, nombreBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nombreBytes, 46);
    centrales.push(central);

    offset += local.length + bytes.length;
  }

  const tamCentral = centrales.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, archivos.length, true);
  ev.setUint16(10, archivos.length, true);
  ev.setUint32(12, tamCentral, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return unir([...locales, ...centrales, eocd]);
}

export function construirXLSX(encabezados, filas, hoja = 'Reporte') {
  const encoder = new TextEncoder();
  const nombreHoja = String(hoja).replace(/[[\]:*?/\\]/g, '').slice(0, 31).trim() || 'Reporte';

  const contenidoTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>';

  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${escaparXML(nombreHoja)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  const estilos = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  return construirZIP([
    { nombre: '[Content_Types].xml', bytes: encoder.encode(contenidoTypes) },
    { nombre: '_rels/.rels', bytes: encoder.encode(rels) },
    { nombre: 'xl/workbook.xml', bytes: encoder.encode(workbook) },
    { nombre: 'xl/_rels/workbook.xml.rels', bytes: encoder.encode(workbookRels) },
    { nombre: 'xl/styles.xml', bytes: encoder.encode(estilos) },
    { nombre: 'xl/worksheets/sheet1.xml', bytes: encoder.encode(hojaXML(encabezados, filas)) },
  ]);
}

export function descargarXLSX(nombreArchivo, encabezados, filas, hoja = 'Reporte') {
  const nombre = nombreArchivo.toLowerCase().endsWith('.xlsx') ? nombreArchivo : `${nombreArchivo}.xlsx`;
  const bytes = construirXLSX(encabezados, filas, hoja);
  descargar(nombre, new Blob([bytes], { type: MIME_XLSX }));
}
