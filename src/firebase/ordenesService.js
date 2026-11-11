import { normalizarPlaca } from '../utils/placas';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { cabenFotosDe, PRESUPUESTO_DOC_FOTOS } from './fotosConfig';
import {
  contarLectura, contarEscritura, aproximarBytes,
} from '../services/metricasService';
import { registrarBitacora, TIPOS_BITACORA } from '../services/bitacoraService';

const ORDERS_COLLECTION = 'ordenes_trabajo';
const LOCAL_STORAGE_KEY = 'pan_sinai_ordenes_data_v3';

export const TRANSICIONES_VALIDAS = {
  ingresado: ['pendiente_diagnostico', 'en_proceso', 'cancelado'],
  pendiente_diagnostico: ['en_proceso', 'esperando_repuestos', 'pendiente_autorizacion', 'cancelado'],
  en_proceso: ['esperando_repuestos', 'pendiente_autorizacion', 'pausado', 'finalizado'],
  esperando_repuestos: ['en_proceso', 'pausado', 'cancelado'],
  pendiente_autorizacion: ['en_proceso', 'esperando_repuestos', 'cancelado'],
  pausado: ['en_proceso', 'esperando_repuestos', 'pendiente_autorizacion'],
  finalizado: ['listo_entrega', 'en_proceso'],
  listo_entrega: ['entregado', 'en_proceso'],
  entregado: [],
  cancelado: []
};


function toMillis(marca) {
  if (!marca) return null;
  if (typeof marca.toMillis === 'function') return marca.toMillis();
  if (typeof marca.toDate === 'function') return marca.toDate().getTime();
  const ms = new Date(marca).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function minutosDesde(marca) {
  const ms = toMillis(marca);
  if (!ms) return 0;
  return Math.max(0, Math.round((Date.now() - ms) / 60000));
}

function marcaActual() {
  return new Date().toISOString();
}

function minutosRealesDeOrden(orden, minutosAlternativos = 0) {
  const base = Number(orden?.tiempoRealMinutos) || 0;
  const parcial = orden?.trabajoEnCurso ? minutosDesde(orden.tiempoInicioTrabajo) : 0;
  if (parcial > 0) return base + parcial;
  return Number(minutosAlternativos) || base;
}


function wrapLocalData(item) {
  let fechaIng = item.fechaIngreso;
  if (fechaIng && typeof fechaIng === 'string') {
    fechaIng = { toDate: () => new Date(item.fechaIngreso) };
  } else if (!fechaIng?.toDate) {
    fechaIng = { toDate: () => new Date() };
  }

  let fechaSal = item.fechaSalida;
  if (fechaSal && typeof fechaSal === 'string') {
    fechaSal = { toDate: () => new Date(item.fechaSalida) };
  }

  return {
    ...item,
    fechaIngreso: fechaIng,
    fechaSalida: fechaSal,
    actividades: Array.isArray(item.actividades) ? item.actividades : [],
    historialEstados: Array.isArray(item.historialEstados) ? item.historialEstados : []
  };
}

function getLocalOrders() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      saveLocalOrders([], false);
      return [];
    }
    const parsed = JSON.parse(raw);
    const lista = parsed.map(wrapLocalData);
    if (asignarNumerosFaltantes(lista)) saveLocalOrders(lista, false);
    return lista;
  } catch {
    return [];
  }
}

function saveLocalOrders(orders, dispatch = true) {
  try {
    const serialized = orders.map(o => ({
      ...o,
      fechaIngreso: o.fechaIngreso?.toDate ? o.fechaIngreso.toDate().toISOString() : o.fechaIngreso,
      fechaSalida: o.fechaSalida?.toDate ? o.fechaSalida.toDate().toISOString() : o.fechaSalida,
    }));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serialized));
    if (dispatch) window.dispatchEvent(new CustomEvent('pan_sinai_orders_updated'));
  } catch (e) {
    console.error('Error guardando en localStorage', e);
  }
}

export function formatoOT(orden) {
  const n = Number(orden?.numeroOrden);
  if (n > 0) return `OT-${String(n).padStart(4, '0')}`;
  return `OT-${String(orden?.id || '').slice(0, 6).toUpperCase()}`;
}

function asignarNumerosFaltantes(ordenes) {
  const sinNumero = ordenes
    .filter(o => !(Number(o.numeroOrden) > 0))
    .sort((a, b) => (toMillis(a.fechaIngreso) || 0) - (toMillis(b.fechaIngreso) || 0));
  if (sinNumero.length === 0) return false;
  const max = ordenes.reduce((m, o) => Math.max(m, Number(o.numeroOrden) || 0), 0);
  let n = max;
  for (const o of sinNumero) o.numeroOrden = ++n;
  return true;
}

