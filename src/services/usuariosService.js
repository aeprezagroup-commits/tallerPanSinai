import { crearRepositorio } from '../firebase/repositorio';
import { isFirebaseConfigured, db } from '../firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import { registrarBitacora, TIPOS_BITACORA } from './bitacoraService';
import { validarPassword, generarPasswordTemporal, hashPassword, esHashBcrypt } from '../utils/passwords';

export const ROL_SUPER_ADMIN = 'superadmin';

export function esSuperAdmin(usuario) {
  return usuario?.rol === ROL_SUPER_ADMIN;
}

const USUARIOS_INICIALES = [
  {
    id: 'user-admin',
    nombre: 'Ing. Alejandro Preza',
    email: 'admin@pansinai.com',
    password: 'admin',
    rol: 'admin', 
    cargo: 'Jefe de Taller / Administrador',
    telefono: '+503 7245-8810',
    activo: true
  },
  {
    id: 'user-carlos',
    nombre: 'Carlos López',
    email: 'carlos@pansinai.com',
    password: '123',
    rol: 'mecanico',
    cargo: 'Especialista en Suspensión y Dirección',
    telefono: '+503 7018-3426',
    activo: true
  },
  {
    id: 'user-juan',
    nombre: 'Juan Martínez',
    email: 'juan@pansinai.com',
    password: '123',
    rol: 'mecanico',
    cargo: 'Técnico Motor Diésel y Transmisión',
    telefono: '+503 7692-4051',
    activo: true
  },
  {
    id: 'user-pedro',
    nombre: 'Pedro Hernández',
    email: 'pedro@pansinai.com',
    password: '123',
    rol: 'mecanico',
    cargo: 'Técnico Electricista y Diagnóstico Computarizado',
    telefono: '+503 7483-9267',
    activo: true
  },
  {
    id: 'user-miguel',
    nombre: 'Miguel Ángel Reyes',
    email: 'miguel@pansinai.com',
    password: '123',
    rol: 'mecanico',
    cargo: 'Técnico en Sistema de Frenos y Neumática',
    telefono: '+503 7156-8394',
    activo: true
  },
  {
    id: 'user-roberto',
    nombre: 'Roberto Flores',
    email: 'roberto@pansinai.com',
    password: '123',
    rol: 'mecanico',
    cargo: 'Mecánico de Mantenimiento Preventivo',
    telefono: '+503 7824-6105',
    activo: true
  },
  {
    id: 'user-recepcion',
    nombre: 'Karla Guardado',
    email: 'encargada@pansinai.com',
    password: '123',
    rol: 'encargado',
    cargo: 'Encargada de Taller y Asignación de Personal',
    telefono: '+503 7309-5278',
    activo: true
  }
];

const repoUsuarios = crearRepositorio({
  coleccion: 'usuarios',
  claveLocal: 'pan_sinai_usuarios_v1',
  semilla: USUARIOS_INICIALES,
  idDe: (u) => u.id,
  campoId: 'id',
  evento: 'pan_sinai_users_updated',
  nombre: 'usuarios',
});

function migrarRoles(usuarios) {
  let cambio = false;
  usuarios.forEach((u) => {
    if (u.rol === 'recepcion') {
      u.rol = 'encargado';
      if (!u.email || u.email.includes('recepcion@')) u.email = 'encargada@pansinai.com';
      cambio = true;
    }
  });
  return { usuarios, cambio };
}

function migrarZonas(usuarios) {
  let cambio = false;
  usuarios.forEach((u) => {
    if (typeof u.departamento === 'undefined') { u.departamento = ''; cambio = true; }
    if (!Array.isArray(u.rutas)) { u.rutas = []; cambio = true; }
  });
  return { usuarios, cambio };
}

export function zonaDelUsuario(usuario) {
  if (!usuario) return { departamento: '', rutas: [] };
  const rutas = Array.isArray(usuario.rutas) ? usuario.rutas.filter(Boolean) : [];
  return { departamento: usuario.departamento || '', rutas };
}

export function tieneZonaAsignada(usuario) {
  const { departamento, rutas } = zonaDelUsuario(usuario);
  return Boolean(departamento) || rutas.length > 0;
}

