import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { obtenerUsuarios, esSuperAdmin } from '../services/usuariosService';

export default function RutaConsolaSoporte({ children }) {
  const { currentUser, isAdmin, isSuperAdmin } = useAuth();

  if (!currentUser) return <Navigate to="/login" replace />;
  if (isSuperAdmin) return children;

  const haySoporte = obtenerUsuarios().some(esSuperAdmin);
  if (isAdmin && !haySoporte) return children;

  return <Navigate to="/admin" replace />;
}
