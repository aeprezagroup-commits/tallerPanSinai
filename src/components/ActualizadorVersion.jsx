import { useEffect, useRef, useState } from 'react';


const INTERVALO_REVISION = 5 * 60 * 1000;
const ESPERA_ENTRE_CHEQUEOS = 60 * 1000;
const AUSENCIA_MINIMA = 2 * 60 * 1000;
const CLAVE_POSICION = 'pan_sinai_posicion';

function buildActual() {
  const etiqueta = document.querySelector('script[src^="/assets/index-"]');
  return etiqueta ? etiqueta.getAttribute('src') : '';
}

async function buildPublicado() {
  try {
    const respuesta = await fetch(`/?revision=${Date.now()}`, { cache: 'no-store' });
    if (!respuesta.ok) return null;
    const html = await respuesta.text();
    const coincidencia = html.match(/assets\/index-[\w-]+\.js/);
    return coincidencia ? `/${coincidencia[0]}` : null;
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

    const revisar = async ({ forzar = false, alVolver = false, simular = false } = {}) => {
      if (enCurso.current) return { ok: false };
      const ahora = Date.now();
      if (!forzar && ahora - ultimoChequeo.current < ESPERA_ENTRE_CHEQUEOS) return { ok: false };

      ultimoChequeo.current = ahora;
      enCurso.current = true;
      setComprobando(true);
      try {
        const actual = buildActual();
        const publicado = simular ? '/index-version-publicada.js' : await buildPublicado();
        const nuevo = Boolean(publicado && actual && publicado !== actual);

        if (!nuevo) return { ok: true, nuevo: false, actual, publicado };

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

    const primerChequeo = window.setTimeout(() => revisar({ forzar: true }), 15000);

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
      <span className="aviso-actualizacion-texto">Nueva versión disponible</span>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={recargarConservandoPosicion}
        disabled={comprobando}
      >
        {comprobando ? 'Verificando...' : 'Actualizar'}
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setHayNueva(false)}
      >
        Ahora no
      </button>
    </div>
  );
}
