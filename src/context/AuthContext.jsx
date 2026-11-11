import { createContext, useContext, useState, useEffect } from 'react';
import {
  obtenerUsuarios,
  hidratarUsuarios,
  esperarHidratacionUsuarios,
  cambiarPassword,
} from '../services/usuariosService';
import { hidratarVehiculos, esperarHidratacionVehiculos } from '../services/vehiculosService';
import { cargarCatalogos } from '../services/catalogosService';
import { registrarBitacora, TIPOS_BITACORA } from '../services/bitacoraService';
import { contarSesion } from '../services/metricasService';
import {
  abrirSesionFirebase,
  cerrarSesionFirebase,
  guardarUidUsuario,
  sincronizarPasswordFirebase,
} from '../services/authFirebase';

const AuthContext = createContext();

/**
 * La sesión NUNCA guarda la contraseña: ni en memoria ni en localStorage.
 * Se elimina también de las sesiones antiguas que ya la tuvieran guardada.
 */
function sinPassword(usuario) {
  if (!usuario) return usuario;
  const { password: _password, ...resto } = usuario;
  return resto;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  // Cargar sesión guardada; si no hay, se exige iniciar sesión
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('pan_sinai_auth_user');
    if (saved) {
      try {
        const user = JSON.parse(saved);
        if (user && user.id) {
          // Migración de sesiones guardadas con el rol antiguo 'recepcion'
          if (user.rol === 'recepcion') user.rol = 'encargado';
          return sinPassword(user);
        }
      } catch {
        return null;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(false);

  // Catálogos editables (rutas, áreas y tareas). Cuando llegan desde
  // Firestore se guarda aquí el estado: además de informarlo en el contexto,
  // el cambio de estado vuelve a renderizar la app para que los desplegables
  // muestren el catálogo guardado por el super admin.
  const [catalogos, setCatalogos] = useState(null);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('pan_sinai_auth_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('pan_sinai_auth_user');
    }
  }, [currentUser]);

  // La SESIÓN ACTIVA es una copia de los datos del usuario en el momento en
  // que se entra. Si después se edita o se elimina a esa persona (mismo
  // evento que ya usan Administración, Historial, Gastos y Taller), la sesión
  // se refresca con los datos nuevos.
  // Sin esto, cambiar el nombre propio no se reflejaba en el menú lateral y
  // al volver a entrar seguía pidiendo el nombre anterior.
  useEffect(() => {
    const refrescarSesion = () => {
      const usuarios = obtenerUsuarios();
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const actualizado = usuarios.find((u) => u.id === prev.id);
        // Si la persona de la sesión fue eliminada del personal, se cierra
        return actualizado ? sinPassword({ ...actualizado }) : null;
      });
    };
    window.addEventListener('pan_sinai_users_updated', refrescarSesion);
    return () => window.removeEventListener('pan_sinai_users_updated', refrescarSesion);
  }, []);

  // HIDRATACIÓN DESDE FIRESTORE (fase de arranque)
  // Mientras llega, la app ya funciona con el espejo local; cuando Firestore
  // responde, los datos se refrescan en pantalla mediante el evento.
  // No bloquea el render ni lanza errores hacia la interfaz.
  useEffect(() => {
    let vivo = true;
    const promesas = [
      hidratarUsuarios().then((r) => vivo && console.info('[arranque] usuarios →', r.origen, `${r.total} registro(s)`)),
      hidratarVehiculos().then((r) => vivo && console.info('[arranque] vehículos →', r.origen, `${r.total} registro(s)`)),
      // Catálogos del super admin (rutas, áreas, tareas): al terminar se
      // actualiza el estado para que toda la app repinte con el catálogo
      // guardado en Firestore (si no hay, se quedan los valores de respaldo).
      cargarCatalogos()
        .then((r) => vivo && (console.info('[arranque] catálogos →', r.origen), setCatalogos(r)))
        .catch((e) => console.warn('[arranque] catálogos:', e?.message || e)),
    ];
    Promise.allSettled(promesas);
    return () => { vivo = false; };
  }, []);

  // Se identifica por NOMBRE de usuario o correo (retrocompatible con las
  // cuentas existentes que usaban correo). En Personal se crean usuarios con
  // contraseña y sin correo: entran escribiendo su nombre.
  //
  // Es ASÍNCRONO a propósito: antes de buscar la contraseña se espera a que
  // termine la hidratación desde Firestore. Sin eso, en un equipo nuevo (sin
  // datos en el navegador) se autenticaba contra los datos de arranque y
  // respondía "usuario o contraseña incorrectos" aunque fueran válidos.
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
        return (coincideNombre || coincideCorreo) && u.password === password;
      });

      if (!user) {
        throw new Error('Usuario o contraseña incorrectos.');
      }
      if (user.activo === false) {
        throw new Error('Este usuario se encuentra inactivo. Contacte al Administrador.');
      }

      // MIGRACIÓN A FIREBASE AUTH (fase 2): la contraseña ya se validó contra
      // la colección "usuarios"; ahora se abre la sesión en Firebase Auth con
      // ESA MISMA contraseña. Si Auth no responde, la sesión local se abre igual
      // y se deja constancia en consola: en esta fase nadie se queda fuera.
      const sesion = await abrirSesionFirebase(user, password);
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

  const loginDirecto = (userId) => {
    const usuarios = obtenerUsuarios();
    const user = usuarios.find(u => u.id === userId);
    if (user) {
      setCurrentUser(sinPassword(user));
      return user;
    }
  };

  /**
   * Cambia la contraseña de la persona con la sesión abierta (cambio
   * obligatorio al ingresar o cambio voluntario). Actualiza Firestore, la
   * sesión y, si Firebase Auth tiene sesión abierta, la credencial de Auth.
   *
   * @param {string} nuevaPassword contraseña nueva
   * @returns {object} usuario actualizado (sin contraseña)
   */
  const actualizarPasswordPropia = (nuevaPassword) => {
    if (!currentUser) throw new Error('No hay una sesión activa.');
    const actualizado = cambiarPassword(currentUser.id, nuevaPassword);
    setCurrentUser(sinPassword(actualizado));
    // Best-effort: si Auth no tiene sesión abierta (cuenta aún no migrada),
    // la credencial se sincroniza en el siguiente ingreso.
    sincronizarPasswordFirebase(nuevaPassword);
    return sinPassword(actualizado);
  };

  const logout = () => {
    if (currentUser) {
      registrarBitacora({
        tipo: TIPOS_BITACORA.SESION,
        accion: 'logout',
        detalle: `${currentUser.nombre} cerró sesión`,
        datos: { id: currentUser.id, nombre: currentUser.nombre, rol: currentUser.rol },
        quien: { usuario: currentUser.nombre, rol: currentUser.rol, id: currentUser.id },
      });
    }
    // Sin await a propósito: la salida no espera a la red. La operación queda
    // encolada en authFirebase para que no pise al inicio de sesión siguiente.
    cerrarSesionFirebase();
    setCurrentUser(null);
  };

  // La cuenta de soporte (superadmin) tiene TODOS los permisos del
  // administrador: es la credencial de mantenimiento del desarrollador.
  const isSuperAdmin = currentUser?.rol === 'superadmin';
  const isAdmin = currentUser?.rol === 'admin' || isSuperAdmin;
  const isEncargado = currentUser?.rol === 'encargado';
  const isMecanico = currentUser?.rol === 'mecanico';

  return (
    <AuthContext.Provider value={{
      currentUser,
      login,
      loginDirecto,
      logout,
      actualizarPasswordPropia,
      isAdmin,
      isEncargado,
      isMecanico,
      isSuperAdmin,
      catalogos,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}
