import {  } from '../icons';
import { useAuth } from '../context/AuthContext';
import IconoMascara from '../components/IconoMascara';

export default function Inicio() {
  const { currentUser, isAdmin, isEncargado, isMecanico } = useAuth();

  const nombre = currentUser?.nombre?.split(' ')[0] || 'Usuario';
  const rol = isAdmin
    ? 'Administración'
    : isEncargado
      ? 'Encargado de taller'
      : isMecanico
        ? 'Mecánico'
        : 'Personal';

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Inicio</h1>
        <p>Bienvenido, {nombre} — {rol}.</p>
      </div>

      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 12,
          padding: '34px 18px',
          background: 'linear-gradient(135deg, var(--color-accent-light), var(--color-bg-card))',
          border: '1px solid var(--color-border)'
        }}
      >
        <span
          style={{
            width: 64,
            height: 64,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-active)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--color-accent)',
            fontSize: 28,
            boxShadow: '0 4px 16px rgba(134, 153, 46, 0.18)',
            animation: 'pulseGlow 3s ease-in-out infinite'
          }}
        >
          <IconoMascara src="/iconos/taller.png" size={28} />
        </span>

        <h2 className="card-title" style={{ margin: 0, fontSize: 18 }}>
          Sistema Taller Pan Sinaí
        </h2>

        <p
          style={{
            margin: 0,
            maxWidth: 460,
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--color-text-secondary)',
            textTransform: 'none'
          }}
        >
          Selecciona una de las opciones del menú para comenzar.
        </p>
      </div>
    </div>
  );
}
