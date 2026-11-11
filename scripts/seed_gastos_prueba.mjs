// ============================================
// DATOS DE PRUEBA — GASTOS POR VEHÍCULO
// Puebla la colección "gastos_vehiculo" de Firestore con gastos
// realistas del taller Pan Sinaí, repartidos entre las unidades
// del catálogo de flota.
//
//   node scripts/seed_gastos_prueba.mjs
//
// Es idempotente: usa IDs fijos (gasto-prueba-##) y los SOBRESCRIBE,
// así que se puede correr las veces que se quiera sin duplicar nada.
// ============================================

const PROJECT_ID = 'tallerpansinaisv';
const API_KEY = 'AIzaSyCkbvLBhkgt1XYt_UQQH_FRubxNHPOhvd4';
const COLECCION = 'gastos_vehiculo';
const URL_BASE =
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
  `/databases/%28default%29/documents/${COLECCION}`;

// ------------------------------------------------------------
// Conversión de JavaScript → campos tipados de la API REST
// ------------------------------------------------------------
function aCampo(valor) {
  if (valor === null || valor === undefined) return { nullValue: null };
  if (typeof valor === 'boolean') return { booleanValue: valor };
  if (typeof valor === 'number') {
    return Number.isInteger(valor) ? { integerValue: String(valor) } : { doubleValue: valor };
  }
  if (typeof valor === 'string') return { stringValue: valor };
  if (Array.isArray(valor)) return { arrayValue: { values: valor.map(aCampo) } };
  if (typeof valor === 'object') {
    return { mapValue: { fields: aDocument(valor) } };
  }
  return { stringValue: String(valor) };
}

function aDocument(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = aCampo(v);
  return fields;
}

// ------------------------------------------------------------
// GASTOS DE PRUEBA
// Unidades reales del catálogo de flota de Pan Sinaí.
// ------------------------------------------------------------
const UNIDADES = [
  { placa: 'P-345892', centro: 'SAN MIGUEL' },    // San Miguel
  { placa: 'P-812034', centro: 'SAN SALVADOR' },   // San Salvador
  { placa: 'P-194553', centro: 'LA LIBERTAD' },    // La Libertad
  { placa: 'P-992140', centro: 'SANTA ANA' },      // Santa Ana
  { placa: 'P-556712', centro: 'SAN SALVADOR' },   // San Salvador
  { placa: 'P-672109', centro: 'SONSONATE' },      // Sonsonate
];