export function zonaTexto(usuario) {
  if (!usuario) return 'Sin zona';
  const { departamento, rutas } = zonaDelUsuario(usuario);
  if (rutas.length > 0) return `${rutas.length} ruta${rutas.length > 1 ? 's' : ''}`;
  if (departamento) return departamento;
  return 'Todo el taller';
}

export function obtenerUsuarios() {
  try {
    const datos = repoUsuarios.obtener();
    const r1 = migrarRoles(datos);
    const r2 = migrarZonas(r1.usuarios);
    if (r1.cambio || r2.cambio) {
      guardarUsuarios(r2.usuarios);
      r2.usuarios.forEach((u) => repoUsuarios.persistirUno(u));
    }
    return r2.usuarios;
  } catch {
    return USUARIOS_INICIALES;
  }
}

export function guardarUsuarios(usuarios) {
  try {
    repoUsuarios.reemplazar(usuarios);
  } catch (e) {
    console.error('Error guardando usuarios', e);
  }
}

export function obtenerPersonalVisible() {
  return obtenerUsuarios().filter((u) => !esSuperAdmin(u));
}

export function registrarUidFirebase(id, uid) {
  const usuarios = obtenerUsuarios();
  const index = usuarios.findIndex(u => u.id === id);
  if (index === -1) return null;

  usuarios[index] = { ...usuarios[index], uid };
  guardarUsuarios(usuarios);
  return usuarios[index];
}

export function hidratarUsuarios() {
  return repoUsuarios.hidratar().catch((e) => {
    console.warn('[usuarios] hidratación fallida:', e);
    return { origen: 'local', total: obtenerUsuarios().length };
  });
}

export function esperarHidratacionUsuarios() {
  return repoUsuarios.esperarHidratacion();
}

export function obtenerMecanicosActivos() {
  const usuarios = obtenerUsuarios();
  return usuarios
    .filter(u => u.rol === 'mecanico' && u.activo !== false)
    .map(u => u.nombre);
}

export const PASSWORD_GENERICA = 'Sinai2026*';

export async function crearCuentaSoporte({ nombre = 'admin', password, por = '' } = {}) {
  const nombreNorm = String(nombre || '').trim();
  if (nombreNorm.length < 3) {
    throw new Error('El nombre de la cuenta de soporte debe tener al menos 3 caracteres.');
  }

  const passNorm = String(password || '').trim();
  const errorPassword = validarPassword(passNorm);
  if (errorPassword) throw new Error(errorPassword);

  const usuarios = obtenerUsuarios();
  if (usuarios.some(esSuperAdmin)) {
    throw new Error('Ya existe la cuenta de soporte en el sistema.');
  }
  const duplicado = usuarios.some(u => u.nombre.trim().toLowerCase() === nombreNorm.toLowerCase());
  if (duplicado) {
    throw new Error(`Ya existe un usuario registrado con el nombre "${nombreNorm}".`);
  }

  const usuario = {
    id: 'user-soporte',
    nombre: nombreNorm,
    password: hashPassword(passNorm),
    rol: ROL_SUPER_ADMIN,
    cargo: 'Soporte y mantenimiento de la aplicación',
    telefono: '',
    departamento: '',
    rutas: [],
    activo: true,
    oculto: true,
    debeCambiarPassword: false,
    creadaEn: new Date().toISOString(),
    creadaPor: por || 'Consola de soporte',
  };

  if (isFirebaseConfigured) {
    const guardado = await repoUsuarios.persistirUno(usuario);
    if (!guardado) {
      throw new Error('Firestore rechazó la cuenta de soporte: revisa las reglas (rol "superadmin") y vuelve a intentarlo.');
    }
  }

  const lista = obtenerUsuarios();
  lista.push(usuario);
  guardarUsuarios(lista);

  registrarBitacora({
    tipo: TIPOS_BITACORA.USUARIO,
    accion: 'crear',
    detalle: `Creó la cuenta de soporte "${usuario.nombre}" (superadmin)`,
    datos: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
  });
  return usuario;
}

