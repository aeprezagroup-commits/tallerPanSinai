import BotonVolver from '../components/BotonVolver';
import PanelCatalogos from '../components/PanelCatalogos';
import { useAuth } from '../context/AuthContext';

export default function Catalogos() {
  const { isSuperAdmin } = useAuth();

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <BotonVolver a="/admin" etiqueta="Volver al Panel" />
        <h1>Catálogos del Sistema</h1>
        <p>
          {isSuperAdmin
            ? 'Rutas de camiones y sus departamentos autorizados.'
            : 'Rutas de camiones: agregar, editar, eliminar y asignar por departamento.'}
        </p>
      </div>

      <PanelCatalogos soloRutas />
    </div>
  );
}
