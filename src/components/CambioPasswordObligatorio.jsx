import { useState } from 'react';
import {
  TbLock, TbShieldCheck, TbAlertCircle, TbLogout, TbCircleCheck
} from '../icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastContext';
import { validarPassword, PASSWORD_MINIMA } from '../utils/passwords';

export default function CambioPasswordObligatorio() {
  const { currentUser, actualizarPasswordPropia, logout } = useAuth();
  const { addToast } = useToast();

  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const reglas = [
    { ok: nueva.length >= PASSWORD_MINIMA, texto: `Al menos ${PASSWORD_MINIMA} caracteres` },
    { ok: /[A-ZÁÉÍÓÚÑÜ]/.test(nueva), texto: 'Al menos una letra mayúscula' },
    { ok: /[^A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü]/.test(nueva), texto: 'Al menos un carácter especial (! # $ % *)' },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const problema = validarPassword(nueva);
    if (problema) {
      setError(problema);
      return;
    }
    if (nueva !== confirmar) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setGuardando(true);
    try {
      actualizarPasswordPropia(nueva);
      addToast('Contraseña actualizada. Ya puedes usar el sistema.', 'success');
    } catch (err) {
      setError(err.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 470,
        padding: '32px 28px',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-glass-border)',
        background: 'var(--color-glass)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.25)',
        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 46,
            height: 46,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent-light)',
            border: '1px solid var(--color-border-active)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <TbShieldCheck size={24} style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 18.5, fontWeight: 900, margin: 0, letterSpacing: -0.3 }}>
              Cambio de contraseña obligatorio
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
              {currentUser?.nombre || 'Usuario'}
            </p>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 18px', lineHeight: 1.55 }}>
          Tu contraseña fue reiniciada por la administración. Antes de continuar debes
          definir una contraseña nueva y personal.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label" htmlFor="nueva-password">
              Contraseña nueva
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="nueva-password"
                type="password"
                className="form-input"
                value={nueva}
                onChange={(e) => { setNueva(e.target.value); setError(''); }}
                placeholder="••••••••"
                autoComplete="new-password"
                style={{ paddingLeft: 38, width: '100%', boxSizing: 'border-box' }}
                autoFocus
                required
              />
              <TbLock size={17} style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--color-text-muted)'
              }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label" htmlFor="confirmar-password">
              Repetir contraseña nueva
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="confirmar-password"
                type="password"
                className="form-input"
                value={confirmar}
                onChange={(e) => { setConfirmar(e.target.value); setError(''); }}
                placeholder="••••••••"
                autoComplete="new-password"
                style={{ paddingLeft: 38, width: '100%', boxSizing: 'border-box' }}
                required
              />
              <TbLock size={17} style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--color-text-muted)'
              }} />
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg-input)',
            border: '1px solid var(--color-border)',
            marginBottom: 16
          }}>
            {reglas.map((r) => (
              <span key={r.texto} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12,
                color: r.ok ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontWeight: r.ok ? 700 : 500
              }}>
                {r.ok ? <TbCircleCheck size={14} /> : <TbAlertCircle size={14} />}
                {r.texto}
              </span>
            ))}
          </div>

          {error && (
            <div role="alert" style={{
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.10)',
              border: '1px solid rgba(239, 68, 68, 0.30)',
              color: '#ef4444',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12.5,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <TbAlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', fontWeight: 800, padding: '12px 18px' }}
            disabled={guardando}
          >
            {guardando ? 'Guardando...' : 'Guardar contraseña nueva'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: 10 }}
            onClick={logout}
          >
            <TbLogout /> Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