const GASTOS = [
  // --- P-345892 (pickup supervisión) ---
  { u: 0, fecha: '2026-09-03', tipo: 'proveedor', doc: 'DTE-00041872', proveedor: 'Repuestos y Accesorios S.A.', gasto: 'Llantas 225/75R15 (4 unidades)', cantidad: 4, monto: 486.5, descuento: 36.5, estado: 'pagado' },
  { u: 0, fecha: '2026-09-21', tipo: 'proveedor', doc: 'DTE-00042115', proveedor: 'Lubricantes del Salvador', gasto: 'Aceite 15W-40 para diésel (6 galones)', cantidad: 6, monto: 132.9, descuento: 0, estado: 'pagado' },
  { u: 0, fecha: '2026-10-08', tipo: 'almacen', doc: 'VALE-0093', gasto: 'Filtros de aceite, aire y combustible', cantidad: 3, monto: 74.25, descuento: 0, estado: 'por_pagar' },

  // --- P-812034 (camión furgón de reparto) ---
  { u: 1, fecha: '2026-08-27', tipo: 'proveedor', doc: 'DTE-00041006', proveedor: 'Frenos y Partes S.A.', gasto: 'Pastillas y discos de freno delanteros', cantidad: 2, monto: 268.0, descuento: 18.0, estado: 'pagado' },
  { u: 1, fecha: '2026-09-14', tipo: 'proveedor', doc: 'DTE-00041930', proveedor: 'Baterías Centro América', gasto: 'Batería 12V 100Ah para camión', cantidad: 1, monto: 189.99, descuento: 0, estado: 'pagado' },
  { u: 1, fecha: '2026-10-02', tipo: 'proveedor', doc: 'DTE-00042488', proveedor: 'Talleres Mecánicos Unión', gasto: 'Reparación de alternador y regulador', cantidad: 1, monto: 340.0, descuento: 40.0, estado: 'por_pagar' },
  { u: 1, fecha: '2026-10-19', tipo: 'almacen', doc: 'VALE-0104', gasto: 'Correa de distribución y tensor', cantidad: 1, monto: 156.75, descuento: 0, estado: 'por_pagar' },

  // --- P-194553 ---
  { u: 2, fecha: '2026-08-30', tipo: 'proveedor', doc: 'DTE-00041244', proveedor: 'Lubricantes del Salvador', gasto: 'Servicio completo de motor (aceite y filtros)', cantidad: 1, monto: 98.4, descuento: 0, estado: 'pagado' },
  { u: 2, fecha: '2026-09-25', tipo: 'almacen', doc: 'VALE-0088', gasto: 'Refrigerante y manguetas del sistema de enfriamiento', cantidad: 4, monto: 63.2, descuento: 0, estado: 'pagado' },
  { u: 2, fecha: '2026-10-11', tipo: 'proveedor', doc: 'DTE-00042610', proveedor: 'Servicio de Alineación El Progreso', gasto: 'Alineación, balanceo y revisión de dirección', cantidad: 1, monto: 45.0, descuento: 5.0, estado: 'por_pagar' },

  // --- P-556120 ---
  { u: 3, fecha: '2026-09-06', tipo: 'proveedor', doc: 'DTE-00041701', proveedor: 'Neumáticos del Pacífico', gasto: 'Llantas 195/65R15 (4 unidades)', cantidad: 4, monto: 372.0, descuento: 22.0, estado: 'pagado' },
  { u: 3, fecha: '2026-09-28', tipo: 'proveedor', doc: 'DTE-00042233', proveedor: 'Talleres Mecánicos Unión', gasto: 'Reparación de bomba de agua y empaque', cantidad: 1, monto: 215.5, descuento: 0, estado: 'por_pagar' },
  { u: 3, fecha: '2026-10-15', tipo: 'almacen', doc: 'VALE-0111', gasto: 'Bujías y cables de encendido', cantidad: 4, monto: 58.8, descuento: 0, estado: 'por_pagar' },

  // --- P-771204 ---
  { u: 4, fecha: '2026-08-22', tipo: 'proveedor', doc: 'DTE-00040877', proveedor: 'Frenos y Partes S.A.', gasto: 'Línea de frenos neumáticos (mangueras)', cantidad: 2, monto: 142.3, descuento: 0, estado: 'pagado' },
  { u: 4, fecha: '2026-09-17', tipo: 'proveedor', doc: 'DTE-00042019', proveedor: 'Pinturas y Tintas Centro', gasto: 'Pintura para retoque de carrocería', cantidad: 1, monto: 87.6, descuento: 10.0, estado: 'pagado' },
  { u: 4, fecha: '2026-10-05', tipo: 'almacen', doc: 'VALE-0097', gasto: 'Aceite hidráulico y limpiador de frenos', cantidad: 2, monto: 44.9, descuento: 0, estado: 'por_pagar' },

  // --- P-208877 ---
  { u: 5, fecha: '2026-09-09', tipo: 'proveedor', doc: 'DTE-00041812', proveedor: 'Repuestos y Accesorios S.A.', gasto: 'Espejos laterales y intermitentes', cantidad: 4, monto: 96.4, descuento: 0, estado: 'pagado' },
  { u: 5, fecha: '2026-09-30', tipo: 'proveedor', doc: 'DTE-00042301', proveedor: 'Lubricantes del Salvador', gasto: 'Aceite 20W-50 y filtro (servicio mayor)', cantidad: 1, monto: 121.75, descuento: 12.75, estado: 'pagado' },
  { u: 5, fecha: '2026-10-21', tipo: 'almacen', doc: 'VALE-0118', gasto: 'Amortiguadores delanteros (par)', cantidad: 2, monto: 178.0, descuento: 0, estado: 'por_pagar' },
];

// ------------------------------------------------------------
// Programa principal
// ------------------------------------------------------------
async function main() {
  console.log(`\nSembrando ${GASTOS.length} gastos de prueba en "${COLECCION}"...\n`);

  let creados = 0;
  let fallidos = 0;

  for (let i = 0; i < GASTOS.length; i++) {
    const g = GASTOS[i];
    const unidad = UNIDADES[g.u];
    const id = `gasto-prueba-${String(i + 1).padStart(2, '0')}`;

    const esAlmacen = g.tipo === 'almacen';
    const documento = {
      fecha: g.fecha,
      tipo: g.tipo,
      ccf: g.doc,
      dte: esAlmacen ? '' : g.doc,
      vale: esAlmacen ? g.doc : '',
      proveedor: esAlmacen ? '' : g.proveedor,
      gastos: g.gasto,
      cantidad: g.cantidad,
      monto: g.monto,
      descuento: g.descuento,
      centroCosto: g.centro || unidad.centro,
      estado: g.estado,
      unidad: unidad.placa,
      ordenId: '',
      ot: '',
      prueba: true, // marca para poder limpiarlos después
    };

    try {
      // currentDocument.exists va como parámetro de URL: solo crea si no
      // existe, lo que hace el script idempotente y seguro de repetir.
      const url = `${URL_BASE}/${id}?key=${API_KEY}&currentDocument.exists=false`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: aDocument(documento) }),
      });

      if (res.ok) {
        creados++;
        console.log(`  ✓ ${id}  ${unidad.placa}  ${g.fecha}  ${g.gasto.slice(0, 44)}`);
      } else if (res.status === 409) {
        console.log(`  = ${id} ya existía, se omite`);
      } else {
        fallidos++;
        const texto = await res.text();
        console.log(`  ✗ ${id} → HTTP ${res.status}: ${texto.slice(0, 180)}`);
      }
    } catch (e) {
      fallidos++;
      console.log(`  ✗ ${id} → ${e.message}`);
    }
  }

  console.log(`\nListo: ${creados} creados, ${fallidos} con error, ${GASTOS.length - creados - fallidos} ya existentes.`);
  console.log(`Colección: ${COLECCION}\n`);
  if (fallidos > 0) process.exitCode = 1;
}

main();
