import { useNavigate } from 'react-router-dom';
import { TbArrowLeft } from '../icons';

/**
 * Botón "Volver" estándar de todos los apartados del sistema.
 * Si se indica `a`, navega a esa ruta; si no, regresa al historial.
 */
export default function BotonVolver({ a, etiqueta = 'Volver', titulo, margen = true }) {
  const navigate = useNavigate();
  const volver = () => (a ? navigate(a) : navigate(-1));

  return (
    <button
      type="button"
      onClick={volver}
      className="btn btn-secondary"
      style={margen ? { marginBottom: 10 } : undefined}
      title={titulo || etiqueta}
    >
      <TbArrowLeft /> {etiqueta}
    </button>
  );
}
