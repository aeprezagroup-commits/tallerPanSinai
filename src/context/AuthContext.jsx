import { createContext, useContext, useState, useEffect } from 'react';
import { auth, isFirebaseConfigured } from '../firebase/config';
import {
  obtenerUsuarios,
  hidratarUsuarios,
  esperarHidratacionUsuarios,
  cambiarPassword,
} from '../services/usuariosService';
import { hidratarVehiculos, esperarHidratacionVehiculos } from '../services/vehiculosService';
import { verificarPasswordAlmacenada } from '../utils/passwords';
import { cargarCatalogos } from '../services/catalogosService';
import { registrarBitacora, TIPOS_BITACORA } from '../services/bitacoraService';
import { contarSesion } from '../services/metricasService';
import {
  abrirSesionFirebase,
  cerrarSesionFirebase,
  asegurarSesionAnonima,
  guardarUidUsuario,
  sincronizarPasswordFirebase,
} from '../services/authFirebase';

const AuthContext = createContext();

function sinPassword(usuario) {
  if (!usuario) return usuario;
  const { password: _password, ...resto } = usuario;
  return resto;
}

// Sesión guardada en el navegador: sólo identidad (nombre, rol, id), nunca
// la contraseña. La lee la bitácora para saber quién actúa.
function leerSesionLocal() {
  try {
    const crudo = localStorage.getItem('pan_sinai_auth_user');
    if (!crudo) return null;
    const guardado = JSON.parse(crudo);
    return guardado && guardado.id ? guardado : null;
  } catch {
    return null;
  }
}

function paraMostrar(usuario) {
  if (!usuario) return null;
  return sinPassword(usuario.rol === 'recepcion' ? { ...usuario, rol: 'encargado' } : usuario);
}

export function useAuth() {
  return useContext(AuthContext);
}

