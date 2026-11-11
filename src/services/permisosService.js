// PERMISOS DE VISIBILIDAD POR ROL
// Roles: mecanico | encargado | admin
// - mecanico:  ve su cola de recepción (unidades sin asignar) y sus órdenes asignadas
// - encargado: ve y administra toda la operación del taller
// - admin:     acceso completo (incluye costos, historial y métricas)

import { zonaDelUsuario } from './usuariosService';

// Un mecánico solo trabaja sus propias órdenes:
// las que tiene asignadas (principal o apoyo) y las de sus actividades
export function apoyosDeOrden(orden) {
  if (Array.isArray(orden?.mecanicosApoyo)) return orden.mecanicosApoyo;
  return orden?.mecanicoAsignado2 ? [orden.mecanicoAsignado2] : [];
}

function esPropiaDe(orden, usuario) {
  if (!orden || !usuario) return false;
  if (orden.mecanicoAsignado === usuario.nombre) return true;
  if (apoyosDeOrden(orden).includes(usuario.nombre)) return true;
  return (orden.actividades || []).some(a => a.mecanicoAsignado === usuario.nombre);
}

// Unidad recién ingresada que aún no tiene mecánico responsable (cola de recepción)
export function esColaRecepcion(orden) {
  return orden?.estado === 'ingresado' && !orden.mecanicoAsignado;
}

// FILTRADO POR ZONA (departamento / rutas del usuario)
// El admin ve todo. Mecánicos y encargados solo ven las
// órdenes de su zona asignada. Un usuario SIN zona no se restringe.
export function ordenEnZona(orden, usuario) {
  if (!orden || !usuario) return false;
  const { departamento, rutas } = zonaDelUsuario(usuario);
  if (!departamento && rutas.length === 0) return true;
  // Con rutas asignadas: la orden debe ser de alguna de esas rutas
  if (rutas.length > 0) {
    return orden.ruta ? rutas.includes(orden.ruta) : false;
  }
  // Solo departamento: la orden debe ser de ese departamento
  return orden.departamento ? orden.departamento === departamento : true;
}

// Solo mecánicos y encargados se limitan por zona; el admin no.
function limitadoPorZona(usuario) {
  return usuario?.rol === 'mecanico' || usuario?.rol === 'encargado';
}

// ¿Puede el usuario actual abrir/ver esta orden completa?
export function puedeVerOrden(orden, usuario) {
  if (!usuario) return false;
  if (usuario.rol === 'admin') return true;
  // Mecánico y encargado: primero deben estar dentro de su zona
  if (limitadoPorZona(usuario) && !ordenEnZona(orden, usuario)) return false;
  if (usuario.rol === 'encargado') return true;
  return esPropiaDe(orden, usuario);
}

// Filtra la lista de órdenes según el rol y la zona del usuario
export function filtrarOrdenesPorUsuario(ordenes, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return ordenes;
  return ordenes.filter(o => {
    if (limitadoPorZona(usuario) && !ordenEnZona(o, usuario)) return false;
    if (usuario.rol === 'encargado') return true;
    return esPropiaDe(o, usuario);
  });
}

// Lista para el módulo Taller: el mecánico ve su cola de recepción + sus órdenes
export function visiblesParaTaller(ordenes, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return ordenes;
  return ordenes.filter(o => {
    if (limitadoPorZona(usuario) && !ordenEnZona(o, usuario)) return false;
    if (usuario.rol === 'encargado') return true;
    return esPropiaDe(o, usuario) || esColaRecepcion(o);
  });
}

// ¿Puede autoasignarse una unidad de la cola de recepción?
export function puedeAutoasignarse(orden, usuario) {
  if (!usuario || usuario.rol !== 'mecanico') return false;
  return esColaRecepcion(orden);
}

// ¿Puede asignar personal a las unidades (uno o dos mecánicos)?
export function puedeAsignarPersonal(usuario) {
  return usuario?.rol === 'admin' || usuario?.rol === 'encargado';
}

// Una orden ya guardada solo la puede modificar (editar/eliminar) el
// encargado de taller o el administrador. El mecánico la opera
// (estados, tiempos, finalización) pero no edita su contenido.
export function puedeModificarOrden(usuario) {
  return usuario?.rol === 'admin' || usuario?.rol === 'encargado';
}

// ¿La OT está COMPLETA? = todas sus actividades finalizadas (o sin actividades).
// El mecánico solo puede cerrar una OT completa; una incompleta solo la cierra
// el encargado de taller/administración con justificación.
export function ordenCompleta(orden) {
  const acts = orden?.actividades || [];
  if (acts.length === 0) return true;
  return acts.every(a => a.estado === 'finalizado');
}

// ¿Puede reactivar (reabrir) una OT finalizada por error?
export function puedeReactivarOrden(usuario) {
  return usuario?.rol === 'admin' || usuario?.rol === 'encargado';
}

// ¿Puede cambiar el estado de las actividades de esta OT?
// Solo el encargado de taller, los administradores y el usuario
// asignado a la orden (principal, apoyo o de sus actividades).
export function puedeCambiarEstadoActividad(orden, usuario) {
  if (!orden || !usuario) return false;
  if (usuario.rol === 'admin' || usuario.rol === 'encargado') return true;
  return esPropiaDe(orden, usuario);
}
