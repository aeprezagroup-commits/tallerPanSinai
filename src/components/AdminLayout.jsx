import { Outlet } from 'react-router-dom';

/**
 * Contenedor del Área de Administración.
 *
 * Navegación en una sola vía: el Sidebar izquierdo (que lista los módulos)
 * y, dentro del Panel, las tarjetas de acceso directo.
 */
export default function AdminLayout() {
  return (
    <div className="animate-fade-in">
      <Outlet />
    </div>
  );
}
