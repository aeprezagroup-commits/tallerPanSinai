import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute renders the given children only if the current user role is
 * included in the allowedRoles array. Otherwise it redirects to redirectTo
 * (or the home page by default).
 *
 * `onlyRoles` (opcional) marca una ruta EXCLUSIVA: aunque el administrador
 * pueda entrar a todo, aquí solo entra quien esté en esa lista. Se usa en la
 * consola oculta de soporte (/admin-secreto/bitacora), reservada al super
 * administrador.
 *
 * @param {{ allowedRoles?: string[], onlyRoles?: string[], redirectTo?: string, children: JSX.Element }} props
 */
export default function ProtectedRoute({ allowedRoles = [], onlyRoles, children, redirectTo = '/' }) {
  const { isAdmin, isEncargado, isMecanico, isSuperAdmin } = useAuth();
  const role = isSuperAdmin
    ? 'superadmin'
    : isAdmin
      ? 'admin'
      : isEncargado
        ? 'encargado'
        : isMecanico
          ? 'mecanico'
          : null;

  if (!role) {
    // Not authenticated – send to login
    return <Navigate to="/login" replace />;
  }

  // Rutas exclusivas: no se abren por ser administrador
  if (onlyRoles) {
    return onlyRoles.includes(role)
      ? children
      : <Navigate to={redirectTo} replace />;
  }

  // Admins (y el super administrador) can access everything
  if (role === 'admin' || role === 'superadmin') {
    return children;
  }

  if (allowedRoles.includes(role)) {
    return children;
  }

  // Role not permitted – redirect to the section that belongs to them
  return <Navigate to={redirectTo} replace />;
}
