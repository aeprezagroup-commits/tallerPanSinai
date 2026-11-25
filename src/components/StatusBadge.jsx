import { ESTADOS_CONFIG } from '../constants/estadosConfig';

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
