import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { obtenerUsuarios, esSuperAdmin } from '../services/usuariosService';

/**
 * Ruta de la consola oculta de soporte (/admin-secreto/bitacora).
 *
 * Entra únicamente la cuenta de SUPER ADMINISTRADOR. Solo mientras esa
 * cuenta todavía no exista, el administrador normal puede abrir la consola
 * para crearla (modo de instalación): en cuanto queda creada, la ruta queda
 * reservada para siempre al desarrollador.
 *
 * @param {{children: JSX.Element}} props
 */
export default function RutaConsolaSoporte({ children }) {
  const { currentUser, isAdmin, isSuperAdmin } = useAuth();

  if (!currentUser) return <Navigate to="/login" replace />;
  if (isSuperAdmin) return children;

  const haySoporte = obtenerUsuarios().some(esSuperAdmin);
  if (isAdmin && !haySoporte) return children;

  return <Navigate to="/admin" replace />;
}
