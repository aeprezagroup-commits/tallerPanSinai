import { useState } from 'react';

const PREFIJO = 'pan_sinai_vista_';

/**
 * Recuerda la vista elegida por el usuario (fila/cuadrícula o tabla/cuadrícula)
 * por cada pantalla. Solo se guarda cuando el usuario elige una vista, para que
 * la primera visita respete el valor por defecto (que puede depender del ancho
 * de la pantalla).
 *
 * @param {string} clave Identificador único de la pantalla (ej. 'taller').
 * @param {string|(() => string)} defecto Valor inicial si no hay elección previa.
 * @returns {[string, (vista: string) => void]} Estado y setter que persiste.
 */
export default function useVistaGuardada(clave, defecto) {
  const [vista, setVistaEstado] = useState(() => {
    try {
      const guardada = localStorage.getItem(PREFIJO + clave);
      if (guardada) return guardada;
    } catch (err) {
      console.warn('No se pudo leer la vista guardada:', err);
    }
    return typeof defecto === 'function' ? defecto() : defecto;
  });

  const setVista = (siguiente) => {
    const valor = typeof siguiente === 'function' ? siguiente(vista) : siguiente;
    setVistaEstado(valor);
    try {
      localStorage.setItem(PREFIJO + clave, String(valor));
    } catch (err) {
      console.warn('No se pudo guardar la vista elegida:', err);
    }
  };

  return [vista, setVista];
}
