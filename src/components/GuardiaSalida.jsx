import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastContext';

const RUTAS_PROTEGIDAS = [
  /^\/admin\/historial$/,
  /^\/ordenes\/[^/]+$/,
  /^\/admin\/vehiculos\/[^/]+$/
];

export default function GuardiaSalida() {
  const { currentUser } = useAuth();
  const { confirm } = useToast();
  const location = useLocation();

  const ignorarPopsRef = useRef(false);
  const dialogoAbiertoRef = useRef(false);
  const ultimoIdxRef = useRef(null);
  const confirmRef = useRef(confirm);
  useEffect(() => {
    confirmRef.current = confirm;
  });

  const usuarioId = currentUser?.id;
  const esProtegida = RUTAS_PROTEGIDAS.some((rx) => rx.test(location.pathname));

  useEffect(() => {
    if (!usuarioId) return;
    const avisarAlNavegador = (e) => {
      if (window.__recargaVersion) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', avisarAlNavegador);
    return () => window.removeEventListener('beforeunload', avisarAlNavegador);
  }, [usuarioId]);

  useEffect(() => {
    if (ultimoIdxRef.current === null) {
      ultimoIdxRef.current = window.history.state?.idx ?? 0;
    }
  }, [usuarioId]);

  useEffect(() => {
    if (!usuarioId || !esProtegida) return;
    if (window.history.state?.__protegidoSalida) return;
    try {
      window.history.pushState(
        { ...(window.history.state || {}), __protegidoSalida: true },
        '',
        window.location.href
      );
      ultimoIdxRef.current = window.history.state?.idx ?? ultimoIdxRef.current;
    } catch {
    }
  }, [usuarioId, esProtegida, location.pathname, location.key]);

  useEffect(() => {
    if (!usuarioId) return;

    const onPop = async (e) => {
      const idx = e.state?.idx ?? 0;
      const haciaAdelante = ultimoIdxRef.current !== null && idx > ultimoIdxRef.current;
      ultimoIdxRef.current = idx;

      if (ignorarPopsRef.current) {
        ignorarPopsRef.current = false;
        return;
      }
      if (e.state?.__protegidoSalida) return;
      if (haciaAdelante) return;
      if (dialogoAbiertoRef.current) return;
      if (!RUTAS_PROTEGIDAS.some((rx) => rx.test(window.location.pathname))) return;

      dialogoAbiertoRef.current = true;
      const salir = await confirmRef.current({
        title: '¿Salir sin guardar?',
        message:
          'Está por salir sin guardar. Si continúa, se perderán los cambios.',
        confirmText: 'Sí, salir',
        cancelText: 'Permanecer aquí',
        danger: true
      });
      dialogoAbiertoRef.current = false;

      ignorarPopsRef.current = true;
      const idxEnPregunta = idx;
      if (salir) {
        window.history.go(-1);
        setTimeout(() => {
          if ((window.history.state?.idx ?? 0) === idxEnPregunta) {
            ignorarPopsRef.current = false;
          }
        }, 300);
      } else {
        window.history.go(1);
      }
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [usuarioId]);

  return null;
}
