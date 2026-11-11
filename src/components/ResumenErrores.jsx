import { useEffect, useRef } from 'react';
import { TbAlertTriangle } from '../icons';

/**
 * Resumen de errores AL INICIO del formulario.
 *
 * En cuanto aparece, la página sube hasta aquí y el recuadro toma el foco:
 * el usuario no tiene que bajar buscando qué campo falló. Se usa junto al
 * aviso de toast, que también sale arriba de la pantalla.
 *
 * @param {{errores?: Record<string, string|null|undefined>, titulo?: string}} props
 */
export default function ResumenErrores({ errores, titulo = 'Revisa el formulario antes de continuar' }) {
  const lista = Object.values(errores || {}).filter(Boolean);
  const firma = lista.join('|');
  const ref = useRef(null);

  useEffect(() => {
    if (!firma) return;
    // Scroll instantáneo: el resumen debe verse de inmediato, sin animación.
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo({ top: 0 });
    html.style.scrollBehavior = prev;
    const t = setTimeout(() => {
      if (ref.current && typeof ref.current.focus === 'function') ref.current.focus();
    }, 350);
    return () => clearTimeout(t);
  }, [firma]);

  if (lista.length === 0) return null;

  return (
    <div ref={ref} tabIndex={-1} className="form-error-summary" role="alert">
      <div className="form-error-summary-title">
        <TbAlertTriangle size={15} />
        {titulo}
      </div>
      <ul className="form-error-summary-list">
        {lista.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