async function siguienteNumeroOrden() {
  if (isFirebaseConfigured && db) {
    try {
      const ref = doc(db, 'contadores', ORDERS_COLLECTION);
      const snap = await getDoc(ref);
      const actual = Number(snap.exists() ? snap.data().valor : 0) || 0;
      contarLectura();
      const nuevo = actual + 1;
      await setDoc(ref, { valor: nuevo });
      contarEscritura();
      return nuevo;
    } catch (e) {
      console.warn('No se pudo leer el contador de órdenes:', e);
      return null;
    }
  }
  const ordenes = getLocalOrders();
  const max = ordenes.reduce((m, o) => Math.max(m, Number(o.numeroOrden) || 0), 0);
  return max + 1;
}


export async function crearOrden(datosOrden) {
  const numeroOrden = await siguienteNumeroOrden();

  const initialActividades = Array.isArray(datosOrden.actividades) && datosOrden.actividades.length > 0
    ? datosOrden.actividades
    : [
        {
          id: 'act-' + Date.now().toString(36) + '-1',
          descripcion: datosOrden.diagnosticoInicial || 'Revisión y mantenimiento general',
          area: datosOrden.areaPrincipal || 'General',
          mecanicoAsignado: datosOrden.mecanicoAsignado || '',
          estado: 'pendiente',
          tiempoEstimadoMinutos: (Number(datosOrden.tiempoEstimadoHoras) || 2) * 60,
          tiempoRealMinutos: 0,
          observaciones: ''
        }
      ];

  const initialHistory = [
    {
      estado: 'ingresado',
      fecha: new Date().toISOString(),
      usuario: datosOrden.mecanicoReceptor || 'Recepción',
      motivo: 'Ingreso inicial a taller'
    }
  ];

  if (isFirebaseConfigured && db) {
    const orden = {
      placa: normalizarPlaca(datosOrden.placa),
      marca: datosOrden.marca || '',
      modelo: datosOrden.modelo || '',
      numMotor: datosOrden.numMotor || '',
      vin: (datosOrden.vin || '').toUpperCase(),
      anio: datosOrden.anio || '',
      kilometraje: Number(datosOrden.kilometraje) || 0,
      departamento: datosOrden.departamento || 'San Salvador',
      ruta: datosOrden.ruta || 'Ruta 01 - San Salvador Centro & Escalerón',
      fechaIngreso: serverTimestamp(),
      conductorEntrega: datosOrden.conductorEntrega || '',
      mecanicoReceptor: datosOrden.mecanicoReceptor || '',
      diagnosticoInicial: datosOrden.diagnosticoInicial || '',
      problemasEncontrados: datosOrden.problemasEncontrados || '',
      solucionAplicada: '',
      costoRepuestos: Number(datosOrden.costoRepuestos) || 0,
      costoManoObra: Number(datosOrden.costoManoObra) || 0,
      costoTotal: (Number(datosOrden.costoRepuestos) || 0) + (Number(datosOrden.costoManoObra) || 0),
      tipoTrabajo: datosOrden.tipoTrabajo || 'Correctivo',
      tipoAtencion: datosOrden.tipoAtencion || 'taller',
      numeroOrden: numeroOrden || null,
      areaPrincipal: datosOrden.areaPrincipal || 'General',
      mecanicoAsignado: datosOrden.mecanicoAsignado || '',
      tiempoEstimadoHoras: Number(datosOrden.tiempoEstimadoHoras) || 0,
      tiempoRealMinutos: 0,
      tiempoInicioTrabajo: null,
      tiempoFinTrabajo: null,
      trabajoEnCurso: false,
      estado: 'ingresado',
      fechaSalida: null,
      personaRetira: '',
      observacionesFinales: '',
      recomendaciones: '',
      actividades: initialActividades,
      historialEstados: initialHistory,
      fotosLados: datosOrden.fotosLados || { frontal: '', lateralIzquierdo: '', lateralDerecho: '', trasera: '' },
      fotosIngreso: datosOrden.fotosIngreso || [],
      fotosSalida: [],
      creadoPor: datosOrden.creadoPor || 'Sistema',
      actualizadoEn: serverTimestamp()
    };

    if (!cabenFotosDe(orden)) {
      orden.fotosLados = { frontal: '', lateralIzquierdo: '', lateralDerecho: '', trasera: '' };
      console.warn(
        'Orden con demasiadas fotos: se omitió la copia de fotosLados ' +
        `(presupuesto ${Math.round(PRESUPUESTO_DOC_FOTOS / 1024)} KB por documento).`
      );
    }
    if (!cabenFotosDe(orden)) {
      orden.fotosIngreso = [];
      console.warn('Orden con demasiadas fotos: se omitieron las fotos de ingreso.');
    }
    if (!cabenFotosDe(orden)) {
      while (!cabenFotosDe(orden) && orden.fotosSalida.length > 0) {
        orden.fotosSalida = orden.fotosSalida.slice(0, -1);
      }
      console.warn('Orden con demasiadas fotos: se recortaron las fotos de salida.');
    }

    const docRef = await addDoc(collection(db, ORDERS_COLLECTION), orden);
    contarEscritura(aproximarBytes(orden));
    registrarBitacora({
      tipo: TIPOS_BITACORA.ORDEN,
      accion: 'crear',
      detalle: `Abrió la orden de ${orden.placa} (${docRef.id})`,
      datos: { id: docRef.id, placa: orden.placa, cliente: orden.cliente || orden.conductor || '' },
    });
    return { id: docRef.id, ...orden };
  } else {
    const orders = getLocalOrders();
    const newId = 'ord-' + Date.now().toString(36);
    const cRep = Number(datosOrden.costoRepuestos) || 0;
    const cMo = Number(datosOrden.costoManoObra) || 0;

    const newOrder = {
      id: newId,
      ...datosOrden,
      ...(numeroOrden ? { numeroOrden } : {}),
      placa: normalizarPlaca(datosOrden.placa),
      kilometraje: Number(datosOrden.kilometraje) || 0,
      costoRepuestos: cRep,
      costoManoObra: cMo,
      costoTotal: cRep + cMo,
      tiempoEstimadoHoras: Number(datosOrden.tiempoEstimadoHoras) || 0,
      tiempoRealMinutos: 0,
      estado: 'ingresado',
      fechaIngreso: { toDate: () => new Date() },
      fechaSalida: null,
      personaRetira: '',
      observacionesFinales: '',
      recomendaciones: '',
      actividades: initialActividades,
      historialEstados: initialHistory,
      fotosLados: datosOrden.fotosLados || { frontal: '', lateralIzquierdo: '', lateralDerecho: '', trasera: '' },
      fotosIngreso: datosOrden.fotosIngreso || [],
      fotosSalida: [],
      creadoPor: 'Sistema'
    };
    orders.unshift(newOrder);
    saveLocalOrders(orders);
    return newOrder;
  }
}

