/**
 * Orden visual de las ordenes de trabajo en Taller y en el registro.
 *
 * Prioridad por estado: de la entrada (recien ingresado) hacia la salida
 * (entregado). Dentro de un mismo estado se mantiene el orden inverso a
 * la fecha de ingreso: primero las más nuevas, después las más viejas.
 */
export const ORDEN_ESTADOS_PRIORIDAD = {
  ingresado: 1,
  pendiente_diagnostico: 2,
  en_proceso: 3,
  esperando_repuestos: 4,
  pausado: 5,
  pendiente_autorizacion: 6,
  finalizado: 7,
  listo_entrega: 8,
  entregado: 9,
  cancelado: 10,
};

const PRIORIDAD_DESCONOCIDA = 99;

/** Filas iniciales de la lista; el resto se pide con "Cargar más". */
export const ORDENES_POR_PAGINA = 30;

function aMilisegundos(ts) {
  if (!ts) return 0;
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Devuelve una copia ordenada: primero el estado más temprano del flujo
 * del taller y, a igual estado, la orden más reciente.
 *
 * @param {Array<object>} ordenes listado a ordenar (no se modifica).
 * @returns {Array<object>} nuevo arreglo ordenado.
 */
export function ordenarOrdenes(ordenes) {
  return [...(ordenes || [])].sort((a, b) => {
    const pa = ORDEN_ESTADOS_PRIORIDAD[a?.estado] ?? PRIORIDAD_DESCONOCIDA;
    const pb = ORDEN_ESTADOS_PRIORIDAD[b?.estado] ?? PRIORIDAD_DESCONOCIDA;
    if (pa !== pb) return pa - pb;
    return aMilisegundos(b?.fechaIngreso) - aMilisegundos(a?.fechaIngreso);
  });
}
