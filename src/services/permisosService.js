
import { zonaDelUsuario } from './usuariosService';

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

export function esColaRecepcion(orden) {
  return orden?.estado === 'ingresado' && !orden.mecanicoAsignado;
}

export function ordenEnZona(orden, usuario) {
  if (!orden || !usuario) return false;
  const { departamento, rutas } = zonaDelUsuario(usuario);
  if (!departamento && rutas.length === 0) return true;
  if (rutas.length > 0) {
    return orden.ruta ? rutas.includes(orden.ruta) : false;
  }
  return orden.departamento ? orden.departamento === departamento : true;
}

function limitadoPorZona(usuario) {
  return usuario?.rol === 'mecanico' || usuario?.rol === 'encargado';
}

export function puedeVerOrden(orden, usuario) {
  if (!usuario) return false;
  if (usuario.rol === 'admin') return true;
  if (limitadoPorZona(usuario) && !ordenEnZona(orden, usuario)) return false;
  if (usuario.rol === 'encargado') return true;
  return esPropiaDe(orden, usuario);
}

export function filtrarOrdenesPorUsuario(ordenes, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return ordenes;
  return ordenes.filter(o => {
    if (limitadoPorZona(usuario) && !ordenEnZona(o, usuario)) return false;
    if (usuario.rol === 'encargado') return true;
    return esPropiaDe(o, usuario);
  });
}

export function visiblesParaTaller(ordenes, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return ordenes;
  return ordenes.filter(o => {
    if (limitadoPorZona(usuario) && !ordenEnZona(o, usuario)) return false;
    if (usuario.rol === 'encargado') return true;
    return esPropiaDe(o, usuario) || esColaRecepcion(o);
  });
}

export function puedeAutoasignarse(orden, usuario) {
  if (!usuario || usuario.rol !== 'mecanico') return false;
  return esColaRecepcion(orden);
}

export function puedeAsignarPersonal(usuario) {
  return usuario?.rol === 'admin' || usuario?.rol === 'encargado';
}

export function puedeModificarOrden(usuario) {
  return usuario?.rol === 'admin' || usuario?.rol === 'encargado';
}

export function ordenCompleta(orden) {
  const acts = orden?.actividades || [];
  if (acts.length === 0) return true;
  return acts.every(a => a.estado === 'finalizado');
}

export function puedeReactivarOrden(usuario) {
  return usuario?.rol === 'admin' || usuario?.rol === 'encargado';
}

export function puedeCambiarEstadoActividad(orden, usuario) {
  if (!orden || !usuario) return false;
  if (usuario.rol === 'admin' || usuario.rol === 'encargado') return true;
  return esPropiaDe(orden, usuario);
}
