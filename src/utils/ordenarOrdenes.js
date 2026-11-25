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

export const ORDENES_POR_PAGINA = 30;

function aMilisegundos(ts) {
  if (!ts) return 0;
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export function ordenarOrdenes(ordenes) {
  return [...(ordenes || [])].sort((a, b) => {
    const pa = ORDEN_ESTADOS_PRIORIDAD[a?.estado] ?? PRIORIDAD_DESCONOCIDA;
    const pb = ORDEN_ESTADOS_PRIORIDAD[b?.estado] ?? PRIORIDAD_DESCONOCIDA;
    if (pa !== pb) return pa - pb;
    return aMilisegundos(b?.fechaIngreso) - aMilisegundos(a?.fechaIngreso);
  });
}
