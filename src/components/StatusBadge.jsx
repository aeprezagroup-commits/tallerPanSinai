export const ESTADOS_CONFIG = {
  ingresado: {
    label: 'INGRESADO',
    descripcion: 'Recepción inicial',
    clase: 'ingresado'
  },
  pendiente_diagnostico: {
    label: 'PEND. DIAGNÓSTICO',
    descripcion: 'En evaluación técnica',
    clase: 'pausado'
  },
  en_proceso: {
    label: 'EN PROCESO',
    descripcion: 'Trabajo activo en taller',
    clase: 'en_proceso'
  },
  esperando_repuestos: {
    label: 'ESPERANDO REPUESTOS',
    descripcion: 'Pausado por piezas o suministros',
    clase: 'pausado'
  },
  pausado: {
    label: 'TRABAJO PAUSADO',
    descripcion: 'Interrupción temporal registrada',
    clase: 'pausado'
  },
  pendiente_autorizacion: {
    label: 'PEND. AUTORIZACIÓN',
    descripcion: 'Esperando visto bueno administrativo',
    clase: 'pausado'
  },
  finalizado: {
    label: 'FINALIZADO',
    descripcion: 'Reparación concluida por mecánico',
    clase: 'finalizado'
  },
  listo_entrega: {
    label: 'LISTO PARA ENTREGA',
    descripcion: 'Aprobado para retiro por motorista',
    clase: 'finalizado'
  },
  entregado: {
    label: 'ENTREGADO',
    descripcion: 'Vehículo retirado y orden cerrada',
    clase: 'entregado'
  },
  cancelado: {
    label: 'CANCELADO',
    descripcion: 'Orden cancelada',
    clase: 'pausado'
  }
};

export default function StatusBadge({ estado, className = '', style = {} }) {
  const config = ESTADOS_CONFIG[estado] || {
    label: (estado || 'PENDIENTE').replace('_', ' ').toUpperCase(),
    clase: 'ingresado'
  };

  return (
    <span className={`status-badge ${config.clase} ${className}`} style={style} title={config.descripcion}>
      <span className="status-dot" />
      {config.label}
    </span>
  );
}