export async function obtenerOrdenes() {
  if (isFirebaseConfigured && db) {
    const q = query(collection(db, ORDERS_COLLECTION), orderBy('fechaIngreso', 'desc'));
    const snapshot = await getDocs(q);
    const ordenes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    contarLectura(aproximarBytes(ordenes));
    return ordenes;
  } else {
    return getLocalOrders();
  }
}

export function escucharOrdenes(callback) {
  if (isFirebaseConfigured && db) {
    const q = query(collection(db, ORDERS_COLLECTION), orderBy('fechaIngreso', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const ordenes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      contarLectura(aproximarBytes(ordenes));
      callback(ordenes);
    });
  } else {
    const handler = () => {
      callback(getLocalOrders());
    };
    window.addEventListener('pan_sinai_orders_updated', handler);
    setTimeout(() => callback(getLocalOrders()), 0);
    return () => {
      window.removeEventListener('pan_sinai_orders_updated', handler);
    };
  }
}

export async function obtenerOrden(id) {
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, ORDERS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const orden = { id: docSnap.id, ...docSnap.data() };
      contarLectura(aproximarBytes(orden));
      return orden;
    }
    return null;
  } else {
    const orders = getLocalOrders();
    return orders.find(o => o.id === id) || null;
  }
}

export async function actualizarOrden(id, datos) {
  const datosLimpios = { ...datos };
  if (datosLimpios.placa !== undefined && datosLimpios.placa !== null) {
    datosLimpios.placa = normalizarPlaca(datosLimpios.placa);
  }
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, ORDERS_COLLECTION, id);
    await updateDoc(docRef, { ...datosLimpios, actualizadoEn: serverTimestamp() });
    contarEscritura(aproximarBytes(datosLimpios));
  } else {
    const orders = getLocalOrders();
    const index = orders.findIndex(o => o.id === id);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...datosLimpios };
      saveLocalOrders(orders);
    }
  }
}

