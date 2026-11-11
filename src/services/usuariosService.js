// SERVICIO DE USUARIOS Y MECÁNICOS
// Gestión de personal, técnicos y accesos
//
// FUENTE DE VERDAD: Firestore (colección "usuarios")
// Espejo de respaldo: localStorage
// Caché en memoria: para que obtenerUsuarios() siga siendo síncrono
import { crearRepositorio } from '../firebase/repositorio';
import { isFirebaseConfigured } from '../firebase/config';
import { registrarBitacora, TIPOS_BITACORA } from './bitacoraService';
import { validarPassword, generarPasswordTemporal } from '../utils/passwords';

// CUENTA DE SOPORTE — SUPER ADMINISTRADOR
// Rol reservado para el desarrollador (mantenimiento y soporte de la
// aplicación). No aparece en Personal, no se le puede reiniciar la
// contraseña ni editarla ni eliminarla desde la interfaz: es la única
// cuenta que entra a la consola oculta /admin-secreto/bitacora.
export const ROL_SUPER_ADMIN = 'superadmin';

// ¿Este usuario es la cuenta de soporte?
export function esSuperAdmin(usuario) {
  return usuario?.rol === ROL_SUPER_ADMIN;
}

// Usuarios y mecánicos iniciales del taller Pan Sinaí
const USUARIOS_INICIALES = [
  {
    id: 'user-admin',
    nombre: 'Ing. Alejandro Preza',
    email: 'admin@pansinai.com',
    password: 'admin',
    rol: 'admin', // admin | encargado | mecanico
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

// Repositorio: Firestore = verdad · localStorage = espejo · memoria = caché
const repoUsuarios = crearRepositorio({
  coleccion: 'usuarios',
  claveLocal: 'pan_sinai_usuarios_v1',
  semilla: USUARIOS_INICIALES,
  idDe: (u) => u.id,
  campoId: 'id',
  evento: 'pan_sinai_users_updated',
  nombre: 'usuarios',
});

// Migración de datos locales antiguos: el rol 'recepcion' ahora es 'encargado'
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

// Migración: asegura que cada usuario tenga los campos de ZONA.
//   departamento: string ('' = sin zona por departamento)
//   rutas:        array de rutas de distribución asignadas ([] = sin rutas)
// Un usuario SIN zona (ambos vacíos) no se restringe y ve todo el taller.
function migrarZonas(usuarios) {
  let cambio = false;
  usuarios.forEach((u) => {
    if (typeof u.departamento === 'undefined') { u.departamento = ''; cambio = true; }
    if (!Array.isArray(u.rutas)) { u.rutas = []; cambio = true; }
  });
  return { usuarios, cambio };
}

// Zona de operación de un usuario (para filtrar vehículos/órdenes)
export function zonaDelUsuario(usuario) {
  if (!usuario) return { departamento: '', rutas: [] };
  const rutas = Array.isArray(usuario.rutas) ? usuario.rutas.filter(Boolean) : [];
  return { departamento: usuario.departamento || '', rutas };
}

// ¿El usuario tiene alguna zona asignada? (si no, ve todo)
export function tieneZonaAsignada(usuario) {
  const { departamento, rutas } = zonaDelUsuario(usuario);
  return Boolean(departamento) || rutas.length > 0;
}

// Texto legible de la zona de un usuario (para mostrar en listas)
export function zonaTexto(usuario) {
  if (!usuario) return 'Sin zona';
  const { departamento, rutas } = zonaDelUsuario(usuario);
  if (rutas.length > 0) return `${rutas.length} ruta${rutas.length > 1 ? 's' : ''}`;
  if (departamento) return departamento;
  return 'Todo el taller';
}

// Lee la caché (síncrono) y aplica las migraciones pendientes de esquema.
export function obtenerUsuarios() {
  try {
    const datos = repoUsuarios.obtener();
    const r1 = migrarRoles(datos);
    const r2 = migrarZonas(r1.usuarios);
    if (r1.cambio || r2.cambio) {
      guardarUsuarios(r2.usuarios);
      // La migración también debe llegar a la base
      r2.usuarios.forEach((u) => repoUsuarios.persistirUno(u));
    }
    return r2.usuarios;
  } catch {
    return USUARIOS_INICIALES;
  }
}

// Actualiza caché + espejo local de inmediato (síncrono, no bloquea).
export function guardarUsuarios(usuarios) {
  try {
    repoUsuarios.reemplazar(usuarios);
  } catch (e) {
    console.error('Error guardando usuarios', e);
  }
}

/**
 * Personal visible en Administración, en reportes y en cualquier listado:
 * la cuenta de soporte (superadmin) queda FUERA de la interfaz. Es una
 * cuenta técnica del desarrollador, no una persona del taller.
 *
 * @returns {object[]} usuarios sin la cuenta de soporte
 */
export function obtenerPersonalVisible() {
  return obtenerUsuarios().filter((u) => !esSuperAdmin(u));
}

/**
 * Deja en la caché local el uid de Firebase Auth (marca de cuenta migrada).
 * Se llama justo después de escribir el uid en Firestore: si no se refleja en
 * la caché, la siguiente escritura completa del usuario (editar, reiniciar
 * contraseña, activar/inactivar) lo borraría con un setDoc sin merge.
 *
 * No genera evento de bitácora: es un dato técnico, no una edición.
 *
 * @param {string} id id del documento en "usuarios"
 * @param {string} uid identificador de Firebase Auth
 * @returns {object|null} usuario actualizado, o null si no existe
 */
export function registrarUidFirebase(id, uid) {
  const usuarios = obtenerUsuarios();
  const index = usuarios.findIndex(u => u.id === id);
  if (index === -1) return null;

  usuarios[index] = { ...usuarios[index], uid };
  guardarUsuarios(usuarios);
  return usuarios[index];
}

/**
 * Hidrata desde Firestore al arrancar la aplicación.
 * - Firestore con datos → manda sobre lo local.
 * - Firestore vacío     → siembra desde el espejo (migración inicial).
 * - Sin conexión        → se queda con el espejo y sigue funcionando.
 * Nunca lanza; la app no depende de que esto termine.
 */
export function hidratarUsuarios() {
  return repoUsuarios.hidratar().catch((e) => {
    console.warn('[usuarios] hidratación fallida:', e);
    return { origen: 'local', total: obtenerUsuarios().length };
  });
}

/**
 * Espera a que termine la hidratación desde la base.
 * Lo usa el login para no autenticar contra los datos sembrados de arranque
 * mientras Firestore todavía no ha respondido.
 */
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

/**
 * Crea (o repara) la CUENTA DE SOPORTE — super administrador.
 * No se crea desde el formulario de Personal (allí el rol superadmin ni
 * siquiera está en el catálogo de roles): solo desde la consola oculta.
 *
 * Su contraseña es fija por diseño: la app no ofrece reiniciarla, para que
 * quede en manos del desarrollador como credencial de mantenimiento.
 *
 * @param {{nombre?: string, password: string, por?: string}} opciones
 * @returns {Promise<object>} usuario creado
 */
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
    password: passNorm,
    rol: ROL_SUPER_ADMIN,
    cargo: 'Soporte y mantenimiento de la aplicación',
    telefono: '',
    departamento: '',
    rutas: [],
    activo: true,
    oculto: true,
    // Contraseña fija: esta cuenta NO exige cambio ni admite reinicio.
    debeCambiarPassword: false,
    creadaEn: new Date().toISOString(),
    creadaPor: por || 'Consola de soporte',
  };

  // 1) PRIMERO LA BASE: si las reglas de Firestore la rechazan, no se toca
  //    nada en local (así no queda una cuenta que desaparece al recargar).
  if (isFirebaseConfigured) {
    const guardado = await repoUsuarios.persistirUno(usuario);
    if (!guardado) {
      throw new Error('Firestore rechazó la cuenta de soporte: revisa las reglas (rol "superadmin") y vuelve a intentarlo.');
    }
  }

  // 2) Espejo local + aviso a la interfaz
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

  // Prevención de nombres duplicados
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
    password: passwordNorm,
    debeCambiarPassword: true, // Forzar cambio obligatorio de contraseña en el primer inicio de sesión
    rol: rolValido,
    cargo: (nuevoUsuario.cargo || '').trim(),
    telefono: (nuevoUsuario.telefono || '').trim(),
    departamento: (nuevoUsuario.departamento || '').trim(),
    rutas: Array.isArray(nuevoUsuario.rutas) ? nuevoUsuario.rutas : []
  };

  usuarios.push(usuario);
  guardarUsuarios(usuarios);
  // persistirUno ya registra la escritura en las métricas
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
    // La cuenta de soporte no se edita desde Personal: queda reservada al
    // desarrollador (rol y contraseña fijos, fuera de la interfaz).
    if (esSuperAdmin(usuarios[index])) {
      throw new Error('La cuenta de soporte no se puede editar desde Personal.');
    }
    if (datos.nombre !== undefined) {
      const nombreNorm = datos.nombre.trim();
      if (!nombreNorm || nombreNorm.length < 3) {
        throw new Error('El nombre completo debe tener al menos 3 caracteres.');
      }
      // Verificar duplicado excluyendo a sí mismo
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
    repoUsuarios.persistirUno(usuarios[index]); // a Firestore, sin bloquear
    // Nunca se registra la contraseña en la bitácora
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
  repoUsuarios.borrarUno(id); // a Firestore, sin bloquear
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
    repoUsuarios.persistirUno(usuarios[index]); // a Firestore, sin bloquear
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

/**
 * REINICIO DE CONTRASEÑA POR PARTE DEL ADMINISTRADOR.
 * Deja una contraseña temporal y marca la cuenta para que la persona tenga
 * que cambiarla obligatoriamente en su próximo ingreso.
 *
 * La contraseña temporal se devuelve UNA sola vez para que el administrador
 * se la entregue en mano. Nunca se guarda en la bitácora ni se muestra de
 * nuevo en la interfaz.
 *
 * @param {string} id id del usuario
 * @param {{por?: string}} opciones nombre de quien reinicia (para la bitácora)
 * @returns {{temporal: string, usuario: object}}
 */
export function reiniciarPassword(id, { por = '' } = {}) {
  const usuarios = obtenerUsuarios();
  const index = usuarios.findIndex(u => u.id === id);
  if (index === -1) {
    throw new Error('No se encontró el usuario que se quiere reiniciar.');
  }
  // CUENTA DE SOPORTE: su contraseña no se reinicia nunca. Es la
  // credencial de mantenimiento del desarrollador.
  if (esSuperAdmin(usuarios[index])) {
    throw new Error('La cuenta de soporte no permite reiniciar la contraseña.');
  }

  const temporal = generarPasswordTemporal();
  usuarios[index] = {
    ...usuarios[index],
    password: temporal,
    debeCambiarPassword: true,
    passwordActualizadaEn: new Date().toISOString(),
    passwordReiniciadaPor: por || 'Administración',
  };

  guardarUsuarios(usuarios);
  repoUsuarios.persistirUno(usuarios[index]); // a Firestore, sin bloquear

  registrarBitacora({
    tipo: TIPOS_BITACORA.USUARIO,
    accion: 'reiniciar-password',
    detalle: `Reinició la contraseña de "${usuarios[index].nombre}" y le exigió cambiarla al ingresar`,
    // La contraseña temporal NUNCA se registra en la bitácora.
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

/**
 * Cambio de contraseña obligatorio (o voluntario) del propio usuario.
 * Valida la política completa y quita la marca de "debe cambiar".
 *
 * @param {string} id id del usuario
 * @param {string} nuevaPassword contraseña nueva escrita por la persona
 * @returns {object} usuario actualizado
 */
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
    password: passwordNorm,
    debeCambiarPassword: false,
    passwordActualizadaEn: new Date().toISOString(),
  };

  guardarUsuarios(usuarios);
  repoUsuarios.persistirUno(usuarios[index]); // a Firestore, sin bloquear

  registrarBitacora({
    tipo: TIPOS_BITACORA.USUARIO,
    accion: 'cambiar-password',
    detalle: `Cambió su contraseña de acceso`,
    datos: { id, nombre: usuarios[index].nombre, rol: usuarios[index].rol },
  });

  return usuarios[index];
}
