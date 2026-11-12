import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastContext';

// Pantallas cuyo abandono por retroceso pide confirmación: informes y
// detalles donde el usuario puede estar revisando algo importante.
const RUTAS_PROTEGIDAS = [
  /^\/admin\/historial$/,
  /^\/ordenes\/[^/]+$/,
  /^\/admin\/vehiculos\/[^/]+$/
];

/**
 * Protección contra salidas accidentales:
 *
 * 1) Al entrar a una pantalla protegida se duplica la entrada del historial.
 *    El primer retroceso cae en el duplicado (misma pantalla) y de ahí se
 *    pregunta: "¿abandonar?" — si dice que no, se regresa al duplicado; si
 *    dice que sí, se da un retroceso más hasta la pantalla anterior.
 * 2) Mientras hay sesión iniciada, beforeunload muestra el diálogo nativo del
 *    navegador al cerrar la pestaña, recargar o abandonar el sitio.
 */
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

  // (2) Salida del sistema: el navegador pide confirmación nativa.
  useEffect(() => {
    if (!usuarioId) return;
    const avisarAlNavegador = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', avisarAlNavegador);
    return () => window.removeEventListener('beforeunload', avisarAlNavegador);
  }, [usuarioId]);

  // Estado inicial del índice de historial (para distinguir retroceso de avance).
  useEffect(() => {
    if (ultimoIdxRef.current === null) {
      ultimoIdxRef.current = window.history.state?.idx ?? 0;
    }
  }, [usuarioId]);

  // (1) Duplicado de la entrada al entrar a una pantalla protegida.
  useEffect(() => {
    if (!usuarioId || !esProtegida) return;
    if (window.history.state?.__protegidoSalida) return;
    try {
      // Se conserva el estado del router (usr/key/idx) y sólo se agrega la
      // marca: así React Router sigue calculando bien sus saltos.
      window.history.pushState(
        { ...(window.history.state || {}), __protegidoSalida: true },
        '',
        window.location.href
      );
      ultimoIdxRef.current = window.history.state?.idx ?? ultimoIdxRef.current;
    } catch {
      // Sin historial que duplicar (modo privado/restricciones): se omite.
    }
  }, [usuarioId, esProtegida, location.pathname, location.key]);

  // Escucha del retroceso.
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
      // Retroceso dentro de nuestro propio duplicado: seguimos en la misma pantalla.
      if (e.state?.__protegidoSalida) return;
      // Avance (forward): entrar a una pantalla no pide nada.
      if (haciaAdelante) return;
      // Ya hay una pregunta en pantalla; los retrocesos extra se ignoran.
      if (dialogoAbiertoRef.current) return;
      // Navegación interna normal entre pantallas sin importancia.
      if (!RUTAS_PROTEGIDAS.some((rx) => rx.test(window.location.pathname))) return;

      dialogoAbiertoRef.current = true;
      const salir = await confirmRef.current({
        title: '¿Abandonar esta pantalla?',
        message:
          'Está por salir de un informe o detalle. Si continúa, se perderá el lugar que estaba revisando.',
        confirmText: 'Sí, salir',
        cancelText: 'Permanecer aquí',
        danger: true
      });
      dialogoAbiertoRef.current = false;

      ignorarPopsRef.current = true;
      const idxEnPregunta = idx;
      if (salir) {
        // Confirmado: retroceso real hasta la pantalla anterior.
        window.history.go(-1);
        // Si no hay entrada previa (pantalla inicial del sitio), go(-1) no
        // mueve nada: se libera la bandera para no comerse el próximo pop.
        setTimeout(() => {
          if ((window.history.state?.idx ?? 0) === idxEnPregunta) {
            ignorarPopsRef.current = false;
          }
        }, 300);
      } else {
        // Se queda: regreso al duplicado de esta misma pantalla.
        window.history.go(1);
      }
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [usuarioId]);

  return null;
}