export async function cambiarEstado(id, nuevoEstado, usuario = 'Administrador', motivo = '') {
  const orden = await obtenerOrden(id);
  if (!orden) throw new Error('Orden no encontrada');

  const permitidos = TRANSICIONES_VALIDAS[orden.estado] || [];
  if (permitidos.length > 0 && !permitidos.includes(nuevoEstado)) {
    throw new Error(`Transición no válida de '${orden.estado}' a '${nuevoEstado}'.`);
  }

  const nuevoHistorial = [
    ...(orden.historialEstados || []),
    {
      estado: nuevoEstado,
      fecha: new Date().toISOString(),
      usuario,
      motivo: motivo || `Transición a ${nuevoEstado}`
    }
  ];

  registrarBitacora({
    tipo: TIPOS_BITACORA.ORDEN,
    accion: 'estado',
    detalle: `Cambió la orden ${id} de "${orden.estado}" a "${nuevoEstado}"`,
    datos: { id, placa: orden.placa, desde: orden.estado, hacia: nuevoEstado, usuario, motivo: motivo || '' },
  });

  return actualizarOrden(id, {
    estado: nuevoEstado,
    historialEstados: nuevoHistorial
  });
}


export async function agregarActividad(ordenId, nuevaActividad) {
  const orden = await obtenerOrden(ordenId);
  if (!orden) throw new Error('Orden no encontrada');

  const actividades = orden.actividades || [];
  const actividad = {
    id: 'act-' + Date.now().toString(36),
    descripcion: nuevaActividad.descripcion,
    area: nuevaActividad.area || orden.areaPrincipal || 'General',
    mecanicoAsignado: nuevaActividad.mecanicoAsignado || orden.mecanicoAsignado || '',
    estado: 'pendiente',
    tiempoEstimadoMinutos: Number(nuevaActividad.tiempoEstimadoMinutos) || 60,
    tiempoRealMinutos: 0,
    observaciones: nuevaActividad.observaciones || ''
  };

  actividades.push(actividad);
  return actualizarOrden(ordenId, { actividades });
}

export async function actualizarActividad(ordenId, actividadId, datosActualizados) {
  const orden = await obtenerOrden(ordenId);
  if (!orden) throw new Error('Orden no encontrada');

  const actividades = (orden.actividades || []).map(act => {
    if (act.id === actividadId) {
      return { ...act, ...datosActualizados };
    }
    return act;
  });

  return actualizarOrden(ordenId, { actividades });
}

export async function iniciarActividad(ordenId, actividadId, mecanico) {
  const orden = await obtenerOrden(ordenId);
  if (!orden) throw new Error('Orden no encontrada');

  const actividades = (orden.actividades || []).map(act => {
    if (act.id === actividadId) {
      return {
        ...act,
        estado: 'en_proceso',
        mecanicoAsignado: mecanico || act.mecanicoAsignado || orden.mecanicoAsignado,
        inicioHora: new Date().toISOString(),
        motivoPausa: ''
      };
    }
    return act;
  });

  const updates = { actividades, trabajoEnCurso: true };
  if (!orden.trabajoEnCurso || !orden.tiempoInicioTrabajo) {
    updates.tiempoInicioTrabajo = marcaActual();
  }
  if (orden.estado === 'ingresado' || orden.estado === 'pendiente_diagnostico' || orden.estado === 'pausado' || orden.estado === 'esperando_repuestos') {
    updates.estado = 'en_proceso';
  }

  return actualizarOrden(ordenId, updates);
}

export async function pausarActividad(ordenId, actividadId, motivoPausa, observacionesPausa = '') {
  const orden = await obtenerOrden(ordenId);
  if (!orden) throw new Error('Orden no encontrada');

  const actividades = (orden.actividades || []).map(act => {
    if (act.id === actividadId) {
      const parcial = act.estado === 'en_proceso' ? minutosDesde(act.inicioHora) : 0;
      return {
        ...act,
        estado: 'pausado',
        tiempoRealMinutos: (Number(act.tiempoRealMinutos) || 0) + parcial,
        inicioHora: null,
        motivoPausa,
        observaciones: observacionesPausa ? `${act.observaciones || ''}\n[Pausa: ${motivoPausa}] ${observacionesPausa}` : act.observaciones
      };
    }
    return act;
  });

  const todasPausadasRepuestos = actividades.every(a => a.estado === 'pausado' && a.motivoPausa === 'esperando_repuestos');
  const updates = { actividades, trabajoEnCurso: false };
  if (motivoPausa === 'esperando_repuestos' || todasPausadasRepuestos) {
    updates.estado = 'esperando_repuestos';
  } else {
    updates.estado = 'pausado';
  }

  return actualizarOrden(ordenId, updates);
}

