import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './components/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import CambioPasswordObligatorio from './components/CambioPasswordObligatorio';
import RutaConsolaSoporte from './components/RutaConsolaSoporte';

import Login from './pages/Login';
import Inicio from './pages/Inicio';
import Dashboard from './pages/Dashboard';
import NuevaOrden from './pages/NuevaOrden';
import Ordenes from './pages/Ordenes';
import DetalleOrden from './pages/DetalleOrden';
import Taller from './pages/Taller';
import Historial from './pages/Historial';
import Salida from './pages/Salida';
import Admin from './pages/Admin';
import VehiculoDetalle from './pages/VehiculoDetalle';
import AdminHub from './pages/AdminHub';
import Gastos from './pages/Gastos';
import VehicleStatus from './pages/VehicleStatus';
import SuperAdmin from './pages/SuperAdmin';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <PuertaDeSeguridad>
            <Router>
              <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/login" element={<Navigate to="/" replace />} />

                <Route element={<Layout />}>
                  <Route path="/nueva-orden" element={<ProtectedRoute allowedRoles={['admin', 'encargado', 'mecanico']}><NuevaOrden /></ProtectedRoute>} />
                  <Route path="/ordenes" element={<Ordenes />} />
                  <Route path="/ordenes/:id" element={<DetalleOrden />} />
                  <Route
                    path="/taller"
                    element={
                      <ProtectedRoute allowedRoles={['admin', 'encargado']} redirectTo="/ordenes">
                        <Taller />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/salida" element={<Salida />} />

                  <Route
                    path="/inicio"
                    element={
                      <ProtectedRoute allowedRoles={['admin', 'encargado', 'mecanico']}>
                        <Inicio />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/admin"
                    element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}
                  >
                    <Route index element={<AdminHub />} />
                    <Route path="reportes" element={<Dashboard />} />
                    <Route path="personal" element={<Admin seccion="personal" />} />
                    <Route path="vehiculos" element={<Admin seccion="vehiculos" />} />
                    <Route path="vehiculos/:placa" element={<VehiculoDetalle />} />
                    <Route path="gastos" element={<Gastos />} />
                    <Route path="historial" element={<Historial />} />
                    <Route path="consulta" element={<VehicleStatus />} />
                  </Route>

                  <Route path="/dashboard" element={<Navigate to="/admin/reportes" replace />} />
                  <Route path="/gastos" element={<Navigate to="/admin/gastos" replace />} />
                  <Route path="/historial" element={<Navigate to="/admin/historial" replace />} />

                  <Route path="/vehiculo" element={<VehicleStatus />} />

                  <Route
                    path="/admin-secreto/bitacora"
                    element={
                      <RutaConsolaSoporte>
                        <SuperAdmin />
                      </RutaConsolaSoporte>
                    }
                  />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </PuertaDeSeguridad>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function PuertaDeSeguridad({ children }) {
  const { currentUser } = useAuth();
  if (currentUser?.debeCambiarPassword) return <CambioPasswordObligatorio />;
  return children;
}
