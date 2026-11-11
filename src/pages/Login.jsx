import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  TbLock,
  TbEye,
  TbEyeOff,
  TbUser,
  TbArrowRight,
  TbSun,
  TbMoon,
  TbAlertCircle
} from '../icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/ToastContext';

const ANIO_ACTUAL = new Date().getFullYear();

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [recordarme, setRecordarme] = useState(true);
  // Ojo visor de la contraseña: arranca oculto y solo se revela si el usuario
  // lo pide explícitamente (nunca muestra el valor por defecto).
  const [verPassword, setVerPassword] = useState(false);

  const { login, loading, currentUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Todos los roles entran por la misma pantalla de inicio: desde ahí el
  // menú lateral lleva a cada módulo que el rol tenga habilitado.
  const DESTINO_INICIO = '/inicio';

  // Si ya hay sesión iniciada, entrar directo a la pantalla de inicio
  if (currentUser) {
    return <Navigate to={DESTINO_INICIO} replace />;
  }

  // login() es asíncrono: espera a que la base responda antes de validar.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await login(usuario, password);
      addToast(`Bienvenido, ${user.nombre} (${user.rol.toUpperCase()})`, 'success');
      navigate(DESTINO_INICIO);
    } catch (err) {
      setError(err.message || 'Error de credenciales.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated floating orbs background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(134, 153, 46, 0.12) 0%, transparent 70%)',
          top: '10%', left: '-5%', animation: 'floatOrb1 18s ease-in-out infinite',
          filter: 'blur(40px)'
        }} />
        <div style={{
          position: 'absolute', width: 260, height: 260, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(237, 168, 60, 0.10) 0%, transparent 70%)',
          bottom: '5%', right: '-3%', animation: 'floatOrb2 22s ease-in-out infinite',
          filter: 'blur(50px)'
        }} />
        <div style={{
          position: 'absolute', width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(166, 35, 60, 0.07) 0%, transparent 70%)',
          top: '50%', left: '60%', animation: 'floatOrb3 15s ease-in-out infinite',
          filter: 'blur(35px)'
        }} />
        <style>{`
          @keyframes floatOrb1 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(40px, -30px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.95); }
          }
          @keyframes floatOrb2 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(-50px, -40px) scale(1.15); }
          }
          @keyframes floatOrb3 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            40% { transform: translate(30px, 50px) scale(1.08); }
            80% { transform: translate(-40px, -20px) scale(0.92); }
          }
        `}</style>
      </div>

      {/* Barra superior de autenticación */}
      <header style={{
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-glass)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        position: 'relative', zIndex: 2
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="/logo-sinai.png"
            alt="Logo Pan Sinaí"
            style={{
              width: 38,
              height: 38,
              objectFit: 'contain',
              background: '#ffffff',
              borderRadius: 'var(--radius-sm)',
              padding: 2,
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-sm)'
            }}
          />
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.2 }}>Pan Sinaí</div>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>
              Taller
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={toggleTheme}
          title="Alternar modo visual claro / oscuro"
          aria-label="Cambiar tema"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {theme === 'dark' ? <><TbSun size={15} /> Modo Claro</> : <><TbMoon size={15} /> Modo Oscuro</>}
        </button>
      </header>

      {/* Contenido principal centrado */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 16px',
        position: 'relative', zIndex: 1
      }}>
        <div style={{
          width: '100%',
          maxWidth: 440,
          animation: 'slideUp 0.55s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Tarjeta de autenticación empresarial con glassmorphism */}
          <div style={{
            padding: '36px 30px 32px',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-glass-border)',
            boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.04)',
            background: 'var(--color-glass)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Subtle top accent line */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: 'linear-gradient(90deg, var(--brand-green), var(--brand-gold), var(--brand-red))',
              borderRadius: '20px 20px 0 0'
            }} />

            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                width: 68,
                height: 68,
                margin: '0 auto 16px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-accent-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--color-border-active)',
                boxShadow: '0 8px 24px rgba(134, 153, 46, 0.15)',
                animation: 'pulseGlow 3s ease-in-out infinite'
              }}>
                <img
                  src="/logo-sinai.png"
                  alt="Pan Sinaí"
                  style={{ width: 46, height: 46, objectFit: 'contain' }}
                />
              </div>
              <h1 style={{ fontSize: 23, fontWeight: 900, letterSpacing: -0.5, margin: '0 0 6px' }}>
                Acceso al Sistema
              </h1>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                Credenciales de personal autorizado
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" htmlFor="input-usuario" style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Usuario
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="input-usuario"
                    type="text"
                    className="form-input"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    placeholder="Usuario"
                    autoComplete="username"
                    style={{ paddingLeft: 38, width: '100%', boxSizing: 'border-box' }}
                    required
                    autoFocus
                  />
                  <TbUser
                    size={17}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--color-text-muted)',
                      transition: 'color 0.2s ease'
                    }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" htmlFor="input-password" style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="input-password"
                    type={verPassword ? 'text' : 'password'}
                    className="form-input password-field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    style={{ paddingLeft: 38, paddingRight: 44, width: '100%', boxSizing: 'border-box' }}
                    required
                  />
                  <TbLock
                    size={17}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--color-text-muted)'
                    }}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setVerPassword((v) => !v)}
                    title={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={verPassword}
                    aria-controls="input-password"
                  >
                    {verPassword ? <TbEyeOff size={18} /> : <TbEye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 22
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12.5,
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={recordarme}
                    onChange={(e) => setRecordarme(e.target.checked)}
                    style={{ accentColor: 'var(--color-accent)' }}
                  />
                  Recordar sesión
                </label>
              </div>

              {error && (
                <div role="alert" style={{
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12.5,
                  marginBottom: 18,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  animation: 'slideUp 0.3s ease'
                }}>
                  <TbAlertCircle size={17} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  width: '100%',
                  fontWeight: 800,
                  fontSize: 15,
                  padding: '13px 18px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 6px 20px rgba(134, 153, 46, 0.35)'
                }}
                disabled={loading}
              >
                <span>{loading ? 'Validando...' : 'Ingresar al Taller'}</span>
                <TbArrowRight size={17} />
              </button>
            </form>
          </div>

          <div style={{
            textAlign: 'center', marginTop: 20, fontSize: 11,
            color: 'var(--color-text-muted)',
            letterSpacing: 0.3
          }}>
            Pan Sinaí &copy; {ANIO_ACTUAL} • AE PREZA GROUP
          </div>
        </div>
      </main>
    </div>
  );
}
