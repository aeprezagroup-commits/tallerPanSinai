import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    return <Navigate to="/login" replace />;
  }

  if (onlyRoles) {
    return onlyRoles.includes(role)
      ? children
      : <Navigate to={redirectTo} replace />;
  }

  if (role === 'admin' || role === 'superadmin') {
    return children;
  }

  if (allowedRoles.includes(role)) {
    return children;
  }

  return <Navigate to={redirectTo} replace />;
}