export function agregarUsuario(nuevoUsuario) {
  if (!nuevoUsuario) {
    throw new Error('No se proporcionaron datos para el usuario.');
  }

  const nombreNorm = (nuevoUsuario.nombre || '').trim();
  if (!nombreNorm || nombreNorm.length < 3) {
    throw new Error('El nombre completo es obligatorio y debe tener al menos 3 caracteres.');
  }

  const passwordNorm = (nuevoUsuario.password || '').trim() || PASSWORD_GENERICA;
  const errorPassword = validarPassword(passwordNorm);
  if (errorPassword) {
    throw new Error(errorPassword);
  }

  const rolValido = ['mecanico', 'encargado', 'admin'].includes(nuevoUsuario.rol)
    ? nuevoUsuario.rol
    : 'mecanico';

  const usuarios = obtenerUsuarios();

  const duplicado = usuarios.some(u => u.nombre.trim().toLowerCase() === nombreNorm.toLowerCase());
  if (duplicado) {
    throw new Error(`Ya existe un usuario registrado con el nombre "${nombreNorm}".`);
  }

  const id = 'user-' + Date.now().toString(36);
  const usuario = {
    id,
    activo: true,
    ...nuevoUsuario,
    nombre: nombreNorm,
    password: hashPassword(passwordNorm),
    debeCambiarPassword: true, 
    rol: rolValido,
    cargo: (nuevoUsuario.cargo || '').trim(),
    telefono: (nuevoUsuario.telefono || '').trim(),
    departamento: (nuevoUsuario.departamento || '').trim(),
    rutas: Array.isArray(nuevoUsuario.rutas) ? nuevoUsuario.rutas : []
  };

  usuarios.push(usuario);
  guardarUsuarios(usuarios);
  repoUsuarios.persistirUno(usuario);
  registrarBitacora({
    tipo: TIPOS_BITACORA.USUARIO,
    accion: 'crear',
    detalle: `Creó el usuario "${usuario.nombre}" (${usuario.rol})`,
    datos: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol, cargo: usuario.cargo },
  });
  return usuario;
}

export function actualizarUsuario(id, datos) {
  const usuarios = obtenerUsuarios();
  const index = usuarios.findIndex(u => u.id === id);
  if (index !== -1) {
    if (esSuperAdmin(usuarios[index])) {
      throw new Error('La cuenta de soporte no se puede editar desde Personal.');
    }
    if (datos.nombre !== undefined) {
      const nombreNorm = datos.nombre.trim();
      if (!nombreNorm || nombreNorm.length < 3) {
        throw new Error('El nombre completo debe tener al menos 3 caracteres.');
      }
      const dup = usuarios.some(u => u.id !== id && u.nombre.trim().toLowerCase() === nombreNorm.toLowerCase());
      if (dup) {
        throw new Error(`Ya existe otro usuario con el nombre "${nombreNorm}".`);
      }
      datos.nombre = nombreNorm;
    }
    if (datos.password !== undefined) {
      const passNorm = datos.password.trim();
      const errorPassword = validarPassword(passNorm);
      if (errorPassword) {
        throw new Error(errorPassword);
      }
      datos.password = passNorm;
    }

    usuarios[index] = { ...usuarios[index], ...datos };
    guardarUsuarios(usuarios);
    repoUsuarios.persistirUno(usuarios[index]); 
    const { password: _pass, ...seguro } = datos;
    registrarBitacora({
      tipo: TIPOS_BITACORA.USUARIO,
      accion: 'editar',
      detalle: `Editó el usuario "${usuarios[index].nombre}"`,
      datos: { id, campos: Object.keys(seguro) },
    });
    return usuarios[index];
  }
  return null;
}

export function eliminarUsuario(id) {
  const previo = obtenerUsuarios().find((u) => u.id === id);
  if (esSuperAdmin(previo)) {
    throw new Error('La cuenta de soporte no se puede eliminar.');
  }
  let usuarios = obtenerUsuarios();
  usuarios = usuarios.filter(u => u.id !== id);
  guardarUsuarios(usuarios);
  repoUsuarios.borrarUno(id); 
  registrarBitacora({
    tipo: TIPOS_BITACORA.USUARIO,
    accion: 'eliminar',
    detalle: `Eliminó el usuario "${previo?.nombre || id}"`,
    datos: { id, nombre: previo?.nombre || '', rol: previo?.rol || '' },
  });
}

