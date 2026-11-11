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

function sinPassword(usuario) {
  if (!usuario) return usuario;
  const { password: _password, ...resto } = usuario;
  return resto;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('pan_sinai_auth_user');
    if (saved) {
      try {
        const user = JSON.parse(saved);
        if (user && user.id) {
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
        return actualizado ? sinPassword({ ...actualizado }) : null;
      });
    };
    window.addEventListener('pan_sinai_users_updated', refrescarSesion);
    return () => window.removeEventListener('pan_sinai_users_updated', refrescarSesion);
  }, []);

  useEffect(() => {
    let vivo = true;
    const promesas = [
      hidratarUsuarios().then((r) => vivo && console.info('[arranque] usuarios →', r.origen, `${r.total} registro(s)`)),
      hidratarVehiculos().then((r) => vivo && console.info('[arranque] vehículos →', r.origen, `${r.total} registro(s)`)),
      cargarCatalogos()
        .then((r) => vivo && (console.info('[arranque] catálogos →', r.origen), setCatalogos(r)))
        .catch((e) => console.warn('[arranque] catálogos:', e?.message || e)),
    ];
    Promise.allSettled(promesas);
    return () => { vivo = false; };
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
        return (coincideNombre || coincideCorreo) && u.password === password;
      });

      if (!user) {
        throw new Error('Usuario o contraseña incorrectos.');
      }
      if (user.activo === false) {
        throw new Error('Este usuario se encuentra inactivo. Contacte al Administrador.');
      }

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

  const actualizarPasswordPropia = (nuevaPassword) => {
    if (!currentUser) throw new Error('No hay una sesión activa.');
    const actualizado = cambiarPassword(currentUser.id, nuevaPassword);
    setCurrentUser(sinPassword(actualizado));
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
    cerrarSesionFirebase();
    setCurrentUser(null);
  };

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
