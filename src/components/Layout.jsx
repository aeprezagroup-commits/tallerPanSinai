import { useState, useEffect } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  TbMenu,
  TbSun,
  TbMoon,
  TbCpu,
  TbShieldCheck,
  TbTools,
  TbLogout
} from '../icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './ToastContext';
import CommandPalette from './CommandPalette';
import Sidebar from './Sidebar';


export default function Layout() {
  // Inicialización inteligente: en dispositivos móviles (< 768px) inicia cerrado;
  // en tablets, laptops y pantallas de escritorio inicia abierto de forma ensamblada
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 768) return false;
      const saved = localStorage.getItem('pan_sinai_sidebar_open');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });

  const location = useLocation();

  // Cambio de pantalla: se vuelve al inicio de la página. Sin esto, el scroll
  // de la vista anterior queda guardado y el encabezado de la nueva pantalla
  // arranca debajo de la barra superior pegajosa.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { currentUser, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast, confirm } = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const salir = await confirm({
      title: '¿Cerrar sesión del sistema?',
      message: `¿Estás seguro de que deseas salir del sistema, ${currentUser?.nombre || ''}?`,
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
      // Cerrar sidebar con Escape
      if (e.key === 'Escape') {
        setSidebarOpen(prev => {
          if (prev) {
            if (typeof window !== 'undefined' && window.innerWidth >= 768) {
              localStorage.setItem('pan_sinai_sidebar_open', JSON.stringify(false));
            }
            return false;
          }
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  const toggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        localStorage.setItem('pan_sinai_sidebar_open', JSON.stringify(next));
      }
      return next;
    });
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      localStorage.setItem('pan_sinai_sidebar_open', JSON.stringify(false));
    }
  };

  // Sin sesión iniciada no se accede al panel de trabajo del taller
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app-layout">
      {/* Overlay oscuro para pantallas pequeñas / móviles */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={closeSidebar}
      />

      {/* Sidebar con animación de entrada / salida */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        closeSidebar={closeSidebar}
      />

      {/* Contenido Principal con adaptación de margen dinámica */}
      <main className={`main-content ${sidebarOpen ? 'sidebar-visible' : 'sidebar-collapsed'}`}>
        {/* Top Bar Enterprise unificado y responsivo */}
        <header className="enterprise-topbar">
          <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Botón para ocultar / mostrar menú */}
            <button
              type="button"
              className="topbar-sidebar-toggle-btn"
              onClick={toggleSidebar}
              title={sidebarOpen ? "Ocultar menú lateral (pantalla completa)" : "Mostrar menú lateral"}
              aria-label="Alternar menú lateral"
            >
              <TbMenu size={17} />
            </button>
          </div>

          {/* Indicador de Módulo Actual */}
          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.5,
              padding: '4px 12px',
              borderRadius: 'var(--radius-sm)',
              background: isAdmin ? 'var(--color-accent-light)' : 'rgba(134,153,46,0.14)',
              color: 'var(--color-accent)',
              border: `1px solid ${isAdmin ? 'rgba(134, 153, 46, 0.35)' : 'rgba(134,153,46,0.35)'}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}>
              {isAdmin ? (
                <><TbShieldCheck style={{ marginRight: 4 }} />CONSOLA ADMINISTRACIÓN GENERAL</>
              ) : (
                <><TbTools style={{ marginRight: 4 }} />MÓDULO MECÁNICOS / TÉCNICOS</>
              )}
            </span>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="topbar-icon-btn"
              onClick={toggleTheme}
              title="Cambiar tema"
              style={{ transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              {theme === 'dark' ? <TbSun /> : <TbMoon />}
            </button>

            <button
              type="button"
              className="topbar-icon-btn hide-on-phone"
              onClick={() => setCommandPaletteOpen(true)}
              title="Centro de Comandos (Ctrl + K)"
              style={{ transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              <TbCpu />
            </button>

            {/* Chip del Operador Logueado */}
            <div className="topbar-operator-chip" title={`Usuario activo: ${currentUser?.nombre || 'Personal'}`}
              style={{ transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              <div
                className="chip-avatar"
                style={{
                  background: isAdmin ? 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))' : 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              >
                {currentUser ? currentUser.nombre.slice(0, 2).toUpperCase() : 'PS'}
              </div>
              <div className="chip-meta">
                <span className="chip-name">{currentUser?.nombre?.split(' ')[0] || 'Operador'}</span>
                <span className="chip-role" style={{ color: 'var(--color-accent)' }}>
                  {currentUser?.rol?.toUpperCase() || 'PERSONAL'}
                </span>
              </div>
            </div>

            {/* Botón Salir del Sistema en Topbar */}
            <button
              type="button"
              className="topbar-icon-btn"
              onClick={handleLogout}
              title="Cerrar sesión / Salir del sistema"
              style={{
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                e.currentTarget.style.transform = 'scale(1.06)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.25)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <TbLogout size={16} />
            </button>


          </div>
        </header>

        <div className="page-body-container">
          <div key={location.pathname} className="route-transition-wrapper">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Global Command Palette Spotlight */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

    </div>
  );
}
