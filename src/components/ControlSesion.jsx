import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastContext';

// Cierre de sesión por inactividad: tras 15 minutos sin ninguna actividad
// (toque, tecla, mouse o scroll) se avisa 1 minuto antes y, si tampoco hay
// respuesta, se cierra la sesión. Cualquier actividad reinicia el conteo.
// NOTA: valores de prueba cortos — RESTAURAR a 15 min / 1 min antes del commit.
const INACTIVIDAD_MS = 15 * 60 * 1000;
const AVISO_MS = 60 * 1000;
const EVENTOS_ACTIVIDAD = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];

export default function ControlSesion() {
  const { currentUser, logout } = useAuth();
  const { addToast } = useToast();

  // Se usan refs para que los listeners no se reenganchen en cada render
  // (logout y addToast pueden cambiar de identidad sin que cambie la sesión).
  const logoutRef = useRef(logout);
  const addToastRef = useRef(addToast);
  useEffect(() => {
    logoutRef.current = logout;
    addToastRef.current = addToast;
  });

  const usuarioId = currentUser?.id;

  useEffect(() => {
    if (!usuarioId) return;

    let avisoTimer = null;
    let cierreTimer = null;

    const limpiar = () => {
      if (avisoTimer) clearTimeout(avisoTimer);
      if (cierreTimer) clearTimeout(cierreTimer);
      avisoTimer = null;
      cierreTimer = null;
    };

    const programar = () => {
      limpiar();
      avisoTimer = setTimeout(() => {
        addToastRef.current(
          'La sesión se cerrará por inactividad en 1 minuto. Mueva el cursor o toque la pantalla para permanecer conectado.',
          'warning',
          10000
        );
        cierreTimer = setTimeout(() => {
          addToastRef.current('Sesión cerrada por inactividad.', 'info');
          logoutRef.current();
        }, AVISO_MS);
      }, INACTIVIDAD_MS - AVISO_MS);
    };

    const actividad = () => programar();

    EVENTOS_ACTIVIDAD.forEach((evento) => {
      window.addEventListener(evento, actividad, { passive: true });
    });
    programar();

    return () => {
      limpiar();
      EVENTOS_ACTIVIDAD.forEach((evento) => {
        window.removeEventListener(evento, actividad);
      });
    };
  }, [usuarioId]);

  return null;
}