export function alternarEstadoUsuario(id) {
  const usuarios = obtenerUsuarios();
  const index = usuarios.findIndex(u => u.id === id);
  if (index !== -1) {
    if (esSuperAdmin(usuarios[index])) {
      throw new Error('La cuenta de soporte no se puede inactivar.');
    }
    usuarios[index].activo = !usuarios[index].activo;
    guardarUsuarios(usuarios);
    repoUsuarios.persistirUno(usuarios[index]); 
    registrarBitacora({
      tipo: TIPOS_BITACORA.USUARIO,
      accion: usuarios[index].activo ? 'activar' : 'inactivar',
      detalle: `${usuarios[index].activo ? 'Activó' : 'Inactivó'} a "${usuarios[index].nombre}"`,
      datos: { id, nombre: usuarios[index].nombre, activo: usuarios[index].activo },
    });
    return usuarios[index];
  }
  return null;
}

export function reiniciarPassword(id, { por = '' } = {}) {
  const usuarios = obtenerUsuarios();
  const index = usuarios.findIndex(u => u.id === id);
  if (index === -1) {
    throw new Error('No se encontró el usuario que se quiere reiniciar.');
  }
  if (esSuperAdmin(usuarios[index])) {
    throw new Error('La cuenta de soporte no permite reiniciar la contraseña.');
  }

  const temporal = generarPasswordTemporal();
  usuarios[index] = {
    ...usuarios[index],
    password: hashPassword(temporal),
    debeCambiarPassword: true,
    passwordActualizadaEn: new Date().toISOString(),
    passwordReiniciadaPor: por || 'Administración',
  };

  guardarUsuarios(usuarios);
  repoUsuarios.persistirUno(usuarios[index]); 

  registrarBitacora({
    tipo: TIPOS_BITACORA.USUARIO,
    accion: 'reiniciar-password',
    detalle: `Reinició la contraseña de "${usuarios[index].nombre}" y le exigió cambiarla al ingresar`,
    datos: {
      id,
      nombre: usuarios[index].nombre,
      rol: usuarios[index].rol,
      por: por || 'Administración',
      debeCambiarPassword: true,
    },
  });

  return { temporal, usuario: usuarios[index] };
}

export function cambiarPassword(id, nuevaPassword) {
  const passwordNorm = String(nuevaPassword ?? '').trim();
  const errorPassword = validarPassword(passwordNorm);
  if (errorPassword) {
    throw new Error(errorPassword);
  }

  const usuarios = obtenerUsuarios();
  const index = usuarios.findIndex(u => u.id === id);
  if (index === -1) {
    throw new Error('No se encontró el usuario para cambiar la contraseña.');
  }

  usuarios[index] = {
    ...usuarios[index],
    password: hashPassword(passwordNorm),
    debeCambiarPassword: false,
    passwordActualizadaEn: new Date().toISOString(),
  };

  guardarUsuarios(usuarios);
  repoUsuarios.persistirUno(usuarios[index]); 

  registrarBitacora({
    tipo: TIPOS_BITACORA.USUARIO,
    accion: 'cambiar-password',
    detalle: `Cambió su contraseña de acceso`,
    datos: { id, nombre: usuarios[index].nombre, rol: usuarios[index].rol },
  });

  return usuarios[index];
}

export async function migrarPasswordsAHash() {
  const usuarios = obtenerUsuarios();
  const pendientes = usuarios.filter((u) => u && u.password && !esHashBcrypt(u.password));
  if (pendientes.length === 0) {
    return { migrados: 0, total: usuarios.length, fallos: 0 };
  }

  const resultados = await Promise.allSettled(
    pendientes.map((u) => {
      const hash = hashPassword(u.password);
      if (!isFirebaseConfigured || !db) return Promise.resolve({ id: u.id, hash });
      return setDoc(doc(db, 'usuarios', String(u.id)), { password: hash }, { merge: true }).then(
        () => ({ id: u.id, hash })
      );
    })
  );

  const exitos = new Map();
  resultados.forEach((resultado, i) => {
    if (resultado.status === 'fulfilled') exitos.set(pendientes[i].id, resultado.value.hash);
  });

  if (exitos.size > 0) {
    const lista = usuarios.map((u) => (exitos.has(u.id) ? { ...u, password: exitos.get(u.id) } : u));
    guardarUsuarios(lista);
    registrarBitacora({
      tipo: TIPOS_BITACORA.USUARIO,
      accion: 'migrar-passwords',
      detalle: `Migró ${exitos.size} contraseña(s) al formato seguro (hash)`,
      datos: { migrados: exitos.size, pendientes: pendientes.length - exitos.size },
    });
  }

  return { migrados: exitos.size, total: usuarios.length, fallos: pendientes.length - exitos.size };
}