function PantallaCarga() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#111827',
        color: '#e5e7eb',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        letterSpacing: '0.14em',
      }}
    >
      CARGANDO…
    </div>
  );
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => paraMostrar(leerSesionLocal()));

  const [loading, setLoading] = useState(false);

  // La aplicación espera a que Firebase defina la sesión (restaurada o
  // anónima) antes de mostrar las pantallas: con las reglas de la Fase 2,
  // leer sin sesión abierta devuelve error de permisos.
  const [authListo, setAuthListo] = useState(!isFirebaseConfigured || !auth);

  const [catalogos, setCatalogos] = useState(null);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('pan_sinai_auth_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('pan_sinai_auth_user');
    }
  }, [currentUser]);

  useEffect(() => {
    const refrescarSesion = () => {
      const usuarios = obtenerUsuarios();
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const actualizado = usuarios.find((u) => u.id === prev.id);
        return actualizado ? paraMostrar(actualizado) : null;
      });
    };
    window.addEventListener('pan_sinai_users_updated', refrescarSesion);
    return () => window.removeEventListener('pan_sinai_users_updated', refrescarSesion);
  }, []);

  // Orden de arranque: sesión de Firebase (restaurada o anónima) →
  // hidratación de la base → confirmación del usuario guardado. Recién
  // cuando termina se renderiza la aplicación (authListo).
  useEffect(() => {
    let vivo = true;

    const arrancar = async () => {
      try {
        if (isFirebaseConfigured && auth) {
          const sesionFirebase = await new Promise((resolve) => {
            let unsub = () => {};
            let resuelto = false;
            const fin = (u) => {
              if (resuelto) return;
              resuelto = true;
              unsub();
              resolve(u);
            };
            unsub = auth.onAuthStateChanged(fin);
            setTimeout(() => fin(auth.currentUser), 5000);
          });
          if (!vivo) return;

          // Sin sesión persistida → sesión anónima para poder leer
          // (pantalla de login y página pública /vehiculo).
          if (!sesionFirebase) {
            await asegurarSesionAnonima();
          }
        }

        await Promise.allSettled([
          hidratarUsuarios().then((r) => vivo && console.info('[arranque] usuarios →', r.origen, `${r.total} registro(s)`)),
          hidratarVehiculos().then((r) => vivo && console.info('[arranque] vehículos →', r.origen, `${r.total} registro(s)`)),
          cargarCatalogos()
            .then((r) => vivo && (console.info('[arranque] catálogos →', r.origen), setCatalogos(r)))
            .catch((e) => console.warn('[arranque] catálogos:', e?.message || e)),
        ]);
        if (!vivo) return;

        if (isFirebaseConfigured && auth) {
          const sesionActual = auth.currentUser;
          if (sesionActual && !sesionActual.isAnonymous) {
            const usuarios = obtenerUsuarios();
            const guardado = leerSesionLocal();
            const porUid = usuarios.find((u) => u.uid === sesionActual.uid);
            const coincideLocal = guardado && guardado.uid === sesionActual.uid ? guardado : null;
            // Con la lista cargada se confirma contra ella; sin lista
            // (sin red) se respalda en la sesión local guardada.
            const candidato = porUid || (usuarios.length === 0 ? coincideLocal : null);
            if (candidato && candidato.activo !== false) {
              setCurrentUser(paraMostrar(candidato));
            } else {
              // La cuenta no existe o está inactiva: nada que restaurar.
              await cerrarSesionFirebase();
              if (vivo) setCurrentUser(null);
            }
          } else {
            // Sólo sesión anónima: no hay usuario que restaurar.
            setCurrentUser(null);
          }
        }
      } catch (e) {
        console.warn('[arranque] no se pudo completar la sesión:', e?.message || e);
      } finally {
        if (vivo) setAuthListo(true);
      }
    };

    // Red de seguridad: si el arranque se cuelga, la app se muestra igual.
    const seguridad = setTimeout(() => vivo && setAuthListo(true), 8000);
    arrancar().finally(() => clearTimeout(seguridad));
    return () => {
      vivo = false;
      clearTimeout(seguridad);
    };
  }, []);

  const login = async (identificador, password) => {
    setLoading(true);
    try {
      await esperarHidratacionUsuarios();
      await esperarHidratacionVehiculos();

      const usuarios = obtenerUsuarios();
      const valor = String(identificador || '').trim().toLowerCase();
      const user = usuarios.find(u => {
        const coincideNombre = u.nombre && u.nombre.toLowerCase() === valor;
        const coincideCorreo = u.email && u.email.toLowerCase() === valor;
        return (coincideNombre || coincideCorreo) && verificarPasswordAlmacenada(password, u.password);
      });

      if (!user) {
        throw new Error('Usuario o contraseña incorrectos.');
      }
      if (user.activo === false) {
        throw new Error('Este usuario se encuentra inactivo. Contacte al Administrador.');
      }

      const sesion = await abrirSesionFirebase(user, password);

      // Fase 2: sin cuenta en Firebase Auth las reglas no dejan escribir,
      // así que el login no puede completarse a medias.
      if (isFirebaseConfigured && !sesion.uid) {
        throw new Error(
          sesion.error === 'auth/weak-password'
            ? 'La contraseña necesita 8 caracteres o más para abrir la sesión segura. Reiníciela desde Personal.'
            : 'No se pudo abrir la sesión segura. Contacte con soporte para restablecer la contraseña.'
        );
      }

      const usuarioActivo = sinPassword(sesion.uid ? { ...user, uid: sesion.uid } : user);
      if (sesion.uid && sesion.uid !== user.uid) {
        await guardarUidUsuario(user.id, sesion.uid);
      }

      setCurrentUser(usuarioActivo);
      contarSesion();
      registrarBitacora({
        tipo: TIPOS_BITACORA.SESION,
        accion: 'login',
        detalle: `${user.nombre} inició sesión (${user.rol})`,
        datos: { id: user.id, nombre: user.nombre, rol: user.rol, auth: sesion.origen },
        quien: { usuario: user.nombre, rol: user.rol, id: user.id },
      });
      return usuarioActivo;
    } finally {
      setLoading(false);
    }
  };

  const actualizarPasswordPropia = (nuevaPassword) => {
    if (!currentUser) throw new Error('No hay una sesión activa.');
    const actualizado = cambiarPassword(currentUser.id, nuevaPassword);
    setCurrentUser(paraMostrar(actualizado));
    sincronizarPasswordFirebase(nuevaPassword);
    return sinPassword(actualizado);
  };

  const logout = async () => {
    if (currentUser) {
      registrarBitacora({
        tipo: TIPOS_BITACORA.SESION,
        accion: 'logout',
        detalle: `${currentUser.nombre} cerró sesión`,
        datos: { id: currentUser.id, nombre: currentUser.nombre, rol: currentUser.rol },
        quien: { usuario: currentUser.nombre, rol: currentUser.rol, id: currentUser.id },
      });
      // La pantalla vuelve al login de inmediato…
      setCurrentUser(null);
      // …y se deja salir el evento de bitácora antes de cerrar la sesión.
      await new Promise((r) => setTimeout(r, 400));
    }
    await cerrarSesionFirebase();
    // Sesión anónima otra vez: la pantalla de login vuelve a poder leer.
    await asegurarSesionAnonima();
    setCurrentUser(null);
  };

  const isSuperAdmin = currentUser?.rol === 'superadmin';
  const isAdmin = currentUser?.rol === 'admin' || isSuperAdmin;
  const isEncargado = currentUser?.rol === 'encargado';
  const isMecanico = currentUser?.rol === 'mecanico';

  return (
    <AuthContext.Provider value={{
      currentUser,
      authListo,
      login,
      logout,
      actualizarPasswordPropia,
      isAdmin,
      isEncargado,
      isMecanico,
      isSuperAdmin,
      catalogos,
      loading
    }}>
      {authListo ? children : <PantallaCarga />}
    </AuthContext.Provider>
  );
}
