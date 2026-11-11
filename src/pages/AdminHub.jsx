import BotonVolver from '../components/BotonVolver';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TbArrowRight,
  TbShieldCheck,
} from '../icons';
import IconoMascara from '../components/IconoMascara';
import { useAuth } from '../context/AuthContext';

// ICONOGRAFÍA DEL PANEL
//    Las tarjetas usan los iconos descargados para el taller
//    (PNG de línea en public/iconos) aplicados como máscara CSS: heredan
//    el color de cada módulo y se leen igual en tema claro y oscuro.
//    Las flechas y adornos siguen en Lucide, como el resto de la app.

// Módulos del área de administración — colores usando variables CSS del sistema de diseño
const MODULOS = [
  {
    to: '/admin/reportes',
    icono: <IconoMascara src="/iconos/taller-balances.png" size={26} />,
    titulo: 'Reportes y Métricas',
    desc: 'Costos, productividad y flota.',
    colorVar: 'var(--color-accent)',
    badge: null,
  },
  {
    to: '/admin/vehiculos',
    icono: <IconoMascara src="/iconos/taller-reparacion.png" size={26} />,
    titulo: 'Flota de Vehículos',
    desc: 'Alta, edición, QR y carga CSV.',
    colorVar: 'var(--brand-green)',
    badge: null,
  },
  {
    to: '/admin/personal',
    icono: <IconoMascara src="/iconos/personal-taller.png" size={26} />,
    titulo: 'Personal y Accesos',
    desc: 'Usuarios, roles y accesos.',
    colorVar: '#8b5cf6',
    badge: null,
  },
  {
    to: '/admin/gastos',
    icono: <IconoMascara src="/iconos/llave-inglesa.png" size={26} />,
    titulo: 'Gastos por Vehículo',
    desc: 'Facturas, vales y centros de costo.',
    colorVar: 'var(--brand-gold-dark)',
    badge: null,
  },
  {
    to: '/admin/historial',
    icono: <IconoMascara src="/iconos/historial.png" size={26} />,
    titulo: 'Historial y Auditoría',
    desc: 'Órdenes, expedientes y auditoría.',
    colorVar: '#06b6d4',
    badge: null,
  },
  {
    to: '/admin/consulta',
    icono: <IconoMascara src="/iconos/consultas-taller.png" size={26} />,
    titulo: 'Consulta de Unidad',
    desc: 'Estado de la unidad por placa, QR o VIN.',
    colorVar: 'var(--brand-red)',
    badge: null,
  },
];

/*
MÓDULO OCULTO — CONSOLA DE SOPORTE (/admin-secreto/bitacora)
   Aparece en el panel ÚNICAMENTE cuando la sesión es la cuenta super
   administrador: es el acceso directo a la consola, para no tener que
   escribir la ruta a mano. Un administrador normal nunca ve esta tarjeta
   y la ruta lo rebotaría a /admin. */
const MODULO_SOPORTE = {
  to: '/admin-secreto/bitacora',
  icono: <IconoMascara src="/iconos/taller.png" size={26} />,
  titulo: 'Consola de Soporte',
  desc: 'Bitácora, catálogos y mantenimiento del sistema.',
  colorVar: 'var(--color-text-muted)',
  badge: 'OCULTO',
  reservado: true,
};

export default function AdminHub() {
  const { currentUser, isSuperAdmin } = useAuth();
  const [hoveredCard, setHoveredCard] = useState(null);

  // Los 6 módulos visibles para todo administrador + la consola reservada
  // al super administrador, si esa es la cuenta que abrió sesión.
  const modulos = isSuperAdmin ? [...MODULOS, MODULO_SOPORTE] : MODULOS;

  return (
    <div className="animate-fade-in">
      {/* Encabezado con bienvenida personalizada */}
      <div className="page-header">
        <BotonVolver a="/inicio" etiqueta="Volver al Inicio" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            width: 48, height: 48, borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent-light)',
            border: '1px solid var(--color-border-active)',
            display: 'grid', placeItems: 'center',
            color: 'var(--color-accent)', fontSize: 24,
            boxShadow: '0 4px 12px rgba(134, 153, 46, 0.15)',
            animation: 'pulseGlow 3s ease-in-out infinite'
          }}>
            <TbShieldCheck />
          </span>
          <div>
            <h1 style={{ marginBottom: 2 }}>Panel de Administración</h1>
            <p style={{ margin: 0 }}>
              Bienvenido, <strong>{currentUser?.nombre?.split(' ')[0] || 'Administrador'}</strong>
              
            </p>
          </div>
        </div>
      </div>

      {/* Módulos de Administración */}
      <div style={{ marginBottom: 8 }}>
        <div style={{
          fontSize: 9.5, fontWeight: 800, color: 'var(--color-text-muted)',
          textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <span style={{ flex: 1, height: 1, background: 'var(--color-border)', display: 'inline-block' }} />
          MÓDULOS DE ADMINISTRACIÓN
          <span style={{ flex: 1, height: 1, background: 'var(--color-border)', display: 'inline-block' }} />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
          gap: 14,
        }}>
          {modulos.map((m, idx) => (
            <Link
              key={m.to}
              to={m.to}
              className="card admin-modulo-card"
              onMouseEnter={() => setHoveredCard(m.to)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                borderLeft: m.reservado
                  ? '3px dashed var(--color-text-muted)'
                  : `3px solid ${m.colorVar}`,
                outline: m.reservado ? '1px dashed var(--color-border-active)' : 'none',
                transition: 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s ease',
                transform: hoveredCard === m.to ? 'translateY(-3px)' : 'translateY(0)',
                boxShadow: hoveredCard === m.to ? '0 10px 24px rgba(0, 0, 0, 0.10)' : 'none',
                animation: `staggerCardIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) ${0.04 * idx}s backwards`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    width: 46,
                    height: 46,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 'var(--radius-sm)',
                    background: m.reservado
                      ? 'var(--color-bg-card-hover)'
                      : `color-mix(in srgb, ${m.colorVar} 15%, transparent)`,
                    color: m.colorVar,
                    fontSize: 22,
                    border: m.reservado
                      ? '1px dashed var(--color-border-active)'
                      : `1px solid color-mix(in srgb, ${m.colorVar} 25%, transparent)`,
                    flexShrink: 0,
                    transition: 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease',
                    transform: hoveredCard === m.to ? 'scale(1.06)' : 'scale(1)',
                    boxShadow: hoveredCard === m.to ? `0 4px 16px color-mix(in srgb, ${m.colorVar} 30%, transparent)` : 'none',
                  }}
                >
                  {m.icono}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {m.badge && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: 1,
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--color-bg-card-hover)',
                      color: 'var(--color-text-muted)',
                      border: '1px dashed var(--color-border-active)',
                    }}>
                      {m.badge}
                    </span>
                  )}
                  <TbArrowRight
                    style={{
                      color: hoveredCard === m.to ? m.colorVar : 'var(--color-text-muted)',
                      fontSize: 18,
                      transition: 'color 0.25s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease',
                      transform: hoveredCard === m.to ? 'translateX(4px)' : 'translateX(0)',
                      opacity: hoveredCard === m.to ? 1 : 0.5,
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, marginBottom: 4 }}>
                  {m.titulo}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.6,
                  }}
                >
                  {m.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
