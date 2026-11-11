import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './components/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import CambioPasswordObligatorio from './components/CambioPasswordObligatorio';
import RutaConsolaSoporte from './components/RutaConsolaSoporte';

// Páginas del sistema
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
                {/* Inicio = pantalla de ingreso al sistema */}
                <Route path="/" element={<Login />} />
                <Route path="/login" element={<Navigate to="/" replace />} />

                {/* Panel de Trabajo del Taller (Layout protegido) */}
                <Route element={<Layout />}>
                  {/* Ingreso de unidades: todo el personal que atiende la recepción */}
                  <Route path="/nueva-orden" element={<ProtectedRoute allowedRoles={['admin', 'encargado', 'mecanico']}><NuevaOrden /></ProtectedRoute>} />
                  <Route path="/ordenes" element={<Ordenes />} />
                  <Route path="/ordenes/:id" element={<DetalleOrden />} />
                  {/* Área de reparación: solo encargado y administración.
                      El mecánico no tiene "Mis Unidades en Taller": va directo a sus órdenes */}
                  <Route
                    path="/taller"
                    element={
                      <ProtectedRoute allowedRoles={['admin', 'encargado']} redirectTo="/ordenes">
                        <Taller />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/salida" element={<Salida />} />

                  {/* Inicio: pantalla de bienvenida. Es el punto de partida
                      tras iniciar sesión y a donde regresan los accesos
                      directos que antes iban al taller o al panel. */}
                  <Route
                    path="/inicio"
                    element={
                      <ProtectedRoute allowedRoles={['admin', 'encargado', 'mecanico']}>
                        <Inicio />
                      </ProtectedRoute>
                    }
                  />

                  {/* ÁREA DE ADMINISTRACIÓN — sistema modular
                     Hub de módulos + navegación secundaria */}
                  <Route
                    path="/admin"
                    element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}
                  >
                    <Route index element={<AdminHub />} />
                    <Route path="reportes" element={<Dashboard />} />
                    <Route path="personal" element={<Admin seccion="personal" />} />
                    <Route path="vehiculos" element={<Admin seccion="vehiculos" />} />
                    {/* Ficha completa de una unidad: datos, motorista y sus 4 fotos */}
                    <Route path="vehiculos/:placa" element={<VehiculoDetalle />} />
                    {/* Registro de gastos por vehículo (hoja de cálculo) */}
                    <Route path="gastos" element={<Gastos />} />
                    <Route path="historial" element={<Historial />} />
                    <Route path="consulta" element={<VehicleStatus />} />
                  </Route>

                  {/* Compatibilidad con enlaces antiguos (bookmarks y menús previos) */}
                  <Route path="/dashboard" element={<Navigate to="/admin/reportes" replace />} />
                  <Route path="/gastos" element={<Navigate to="/admin/gastos" replace />} />
                  <Route path="/historial" element={<Navigate to="/admin/historial" replace />} />

                  {/* Consulta de unidad también disponible para encargado y mecánico */}
                  <Route path="/vehiculo" element={<VehicleStatus />} />

                  {/* CONSOLA DE SOPORTE — SUPER ADMINISTRACIÓN
                     Reservada a la cuenta de soporte (superadmin): mientras
                     esa cuenta no exista, el administrador puede abrirla para
                     crearla. Va DENTRO del Layout a propósito: así el menú
                     lateral y la barra superior siguen presentes y la consola
                     se siente parte del sistema, no una pantalla suelta. No
                     aparece en el buscador Ctrl+K. */}
                  <Route
                    path="/admin-secreto/bitacora"
                    element={
                      <RutaConsolaSoporte>
                        <SuperAdmin />
                      </RutaConsolaSoporte>
                    }
                  />
                </Route>

                {/* Redirección por defecto */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </PuertaDeSeguridad>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

/**
 * Mientras la cuenta tenga marcado `debeCambiarPassword` (contraseña
 * reiniciada por el administrador), el sistema queda bloqueado en la pantalla
 * de cambio obligatorio. No se puede navegar a ninguna otra ruta.
 */
function PuertaDeSeguridad({ children }) {
  const { currentUser } = useAuth();
  if (currentUser?.debeCambiarPassword) return <CambioPasswordObligatorio />;
  return children;
}