export async function finalizarActividad(ordenId, actividadId, notasFinales = '', minutosRegistrados = 0) {
  const orden = await obtenerOrden(ordenId);
  if (!orden) throw new Error('Orden no encontrada');

  let sumaMinutos = 0;
  const actividades = (orden.actividades || []).map(act => {
    if (act.id === actividadId) {
      let tiempoAct;
      if (minutosRegistrados > 0) {
        tiempoAct = minutosRegistrados;
      } else if (act.estado === 'en_proceso' && act.inicioHora) {
        tiempoAct = (Number(act.tiempoRealMinutos) || 0) + minutosDesde(act.inicioHora);
      } else {
        tiempoAct = Number(act.tiempoRealMinutos) || Number(act.tiempoEstimadoMinutos) || 30;
      }
      sumaMinutos += tiempoAct;
      return {
        ...act,
        estado: 'finalizado',
        tiempoRealMinutos: tiempoAct,
        inicioHora: null,
        observaciones: notasFinales ? `${act.observaciones || ''}\n[Finalizado]: ${notasFinales}` : act.observaciones
      };
    }
    sumaMinutos += (act.tiempoRealMinutos || 0);
    return act;
  });

  const todasFinalizadas = actividades.every(a => a.estado === 'finalizado');
  const updates = {
    actividades,
    tiempoRealMinutos: sumaMinutos
  };

  if (todasFinalizadas) {
    updates.estado = 'finalizado';
    updates.trabajoEnCurso = false;
  }

  return actualizarOrden(ordenId, updates);
}

export async function iniciarTrabajo(id) {
  const orden = await obtenerOrden(id);
  const nuevoHistorial = [
    ...(orden?.historialEstados || []),
    {
      estado: 'en_proceso',
      fecha: new Date().toISOString(),
      usuario: orden?.mecanicoAsignado || 'Taller',
      motivo: 'Inicio general de trabajos mecánicos'
    }
  ];

  return actualizarOrden(id, {
    estado: 'en_proceso',
    tiempoInicioTrabajo: marcaActual(),
    trabajoEnCurso: true,
    historialEstados: nuevoHistorial
  });
}

export async function pausarTrabajo(id, minutosAcumulados, motivo = 'esperando_repuestos') {
  const orden = await obtenerOrden(id);
  const estadoDestino = motivo === 'esperando_repuestos' ? 'esperando_repuestos' : 'pausado';
  const nuevoHistorial = [
    ...(orden?.historialEstados || []),
    {
      estado: estadoDestino,
      fecha: new Date().toISOString(),
      usuario: orden?.mecanicoAsignado || 'Taller',
      motivo: `Pausado por: ${motivo}`
    }
  ];

  return actualizarOrden(id, {
    estado: estadoDestino,
    motivoPausa: motivo,
    tiempoRealMinutos: minutosRealesDeOrden(orden, minutosAcumulados),
    tiempoInicioTrabajo: null,
    trabajoEnCurso: false,
    historialEstados: nuevoHistorial
  });
}

export async function finalizarTrabajo(id, minutosTotal, detalleCierre = {}) {
  const orden = await obtenerOrden(id);
  const { trabajoRealizado = '', valeBodega = '', detalleRepuestos = '', repuestos = [], justificacionCierre = '' } = detalleCierre;
  const resumenRepuestos = repuestos.length
    ? ` | Repuestos: ${repuestos.map(r => r.descripcion).join(', ')}`
    : '';
  const cierreIncompleto = justificacionCierre
    ? ` | CIERRE INCOMPLETO justificado: ${justificacionCierre}`
    : '';
  const nuevoHistorial = [
    ...(orden?.historialEstados || []),
    {
      estado: 'finalizado',
      fecha: new Date().toISOString(),
      usuario: orden?.mecanicoAsignado || 'Taller',
      motivo: trabajoRealizado
        ? `Trabajo finalizado: ${trabajoRealizado}${valeBodega ? ` | Vale de bodega: ${valeBodega}` : ''}${resumenRepuestos}${cierreIncompleto}`
        : `Finalización de todas las actividades mecánicas${cierreIncompleto}`
    }
  ];

  return actualizarOrden(id, {
    estado: 'finalizado',
    tiempoFinTrabajo: marcaActual(),
    tiempoRealMinutos: minutosRealesDeOrden(orden, minutosTotal),
    tiempoInicioTrabajo: null,
    trabajoEnCurso: false,
    ...(trabajoRealizado ? { trabajoRealizado } : {}),
    ...(valeBodega ? { valeBodega } : {}),
    ...(detalleRepuestos ? { detalleRepuestos } : {}),
    ...(repuestos.length ? { repuestos } : {}),
    ...(justificacionCierre ? { justificacionCierre } : {}),
    ...(trabajoRealizado || valeBodega ? { finalizadoPor: orden?.mecanicoAsignado || 'Taller' } : {}),
    historialEstados: nuevoHistorial
  });
}

