import { useEffect, useRef } from 'react';
import { TbAlertTriangle } from '../icons';

export default function ResumenErrores({ errores, titulo = 'Revisa el formulario antes de continuar' }) {
  const lista = Object.values(errores || {}).filter(Boolean);
  const firma = lista.join('|');
  const ref = useRef(null);

  useEffect(() => {
    if (!firma) return;
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
