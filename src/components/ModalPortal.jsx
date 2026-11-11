import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * ModalPortal: Renderiza cualquier modal directamente en document.body
 * para evitar que quede atrapado en el stacking context de la topbar o del layout.
 * Además, bloquea el scroll de la página de fondo mientras el modal está activo.
 */
export default function ModalPortal({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

