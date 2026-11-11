import { NavLink, Link, useNavigate } from 'react-router-dom';
// ICONOGRAFÍA DEL MENÚ LATERAL
//    Los ítems de navegación usan los iconos descargados para el taller
//    (PNG de línea en public/iconos) aplicados como máscara CSS: heredan
//    el color de cada ítem y se leen igual en tema claro y oscuro.
//    Los controles de la interfaz (tema, ocultar menú, cerrar sesión)
//    mantienen Lucide, igual que el resto de la aplicación.
import IconoMascara from './IconoMascara';
// Controles de interfaz (no son ítems de navegación)
import {
  TbLogout,
  TbSun,
  TbMoon,
  TbChevronsLeft,
} from '../icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './ToastContext';

export default function Sidebar({
  sidebarOpen,
  closeSidebar,
}) {
  const { currentUser, logout, isAdmin, isEncargado, isMecanico, isSuperAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast, confirm } = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const salir = await confirm({
      title: '¿Cerrar sesión del sistema?',
      message: `¿Estás seguro de que deseas salir del sistema, ${currentUser?.nombre || ''}? Tendrás que ingresar tus credenciales nuevamente para acceder.`,
      confirmText: 'Sí, salir del sistema',
      cancelText: 'Permanecer en el sistema',
      danger: true,
      icon: <TbLogout size={28} />
    });
    if (salir) {
      logout();
      addToast('Sesión finalizada correctamente. ¡Hasta pronto!', 'info');
      navigate('/');
    }
  };

  const roleLabel = isAdmin ? 'ADMINISTRADOR' : isEncargado ? 'ENCARGADO DE TALLER' : isMecanico ? 'MECÁNICO' : 'PERSONAL';
  const roleColor = isAdmin ? 'var(--color-accent)' : isEncargado ? 'var(--color-danger)' : 'var(--brand-gold-dark)';

  return (
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      {/* Cabecera con Logotipo y botón de ocultar */}
      <div className="sidebar-logo">
        <Link to="/inicio" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="sidebar-logo-icon">
            <img src="/logo-sinai.png" alt="Logo Pan Sinaí" />
          </div>
          <div className="sidebar-logo-text">
            <h2>Pan Sinaí</h2>
            <span>Taller</span>
          </div>
        </Link>

        <button
          type="button"
          onClick={closeSidebar}
          className="sidebar-close-btn"
          title="Ocultar menú para más espacio"
          aria-label="Cerrar menú"
        >
          <TbChevronsLeft size={18} />
        </button>
      </div>

      {/* Identificador del Perfil Activo */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--color-border)',
        background: isAdmin ? 'var(--color-accent-light)' : 'rgba(166, 35, 60, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: 0.5 }}>
            Panel de trabajo
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: roleColor }}>
            {isAdmin ? 'Administración' : isEncargado ? 'Encargado de taller' : 'Mecánico'}
          </div>
        </div>

        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--color-finalizado)',
          boxShadow: '0 0 6px var(--color-finalizado)'
        }} title="Sistema en línea" />
      </div>

      {/* Navegación según el ROL del usuario */}
      <nav className="sidebar-nav">

        {/*
VISTA DEL MECÁNICO COMÚN
   Cola de recepción (autoasignarse), sus órdenes asignadas
   y módulo de entrega al conductor
*/}
        {isMecanico && (
          <>
            <div style={{ padding: '8px 8px 4px', fontSize: 9.5, fontWeight: 800, color: 'var(--color-text-muted)', letterSpacing: 0.6 }}>
              Mis unidades de trabajo
            </div>

            {/* Ingreso de vehículo */}
            <NavLink to="/nueva-orden" className={({ isActive }) => `nav-link nav-link-mecanico ${isActive ? 'active' : ''}`}>
              <span className="nav-link-icon" style={{ color: 'var(--brand-green)' }}><IconoMascara src="/iconos/taller-reparacion.png" size={20} /></span>
              <span>Ingreso de Vehículo</span>
            </NavLink>

            {/* No existe "Mis Unidades en Taller": el mecánico trabaja desde sus órdenes,
                tocando la unidad para desplegar actividades y estados */}
            <NavLink to="/ordenes" className={({ isActive }) => `nav-link nav-link-mecanico ${isActive ? 'active' : ''}`}>
              <span className="nav-link-icon" style={{ color: 'var(--brand-gold-dark)' }}><IconoMascara src="/iconos/registro.png" size={20} /></span>
              <span>Mis Órdenes de Trabajo</span>
            </NavLink>

            <NavLink to="/salida" className={({ isActive }) => `nav-link nav-link-mecanico ${isActive ? 'active' : ''}`}>
              <span className="nav-link-icon" style={{ color: 'var(--color-finalizado)' }}><IconoMascara src="/iconos/salida-taller.png" size={20} /></span>
              <span>Entrega de Vehículo</span>
            </NavLink>

            <NavLink to="/vehiculo" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ marginTop: 8 }}>
              <span className="nav-link-icon"><IconoMascara src="/iconos/consultas-taller.png" size={20} /></span>
              <span>Consultar Estado Unidad</span>
            </NavLink>
          </>
        )}

        {/*
VISTA DEL ENCARGADO DE TALLER
   Toda la operación: ingreso, asignación de personal,
   supervisión y entrega. Sin costos ni administración.
*/}
        {isEncargado && !isAdmin && (
          <>
            <div style={{ padding: '8px 8px 4px', fontSize: 9.5, fontWeight: 800, color: 'var(--color-text-muted)', letterSpacing: 0.6 }}>
              Operación del taller
            </div>

            <NavLink to="/nueva-orden" className={({ isActive }) => `nav-link nav-link-mecanico ${isActive ? 'active' : ''}`}>
              <span className="nav-link-icon" style={{ color: 'var(--brand-green)' }}><IconoMascara src="/iconos/taller-reparacion.png" size={20} /></span>
              <span>Ingreso de Vehículo</span>
            </NavLink>

            <NavLink to="/taller" className={({ isActive }) => `nav-link nav-link-mecanico ${isActive ? 'active' : ''}`}>
              <span className="nav-link-icon" style={{ color: 'var(--color-en-proceso)' }}><IconoMascara src="/iconos/personal-taller.png" size={20} /></span>
              <span>Supervisión & Asignación</span>
            </NavLink>

            <NavLink to="/ordenes" className={({ isActive }) => `nav-link nav-link-mecanico ${isActive ? 'active' : ''}`}>
              <span className="nav-link-icon" style={{ color: 'var(--brand-gold-dark)' }}><IconoMascara src="/iconos/registro.png" size={20} /></span>
              <span>Órdenes de Trabajo</span>
            </NavLink>

            <NavLink to="/salida" className={({ isActive }) => `nav-link nav-link-mecanico ${isActive ? 'active' : ''}`}>
              <span className="nav-link-icon" style={{ color: 'var(--color-finalizado)' }}><IconoMascara src="/iconos/salida-taller.png" size={20} /></span>
              <span>Entrega de Vehículos</span>
            </NavLink>

            <NavLink to="/vehiculo" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ marginTop: 8 }}>
              <span className="nav-link-icon"><IconoMascara src="/iconos/consultas-taller.png" size={20} /></span>
              <span>Consultar Estado Unidad</span>
            </NavLink>
          </>
        )}

        {/*
ÁREA DE ADMINISTRACIÓN
   El Panel de Administración agrupa los módulos de administración;
   el menú repite ese acceso y agrega el proceso del taller en orden
   operativo: ingreso, órdenes, supervisión y entrega. */}
        {isAdmin && (
          <>
            {/* Administración */}
            <div style={{ padding: '8px 8px 4px', fontSize: 9.5, fontWeight: 800, color: 'var(--color-accent)', letterSpacing: 0.6 }}>
              Administración
            </div>

            <NavLink to="/admin" end className={({ isActive }) => `nav-link nav-link-admin ${isActive ? 'active' : ''}`}>
              <span className="nav-link-icon"><IconoMascara src="/iconos/administracion.png" size={20} /></span>
              <span>Panel de Administración</span>
            </NavLink>

            {/*
CONSOLA OCULTA — ACCESO DIRECTO
   Sólo la ve la cuenta super administrador: el administrador normal
   no tiene ningún indicio de esta ruta (si la escribe, rebotará). */}
            {isSuperAdmin && (
              <NavLink to="/admin-secreto/bitacora" className={({ isActive }) => `nav-link nav-link-admin ${isActive ? 'active' : ''}`}>
                <span className="nav-link-icon" style={{ color: 'var(--color-text-muted)' }}><IconoMascara src="/iconos/taller.png" size={20} /></span>
                <span>Consola de Soporte</span>
              </NavLink>
            )}

            {/* Los 6 módulos (Reportes, Vehículos, Personal, Gastos,
                Historial y Consulta) NO se listan aquí: el Panel de
                Administración ya los muestra como tarjetas. El proceso del
                taller sí queda en el menú y en este orden: ingreso,
                órdenes, supervisión y entrega. */}

            <div style={{ padding: '12px 8px 4px', fontSize: 9.5, fontWeight: 800, color: 'var(--color-text-muted)', letterSpacing: 0.6, borderTop: '1px solid var(--color-border)', marginTop: 4 }}>
              Proceso de vehículos
            </div>

            {/* El proceso se muestra en orden operativo (ingreso, órdenes,
                supervisión y entrega), sin numeración, para que todos los
                ítems del menú se vean iguales. */}
            <NavLink to="/nueva-orden" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-link-icon" style={{ color: 'var(--brand-green)' }}><IconoMascara src="/iconos/taller-reparacion.png" size={20} /></span>
              <span>Ingreso de vehículos</span>
            </NavLink>

            <NavLink to="/ordenes" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-link-icon" style={{ color: 'var(--brand-gold-dark)' }}><IconoMascara src="/iconos/registro.png" size={20} /></span>
              <span>Órdenes de trabajo</span>
            </NavLink>

            <NavLink to="/taller" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-link-icon" style={{ color: 'var(--color-en-proceso)' }}><IconoMascara src="/iconos/personal-taller.png" size={20} /></span>
              <span>Supervisión de taller</span>
            </NavLink>

            <NavLink to="/salida" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-link-icon" style={{ color: 'var(--color-finalizado)' }}><IconoMascara src="/iconos/salida-taller.png" size={20} /></span>
              <span>Entrega de vehículos</span>
            </NavLink>
          </>
        )}

      </nav>

      {/* Footer del Sidebar: Perfil, Tema y Logout */}
      <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 12px' }}>
        {/* Toggle de tema */}
        <button
          type="button"
          onClick={toggleTheme}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 8px', background: 'transparent',
            border: 'none', cursor: 'pointer',
            fontSize: 11.5, color: 'var(--color-text-muted)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 8,
            transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-bg-card-hover)';
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-muted)';
          }}
        >
          {theme === 'dark' ? <TbSun size={13} style={{ color: 'var(--color-ingresado)', transition: 'transform 0.3s ease' }} /> : <TbMoon size={13} style={{ color: 'var(--color-entregado)', transition: 'transform 0.3s ease' }} />}
          {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
        </button>

        {/* Tarjeta de Usuario */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'var(--color-bg-input)',
          padding: '8px 10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <div style={{
              width: 30, height: 30, borderRadius: 'var(--radius-sm)',
              background: isAdmin ? 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))' : isEncargado ? 'linear-gradient(135deg, var(--brand-red), var(--brand-red-dark))' : 'linear-gradient(135deg, var(--brand-gold), var(--brand-gold-dark))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: 'white', flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
              {currentUser ? currentUser.nombre.slice(0, 2).toUpperCase() : 'PS'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser?.nombre?.split(' ')[0] || 'Usuario'}
              </div>
              <div style={{ fontSize: 9.5, color: roleColor, fontWeight: 700, letterSpacing: 0.3 }}>
                {roleLabel}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title="Cerrar Sesión del Sistema"
            style={{
              width: 30,
              height: 30,
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.28)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              fontSize: 14,
              transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
              e.currentTarget.style.transform = 'scale(1.08)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.25)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <TbLogout />
          </button>
        </div>

      </div>
    </aside>
  );
}
