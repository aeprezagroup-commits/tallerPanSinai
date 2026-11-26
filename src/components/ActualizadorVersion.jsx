import { useEffect, useRef, useState } from 'react';
import { TbRefresh } from 'react-icons/tb';

const BUILD_LOCAL = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';
const INTERVALO_REVISION = 3 * 60 * 1000;
const ESPERA_ENTRE_CHEQUEOS = 45 * 1000;
const AUSENCIA_MINIMA = 2 * 60 * 1000;
const CLAVE_POSICION = 'pan_sinai_posicion';

async function obtenerBuildPublicado() {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const datos = await r.json();
    return datos.buildDate || null;
  } catch {
    return null;
  }
}

function hayDatosSinGuardar() {
  return (window.__formulariosSucios || 0) > 0;
}

function hayModalAbierto() {
  return Boolean(document.querySelector('.modal-overlay, .modal-backdrop, [role="dialog"]'));
}

function recargarConservandoPosicion() {
  try {
    sessionStorage.setItem(
      CLAVE_POSICION,
      JSON.stringify({ ruta: window.location.pathname, y: window.scrollY }),
    );
  } catch {
  }
  window.__recargaVersion = true;
  window.location.reload();
}

export default function ActualizadorVersion() {
  const [hayNueva, setHayNueva] = useState(false);
  const [comprobando, setComprobando] = useState(false);
  const ultimoChequeo = useRef(0);
  const ausenteDesde = useRef(0);
  const enCurso = useRef(false);

  useEffect(() => {
    ausenteDesde.current = Date.now();
    try {
      const guardada = JSON.parse(sessionStorage.getItem(CLAVE_POSICION) || 'null');
      sessionStorage.removeItem(CLAVE_POSICION);
      if (guardada && guardada.ruta === window.location.pathname) {
        requestAnimationFrame(() => window.scrollTo(0, guardada.y));
      }
    } catch {
    }

    const revisar = async ({ forzar = false, alVolver = false } = {}) => {
      if (enCurso.current) return { ok: false };
      const ahora = Date.now();
      if (!forzar && ahora - ultimoChequeo.current < ESPERA_ENTRE_CHEQUEOS) return { ok: false };

      ultimoChequeo.current = ahora;
      enCurso.current = true;
      setComprobando(true);
      try {
        const publicado = await obtenerBuildPublicado();
        const nuevo = Boolean(publicado && BUILD_LOCAL && publicado !== BUILD_LOCAL);

        if (!nuevo) return { ok: true, nuevo: false };

        if (alVolver && !hayDatosSinGuardar() && !hayModalAbierto()) {
          recargarConservandoPosicion();
          return { ok: true, nuevo: true, recargando: true };
        }

        setHayNueva(true);
        return { ok: true, nuevo: true, recargando: false };
      } catch {
        return { ok: false };
      } finally {
        enCurso.current = false;
        setComprobando(false);
      }
    };

    const ausenciaSuperada = () => Date.now() - ausenteDesde.current >= AUSENCIA_MINIMA;

    const alVolverDeAusencia = () => {
      const largo = ausenciaSuperada();
      revisar({ forzar: largo, alVolver: largo });
    };

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'hidden') {
        ausenteDesde.current = Date.now();
        return;
      }
      alVolverDeAusencia();
    };

    const alRestaurar = (evento) => {
      if (evento.persisted) revisar({ forzar: true, alVolver: true });
    };

    const reloj = window.setInterval(() => {
      if (document.visibilityState === 'visible') revisar({});
    }, INTERVALO_REVISION);

    const primerChequeo = window.setTimeout(() => revisar({ forzar: true }), 12000);

    const alPerderFoco = () => { ausenteDesde.current = Date.now(); };

    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    window.addEventListener('pageshow', alRestaurar);
    window.addEventListener('blur', alPerderFoco);
    window.addEventListener('focus', alVolverDeAusencia);

    window.__chequearActualizacion = revisar;

    return () => {
      window.clearInterval(reloj);
      window.clearTimeout(primerChequeo);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      window.removeEventListener('pageshow', alRestaurar);
      window.removeEventListener('blur', alPerderFoco);
      window.removeEventListener('focus', alVolverDeAusencia);
      delete window.__chequearActualizacion;
    };
  }, []);

  if (!hayNueva) return null;

  return (
    <div className="aviso-actualizacion" role="status">
      <div className="aviso-actualizacion-icono">
        <TbRefresh size={22} />
      </div>
      <div className="aviso-actualizacion-contenido">
        <span className="aviso-actualizacion-titulo">Nueva versión disponible</span>
        <span className="aviso-actualizacion-detalle">
          Actualice para obtener las últimas mejoras
        </span>
      </div>
      <div className="aviso-actualizacion-acciones">
        <button
          type="button"
          className="aviso-actualizacion-btn aviso-btn-actualizar"
          onClick={recargarConservandoPosicion}
          disabled={comprobando}
        >
          {comprobando ? 'Verificando…' : 'Actualizar ahora'}
        </button>
        <button
          type="button"
          className="aviso-actualizacion-btn aviso-btn-cerrar"
          onClick={() => setHayNueva(false)}
        >
          Después
        </button>
      </div>
    </div>
  );
}