export async function reactivarOrden(id, usuario = 'Taller', justificacion = '') {
  const orden = await obtenerOrden(id);
  if (!orden) throw new Error('Orden no encontrada');
  if (orden.estado !== 'finalizado' && orden.estado !== 'listo_entrega') {
    throw new Error(`Solo se pueden reactivar órdenes finalizadas o listas para entrega (estado actual: ${orden.estado}).`);
  }
  const motivo = (justificacion || '').trim();
  if (!motivo) throw new Error('La justificación de reactivación es obligatoria.');

  const nuevoHistorial = [
    ...(orden.historialEstados || []),
    {
      estado: 'en_proceso',
      fecha: new Date().toISOString(),
      usuario,
      motivo: `OT reactivada: ${motivo}`
    }
  ];

  return actualizarOrden(id, {
    estado: 'en_proceso',
    trabajoEnCurso: false,
    tiempoInicioTrabajo: null,
    historialEstados: nuevoHistorial,
    reactivaciones: [
      ...(orden.reactivaciones || []),
      { fecha: new Date().toISOString(), usuario, justificacion: motivo }
    ]
  });
}

export async function marcarListoParaEntrega(id) {
  const orden = await obtenerOrden(id);
  const nuevoHistorial = [
    ...(orden?.historialEstados || []),
    {
      estado: 'listo_entrega',
      fecha: new Date().toISOString(),
      usuario: 'Administración',
      motivo: 'Control de calidad aprobado, listo para que el motorista retire la unidad'
    }
  ];

  return actualizarOrden(id, {
    estado: 'listo_entrega',
    historialEstados: nuevoHistorial
  });
}

export async function cerrarOrden(id, datosCierre) {
  const orden = await obtenerOrden(id);
  const nuevoHistorial = [
    ...(orden?.historialEstados || []),
    {
      estado: 'entregado',
      fecha: new Date().toISOString(),
      usuario: datosCierre.empleadoDespacha || datosCierre.empleadoEntrega || 'Recepción',
      motivo: `Vehículo entregado a: ${datosCierre.personaRetira || 'Conductor'}`
    }
  ];

  return actualizarOrden(id, {
    estado: 'entregado',
    fechaSalida: isFirebaseConfigured && db ? serverTimestamp() : { toDate: () => new Date() },
    personaRetira: datosCierre.personaRetira || '',
    empleadoDespacha: datosCierre.empleadoDespacha || '',
    observacionesFinales: datosCierre.observacionesFinales || '',
    recomendaciones: datosCierre.recomendaciones || '',
    historialEstados: nuevoHistorial
  });
}

export async function eliminarOrden(id) {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, ORDERS_COLLECTION, id));
    contarEscritura();
    registrarBitacora({
      tipo: TIPOS_BITACORA.ORDEN,
      accion: 'eliminar',
      detalle: `Eliminó la orden ${id}`,
      datos: { id },
    });
  } else {
    let orders = getLocalOrders();
    orders = orders.filter(o => o.id !== id);
    saveLocalOrders(orders);
  }
}

export async function buscarPorPlaca(placa) {
  const placaNorm = normalizarPlaca(placa);
  if (isFirebaseConfigured && db) {
    const q = query(collection(db, ORDERS_COLLECTION), where('placa', '==', placaNorm));
    const snapshot = await getDocs(q);
    const ordenes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    contarLectura(aproximarBytes(ordenes));
    return ordenes;
  } else {
    const orders = getLocalOrders();
    return orders.filter(o => normalizarPlaca(o.placa) === placaNorm);
  }
}
