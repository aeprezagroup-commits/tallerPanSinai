import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export const AVISO_DATOS_SIN_GUARDAR =
  'Hay datos sin guardar. Si sale, se perderá lo escrito. ¿Salir?';

export default function useDatosSinGuardar(activo, confirmar, mensaje) {
  const navigate = useNavigate();
  const texto = mensaje || AVISO_DATOS_SIN_GUARDAR;
  const confirmarRef = useRef(confirmar);
  useEffect(() => {
    confirmarRef.current = confirmar;
  }, [confirmar]);

  useEffect(() => {
    if (!activo) return undefined;

    window.__formulariosSucios = (window.__formulariosSucios || 0) + 1;

    const avisarAlNavegador = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const alHacerClic = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const enlace = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!enlace || enlace.target === '_blank' || enlace.hasAttribute('download')) return;
      const href = (enlace.getAttribute('href') || '').trim();
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      let destino;
      try {
        destino = new URL(enlace.href, window.location.href);
      } catch {
        return;
      }
      if (destino.origin !== window.location.origin) return;
      if (destino.pathname + destino.search === window.location.pathname + window.location.search) return;

      e.preventDefault();
      e.stopPropagation();

      const ir = () => navigate(destino.pathname + destino.search + destino.hash);
      const confirmar = confirmarRef.current;
      if (typeof confirmar === 'function') {
        confirmar({
          title: '¿Salir?',
          message: texto,
          confirmText: 'Sí, salir',
          cancelText: 'Seguir aquí',
        })
          .then(ok => { if (ok) ir(); })
          .catch(() => {});
      } else if (window.confirm(texto)) {
        ir();
      }
    };

    window.addEventListener('beforeunload', avisarAlNavegador);
    document.addEventListener('click', alHacerClic, true);
    return () => {
      window.__formulariosSucios = Math.max(0, (window.__formulariosSucios || 1) - 1);
      window.removeEventListener('beforeunload', avisarAlNavegador);
      document.removeEventListener('click', alHacerClic, true);
    };
  }, [activo, texto, navigate]);
}
