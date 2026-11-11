import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TbTools, TbPlayerPlay, TbPlayerPause, TbCheck, TbAlertTriangle,
  TbUser, TbClock, TbArrowRight, TbCircleCheck, TbPlus, TbX, TbStack2, TbRotateClockwise
} from '../icons';
import {
  actualizarOrden,
  iniciarTrabajo,
  pausarTrabajo,
  finalizarTrabajo,
  iniciarActividad,
  pausarActividad,
  finalizarActividad,
  agregarActividad,
  reactivarOrden,
  formatoOT
} from '../firebase/ordenesService';
import { useToast } from './ToastContext';
import { AREAS_SELECT, opcionesArea } from '../constants/areas';
import { useAuth } from '../context/AuthContext';
import { esColaRecepcion, puedeAsignarPersonal, ordenCompleta, puedeReactivarOrden, puedeCambiarEstadoActividad, apoyosDeOrden } from '../services/permisosService';
import FinalizacionOrdenModal from './FinalizacionOrdenModal';
import ReactivarOrdenModal from './ReactivarOrdenModal';
import ModalPortal from './ModalPortal';

const MOTIVOS_PAUSA = [
  { id: 'esperando_repuestos', label: 'Esperando repuestos de almacén / proveedor' },
  { id: 'pendiente_autorizacion', label: 'Pendiente de autorización de presupuesto' },
  { id: 'inconveniente', label: 'Inconveniente técnico / requiere herramienta especial' },
  { id: 'fin_turno', label: 'Fin de turno o descanso programado' }
];

/**
 * Panel operativo completo de una orden de trabajo:
 * asignación, actividades con estados (Iniciar/Pausar/Listo), cronómetro,
 * pausa global y finalización. Se despliega al tocar una orden (móvil) o
 * dentro de la tarjeta del área de reparación (escritorio).
 */
const AVISO_ESTADOS = 'Solo el encargado de taller, administración o el mecánico asignado a esta OT puede cambiar los estados.';

export default function OrdenOperativa({ orden, todasLasOrdenes = [], mecanicos = [], mostrarFooter = true }) {
  const [modalPausa, setModalPausa] = useState({
    abierto: false,
    orden: null,
    actividadId: null,
    motivo: 'esperando_repuestos',
    observacion: ''
  });

  const [modalNuevaActividad, setModalNuevaActividad] = useState({
    abierto: false,
    ordenId: null,
    placa: '',
    descripcion: '',
    area: AREAS_SELECT[0],
    mecanicoAsignado: '',
    tiempoEstimadoMinutos: 60
  });

  const [modalConcurrencia, setModalConcurrencia] = useState({
    abierto: false,
    mecanico: '',
    ordenActivaPrevia: null,
    accionPendiente: null
  });

  const [modalFinalizacion, setModalFinalizacion] = useState({
    abierto: false,
    orden: null,
    guardando: false
  });

  // Reactivación de una OT finalizada por error (encargado/admin, con justificación)
  const [modalReactivar, setModalReactivar] = useState({ abierto: false, guardando: false });

  // Reloj local: refresca el cronómetro en vivo de esta unidad
  const [ahora, setAhora] = useState(() => Date.now());

  const { addToast, confirm } = useToast();
  const { isAdmin, isMecanico, currentUser } = useAuth();
  const puedeAsignar = puedeAsignarPersonal(currentUser);
  const puedeCambiarEstados = puedeCambiarEstadoActividad(orden, currentUser);

  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(reloj);
  }, []);

  // Verificar si un mecánico ya tiene una labor activa en otra unidad
  const verificarConcurrenciaMecanico = (mecanico, ordenIdActual) => {
    if (!mecanico) return null;
    const ordenEnCurso = todasLasOrdenes.find(o =>
      o.id !== ordenIdActual &&
      (o.mecanicoAsignado === mecanico || (o.actividades || []).some(a => a.mecanicoAsignado === mecanico && a.estado === 'en_proceso')) &&
      (o.estado === 'en_proceso' || o.trabajoEnCurso)
    );
    return ordenEnCurso || null;
  };

  const handleAsignarMecanico = async (campo, valor) => {
    try {
      await actualizarOrden(orden.id, { [campo]: valor });
      const etiqueta = campo === 'mecanicoAsignado2' ? 'Mecánico de apoyo' : 'Mecánico responsable';
      addToast(`${etiqueta}: ${valor || 'sin asignar'}`, 'success');
    } catch (err) {
      console.error(err);
      addToast('Error al asignar mecánico', 'error');
    }
  };

  // Mecánicos de APoyo: una lista con + para agregar más cuando la situación lo amerita
  const slotsApoyo = apoyosDeOrden(orden);
  const slotsVisibles = slotsApoyo.length > 0 ? slotsApoyo : [''];

  const guardarApoyos = async (nuevos) => {
    try {
      const limpios = nuevos.map(v => (v || '').trim());
      await actualizarOrden(orden.id, {
        mecanicosApoyo: limpios,
        // Campo clásico sincronizado con el primer apoyo (compatibilidad)
        mecanicoAsignado2: limpios.find(Boolean) || null
      });
      const lista = limpios.filter(Boolean);
      addToast(lista.length ? `Mecánicos de apoyo: ${lista.join(', ')}` : 'Sin mecánico de apoyo', 'success');
    } catch (err) {
      console.error(err);
      addToast('Error al asignar mecánicos de apoyo', 'error');
    }
  };

  const cambiarApoyo = (i, valor) => guardarApoyos(slotsVisibles.map((a, j) => (j === i ? valor : a)));
  const agregarApoyo = () => guardarApoyos([...slotsVisibles, '']);
  const quitarApoyo = (i) => guardarApoyos(slotsVisibles.filter((_, j) => j !== i));

  const handleIniciarGeneral = async () => {
    if (!puedeCambiarEstados) {
      addToast(AVISO_ESTADOS, 'warning');
      return;
    }
    const conflicto = verificarConcurrenciaMecanico(orden.mecanicoAsignado, orden.id);
    if (conflicto) {
      setModalConcurrencia({
        abierto: true,
        mecanico: orden.mecanicoAsignado,
        ordenActivaPrevia: conflicto,
        accionPendiente: async () => {
          await pausarTrabajo(conflicto.id, Number(conflicto.tiempoRealMinutos) || 0, 'Pausa por reasignación prioritaria');
          await iniciarTrabajo(orden.id);
          addToast(`Labor anterior pausada. Trabajo iniciado en unidad ${orden.placa}`, 'info');
        }
      });
      return;
    }

    try {
      await iniciarTrabajo(orden.id);
      addToast(`Trabajo iniciado en unidad ${orden.placa}`, 'info');
    } catch (err) {
      console.error(err);
      addToast('Error al iniciar trabajo', 'error');
    }
  };

  const abrirModalPausa = (ordenCtx, actividadId = null) => {
    setModalPausa({
      abierto: true,
      orden: ordenCtx,
      actividadId,
      motivo: 'esperando_repuestos',
      observacion: ''
    });
  };

  const cerrarModalPausa = () => {
    setModalPausa({ abierto: false, orden: null, actividadId: null, motivo: 'esperando_repuestos', observacion: '' });
  };

  const confirmarPausa = async () => {
    const { orden: ordenPausa, actividadId, motivo, observacion } = modalPausa;
    if (!ordenPausa) return;

    if (!puedeCambiarEstados) {
      cerrarModalPausa();
      addToast(AVISO_ESTADOS, 'warning');
      return;
    }

    try {
      if (actividadId) {
        await pausarActividad(ordenPausa.id, actividadId, motivo, observacion);
        addToast(`Actividad pausada: ${motivo === 'esperando_repuestos' ? 'Esperando repuestos' : motivo}`, 'warning');
      } else {
        // El servicio calcula los minutos reales transcurridos desde el inicio del tramo
        await pausarTrabajo(ordenPausa.id, Number(ordenPausa.tiempoRealMinutos) || 0, motivo);
        addToast(`Trabajo pausado para ${ordenPausa.placa} (${motivo})`, 'warning');
      }
      cerrarModalPausa();
    } catch (err) {
      console.error(err);
      addToast('Error al pausar: ' + err.message, 'error');
    }
  };

  const handleFinalizarGeneral = () => {
    if (!puedeCambiarEstados) {
      addToast(AVISO_ESTADOS, 'warning');
      return;
    }
    // El mecánico solo puede cerrar una OT COMPLETA (todas las actividades finalizadas);
    // una OT incompleta solo la cierra el encargado/administración con justificación.
    if (isMecanico && !ordenCompleta(orden)) {
      const pendientes = (orden.actividades || []).filter(a => a.estado !== 'finalizado').length;
      addToast(
        `No puedes cerrar la OT: quedan ${pendientes} actividad(es) pendiente(s). Solo el encargado de taller puede cerrarla con justificación.`,
        'warning'
      );
      return;
    }
    // El mecánico debe registrar el trabajo realizado y el vale de bodega antes de cerrar
    setModalFinalizacion({ abierto: true, orden, guardando: false });
  };

  const handleReactivar = async (justificacion) => {
    setModalReactivar(prev => ({ ...prev, guardando: true }));
    try {
      await reactivarOrden(orden.id, currentUser?.nombre || 'Taller', justificacion);
      setModalReactivar({ abierto: false, guardando: false });
      addToast(`OT ${formatoOT(orden)} reactivada: la unidad ${orden.placa} volvió a En Proceso y sale de Entrega de Vehículo.`, 'success');
    } catch (err) {
      console.error(err);
      addToast('Error al reactivar: ' + err.message, 'error');
      setModalReactivar(prev => ({ ...prev, guardando: false }));
    }
  };

  const confirmarFinalizacion = async (detalle) => {
    const ordenFin = modalFinalizacion.orden;
    if (!ordenFin) return;
    setModalFinalizacion(prev => ({ ...prev, guardando: true }));
    try {
      // El servicio calcula el tiempo real total (acumulado + tramo en curso)
      await finalizarTrabajo(ordenFin.id, Number(ordenFin.tiempoRealMinutos) || 0, detalle);
      setModalFinalizacion({ abierto: false, orden: null, guardando: false });
      addToast(`Orden de ${ordenFin.placa} finalizada y lista para entrega.`, 'success');
    } catch (err) {
      console.error(err);
      addToast('Error al finalizar trabajo: ' + err.message, 'error');
      setModalFinalizacion(prev => ({ ...prev, guardando: false }));
    }
  };

  // Acciones sobre sub-actividades con control estricto de secuencia
  const handleIniciarSubActividad = async (act, actIndex = null) => {
    if (!puedeCambiarEstados) {
      addToast(AVISO_ESTADOS, 'warning');
      return;
    }
    // 1. Control de secuencia: verificar si la actividad previa ya concluyó
    const idx = actIndex !== null ? actIndex : actividades.findIndex(a => a.id === act.id);
    if (idx > 0) {
      const actPrevia = actividades[idx - 1];
      if (actPrevia && actPrevia.estado !== 'finalizado') {
        addToast(
          `Control de secuencia: No es posible avanzar sin haber concluido el trabajo previo (#${idx}: "${actPrevia.descripcion}").`,
          'warning'
        );
        return;
      }
    }

    // 2. Control de concurrencia interna: no permitir múltiples actividades en curso simultáneas en la misma OT
    const otraActEnCurso = actividades.find(a => a.id !== act.id && a.estado === 'en_proceso');
    if (otraActEnCurso) {
      addToast(
        `Ya se encuentra en curso la actividad #${actividades.findIndex(a => a.id === otraActEnCurso.id) + 1} ("${otraActEnCurso.descripcion}"). Debe pausarla o finalizarla antes de iniciar otra.`,
        'warning'
      );
      return;
    }

    const responsable = act.mecanicoAsignado || orden.mecanicoAsignado;
    const conflicto = verificarConcurrenciaMecanico(responsable, orden.id);
    if (conflicto) {
      setModalConcurrencia({
        abierto: true,
        mecanico: responsable,
        ordenActivaPrevia: conflicto,
        accionPendiente: async () => {
          await pausarTrabajo(conflicto.id, Number(conflicto.tiempoRealMinutos) || 0, 'Pausa por cambio de actividad');
          await iniciarActividad(orden.id, act.id, responsable);
          addToast(`Actividad iniciada: ${act.descripcion}`, 'info');
        }
      });
      return;
    }

    try {
      await iniciarActividad(orden.id, act.id, responsable);
      addToast(`Actividad iniciada: ${act.descripcion}`, 'info');
    } catch (err) {
      console.error(err);
      addToast('Error al iniciar actividad: ' + err.message, 'error');
    }
  };

  const handleFinalizarSubActividad = async (act) => {
    if (!puedeCambiarEstados) {
      addToast(AVISO_ESTADOS, 'warning');
      return;
    }
    try {
      await finalizarActividad(orden.id, act.id, 'Actividad técnica completada a satisfacción');
      addToast(`Actividad concluida: ${act.descripcion}`, 'success');
    } catch (err) {
      console.error(err);
      addToast('Error al finalizar actividad: ' + err.message, 'error');
    }
  };

  const handleCrearNuevaActividad = async (e) => {
    e.preventDefault();
    const { ordenId, descripcion, area, mecanicoAsignado, tiempoEstimadoMinutos } = modalNuevaActividad;
    if (!descripcion.trim()) {
      addToast('La descripción de la actividad es requerida', 'warning');
      return;
    }
    const mins = Number(tiempoEstimadoMinutos);
    if (isNaN(mins) || mins <= 0 || mins > 10000) {
      addToast('El tiempo estimado debe ser un número entero de minutos mayor a cero.', 'warning');
      return;
    }

    // Confirmación previa: la actividad se agrega a la orden del taller.
    const confirmado = await confirm({
      title: '¿Añadir actividad a la orden?',
      message: `Se agregará "${descripcion.trim()}" a la orden (${mins} min estimados).`,
      confirmText: 'Sí, añadir actividad',
      cancelText: 'Cancelar',
      danger: false
    });
    if (!confirmado) return;

    try {
      await agregarActividad(ordenId, {
        descripcion: descripcion.trim(),
        area,
        mecanicoAsignado,
        tiempoEstimadoMinutos: mins
      });
      addToast('Nueva actividad añadida a la orden de trabajo', 'success');
      setModalNuevaActividad({
        abierto: false,
        ordenId: null,
        placa: '',
        descripcion: '',
        area: AREAS_SELECT[0],
        mecanicoAsignado: '',
        tiempoEstimadoMinutos: 60
      });
    } catch (err) {
      console.error(err);
      addToast('Error al agregar actividad: ' + err.message, 'error');
    }
  };

  // Cálculos de tiempo
  const horasEst = Number(orden.tiempoEstimadoHoras || 0);
  const minutosEstimados = horasEst * 60;
  let minutosTramo = 0;
  if (orden.trabajoEnCurso && orden.tiempoInicioTrabajo) {
    const inicio = typeof orden.tiempoInicioTrabajo?.toDate === 'function'
      ? orden.tiempoInicioTrabajo.toDate().getTime()
      : Date.parse(orden.tiempoInicioTrabajo);
    if (Number.isFinite(inicio)) {
      minutosTramo = Math.max(0, Math.round((ahora - inicio) / 60000));
    }
  }
  const minutosReales = Number(orden.tiempoRealMinutos || 0) + minutosTramo;
  const porcentajeProgreso = minutosEstimados > 0 ? Math.min(Math.round((minutosReales / minutosEstimados) * 100), 100) : 0;
  const enCurso = orden.trabajoEnCurso || orden.estado === 'en_proceso';
  const actividades = orden.actividades || [];

  return (
    <>
      {/* Área de trabajo y costos (solo administración) */}
      <div className="order-card-info" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <TbTools className="icon" />
          <span>Área: <strong>{orden.areaPrincipal}</strong> ({orden.tipoTrabajo})</span>
        </div>
        {isAdmin && (
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#22c55e' }}>
            ${(Number(orden.costoTotal) || (Number(orden.costoRepuestos) || 0) + (Number(orden.costoManoObra) || 0)).toFixed(2)}
          </span>
        )}
      </div>

      {/* Asignación de personal / autoasignación de unidad */}
      {esColaRecepcion(orden) && isMecanico ? (
        <div className="order-card-info" style={{ marginBottom: 12 }}>
          <TbUser className="icon" />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ flex: 1, gap: 6 }}
            onClick={() => handleAsignarMecanico('mecanicoAsignado', currentUser.nombre)}
            title="Tomar esta unidad de la cola de recepción para trabajarla"
          >
            <TbCircleCheck /> Autoasignarme esta unidad
          </button>
        </div>
      ) : puedeAsignar ? (
        <div style={{ marginBottom: 12 }}>
          <div className="order-card-info" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
            <TbUser className="icon" style={{ marginTop: 4 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>Mecánico Responsable:</div>
              <select
                className="form-select"
                style={{ padding: '6px 10px', fontSize: 13 }}
                value={orden.mecanicoAsignado || ''}
                onChange={(e) => handleAsignarMecanico('mecanicoAsignado', e.target.value)}
              >
                <option value="">Seleccionar mecánico responsable...</option>
                {mecanicos.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="order-card-info" style={{ alignItems: 'flex-start' }}>
            <TbUser className="icon" style={{ marginTop: 4 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Mecánicos de Apoyo ({slotsVisibles.length}) — opcional
                </span>
                <button
                  type="button"
                  onClick={agregarApoyo}
                  title="Agregar otro mecánico de apoyo"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 13, padding: '1px 9px', lineHeight: 1.4, gap: 3 }}
                >
                  <TbPlus /> Apoyo
                </button>
              </div>

              {slotsVisibles.map((valor, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <select
                    className="form-select"
                    style={{ padding: '6px 10px', fontSize: 13, flex: 1 }}
                    value={valor}
                    onChange={(e) => cambiarApoyo(i, e.target.value)}
                  >
                    <option value="">{slotsVisibles.length > 1 ? `Sin apoyo #${i + 1}` : 'Sin mecánico de apoyo'}</option>
                    {mecanicos
                      .filter((m) => m !== orden.mecanicoAsignado && !slotsApoyo.filter((_, j) => j !== i).includes(m))
                      .map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                  </select>
                  {slotsVisibles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitarApoyo(i)}
                      title="Quitar este mecánico de apoyo"
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#ef4444',
                        borderRadius: 4,
                        width: 28,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        flexShrink: 0
                      }}
                    >
                      <TbX size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="order-card-info" style={{ marginBottom: 12, fontSize: 12 }}>
          <TbUser className="icon" />
          <span>
            {esColaRecepcion(orden)
              ? <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>Pendiente de asignación en recepción</span>
              : <>
                <strong>{orden.mecanicoAsignado === currentUser.nombre ? 'Tú eres el responsable' : `Responsable: ${orden.mecanicoAsignado || 'Sin asignar'}`}</strong>
                {slotsApoyo.filter(Boolean).length > 0 ? (
                  <span style={{ color: 'var(--color-text-muted)' }}> • Apoyo: {slotsApoyo.filter(Boolean).join(', ')}</span>
                ) : null}
              </>}
          </span>
        </div>
      )}

      {/* DESGLOSE DE ACTIVIDADES TÉCNICAS (una fila por actividad) */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 10,
        marginBottom: 12
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
            <TbStack2 /> Actividades de Reparación ({actividades.length})
          </span>
          {puedeAsignar && (
            <button
              type="button"
              onClick={() => setModalNuevaActividad({
                abierto: true,
                ordenId: orden.id,
                placa: orden.placa,
                descripcion: '',
                area: orden.areaPrincipal || AREAS_SELECT[0],
                mecanicoAsignado: orden.mecanicoAsignado || '',
                tiempoEstimadoMinutos: 60
              })}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11, padding: '2px 8px', gap: 4 }}
            >
              <TbPlus /> Actividad
            </button>
          )}
        </div>

        {actividades.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
            Trabajo global registrado: {orden.diagnosticoInicial || 'Mantenimiento preventivo general'}.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {actividades.map((act, actIndex) => {
              const actEnCurso = act.estado === 'en_proceso';
              const actPausada = act.estado === 'pausado';
              const actFinalizada = act.estado === 'finalizado';

              // Control de secuencia: verificar si la tarea anterior concluyó
              const esPrimeraActividad = actIndex === 0;
              const previaFinalizada = esPrimeraActividad || actividades[actIndex - 1]?.estado === 'finalizado';
              // Concurrencia interna: si ya hay alguna tarea en proceso en esta misma orden
              const hayOtraEnCurso = actividades.some(a => a.id !== act.id && a.estado === 'en_proceso');
              const iniciarBloqueado = !previaFinalizada || hayOtraEnCurso || !puedeCambiarEstados;
              const motivoBloqueo = !puedeCambiarEstados
                ? AVISO_ESTADOS
                : !previaFinalizada
                  ? `Debe finalizar la actividad previa (#${actIndex}: ${actividades[actIndex - 1]?.descripcion}) antes de iniciar esta labor`
                  : hayOtraEnCurso
                    ? 'Ya existe una actividad en curso en esta orden. Finalícela o páusela para iniciar otra'
                    : 'Iniciar cronometraje de esta tarea';

              return (
                <div
                  key={act.id}
                  title={`${act.mecanicoAsignado ? `${act.mecanicoAsignado} • ` : ''}${act.motivoPausa ? `Pausa: ${act.motivoPausa === 'esperando_repuestos' ? 'Esperando repuestos' : act.motivoPausa} • ` : ''}${act.descripcion}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    background: actEnCurso ? 'rgba(134,153,46,0.09)' : 'var(--color-bg-input)',
                    border: `1px solid ${actEnCurso ? 'rgba(134,153,46,0.32)' : actPausada ? 'rgba(245, 158, 11, 0.35)' : 'var(--color-border)'}`,
                    borderRadius: 6,
                    padding: '5px 8px',
                    fontSize: 12,
                    minHeight: 34
                  }}
                >
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 800,
                    color: actEnCurso ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    background: actEnCurso ? 'rgba(134,153,46,0.14)' : 'rgba(255,255,255,0.05)',
                    borderRadius: 4,
                    padding: '2px 5px',
                    flexShrink: 0
                  }}>
                    #{actIndex + 1}
                  </span>

                  <span
                    style={{
                      flex: '1 1 160px',
                      minWidth: 0,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: actFinalizada ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                      textDecoration: actFinalizada ? 'line-through' : 'none'
                    }}
                  >
                    {act.descripcion}
                  </span>

                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <TbUser size={11} /> {act.mecanicoAsignado || 'Sin asignar'}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <TbClock size={11} /> Est {act.tiempoEstimadoMinutos || 60}m{act.tiempoRealMinutos > 0 ? ` · Real ${act.tiempoRealMinutos}m` : ''}
                  </span>
                  <span className={`badge badge-${act.estado}`} style={{ fontSize: 9, padding: '2px 6px', flexShrink: 0 }}>
                    {act.estado}
                  </span>

                  {!actFinalizada && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {!actEnCurso ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={iniciarBloqueado}
                          style={{
                            fontSize: 10,
                            padding: '2px 8px',
                            gap: 3,
                            opacity: iniciarBloqueado ? 0.45 : 1,
                            cursor: iniciarBloqueado ? 'not-allowed' : 'pointer'
                          }}
                          onClick={() => handleIniciarSubActividad(act, actIndex)}
                          title={motivoBloqueo}
                        >
                          <TbPlayerPlay /> Iniciar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={!puedeCambiarEstados}
                          style={{ fontSize: 10, padding: '2px 8px', gap: 3, color: '#f59e0b', borderColor: '#f59e0b', opacity: !puedeCambiarEstados ? 0.45 : 1, cursor: !puedeCambiarEstados ? 'not-allowed' : 'pointer' }}
                          onClick={() => abrirModalPausa(orden, act.id)}
                          title={!puedeCambiarEstados ? AVISO_ESTADOS : 'Pausar actividad con motivo justificado'}
                        >
                          <TbPlayerPause /> Pausar
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        disabled={!puedeCambiarEstados}
                        style={{ fontSize: 10, padding: '2px 8px', gap: 3, opacity: !puedeCambiarEstados ? 0.45 : 1, cursor: !puedeCambiarEstados ? 'not-allowed' : 'pointer' }}
                        onClick={() => handleFinalizarSubActividad(act)}
                        title={!puedeCambiarEstados ? AVISO_ESTADOS : 'Marcar actividad completada'}
                      >
                        <TbCheck /> Listo
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Panel Cronométrico General y Acciones */}
      <div style={{
        background: 'var(--color-bg-input)',
        borderRadius: 'var(--radius-md)',
        padding: 12,
        border: '1px solid var(--color-border)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
          <span>Tiempo Estimado: <strong style={{ fontFamily: 'var(--font-mono)' }}>{horasEst}h ({minutosEstimados} min)</strong></span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {minutosTramo > 0 && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--color-accent)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)', display: 'inline-block' }} />
                +{minutosTramo} min en curso
              </span>
            )}
            Registrado: <strong style={{ fontFamily: 'var(--font-mono)', color: minutosReales > minutosEstimados && minutosEstimados > 0 ? '#ef4444' : '#22c55e' }}>{minutosReales} min</strong>
          </span>
        </div>

        {/* Barra de progreso de tiempo */}
        <div style={{
          width: '100%',
          height: 6,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 10
        }}>
          <div style={{
            width: `${porcentajeProgreso}%`,
            height: '100%',
            background: enCurso ? 'var(--color-en-proceso)' : (porcentajeProgreso > 90 ? '#ef4444' : 'var(--color-accent)'),
            transition: 'width 0.4s ease'
          }} />
        </div>

        {!puedeCambiarEstados && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', width: '100%', marginBottom: 8 }}>
            {AVISO_ESTADOS}
          </div>
        )}

        {esColaRecepcion(orden) ? (
          <div style={{ fontSize: 12, color: 'var(--color-accent)', fontWeight: 600, textAlign: 'center', width: '100%' }}>
            {isMecanico
              ? 'Autoasigna esta unidad para poder iniciar el trabajo.'
              : 'Asigna un mecánico responsable para poder iniciar el trabajo.'}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {orden.estado !== 'en_proceso' && orden.estado !== 'finalizado' && orden.estado !== 'listo_entrega' && orden.estado !== 'entregado' && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!puedeCambiarEstados}
                style={{ flex: 1, minWidth: 120, opacity: !puedeCambiarEstados ? 0.45 : 1 }}
                onClick={handleIniciarGeneral}
                title={!puedeCambiarEstados ? AVISO_ESTADOS : 'Iniciar el cronómetro general de esta OT'}
              >
                <TbPlayerPlay /> Iniciar Todo
              </button>
            )}

            {orden.estado === 'en_proceso' && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={!puedeCambiarEstados}
                style={{ flex: 1, minWidth: 120, color: 'var(--color-ingresado)', borderColor: 'var(--color-border-active)', opacity: !puedeCambiarEstados ? 0.45 : 1 }}
                onClick={() => abrirModalPausa(orden, null)}
                title={!puedeCambiarEstados ? AVISO_ESTADOS : 'Pausar el trabajo general de esta OT'}
              >
                <TbPlayerPause /> Pausar Trabajo
              </button>
            )}

            {orden.estado !== 'finalizado' && orden.estado !== 'listo_entrega' && orden.estado !== 'entregado' && (
              <button
                type="button"
                className="btn btn-sm btn-success"
                disabled={!puedeCambiarEstados}
                style={{ flex: 1, minWidth: 120, opacity: !puedeCambiarEstados ? 0.45 : 1 }}
                onClick={handleFinalizarGeneral}
                title={!puedeCambiarEstados ? AVISO_ESTADOS : 'Finalizar esta orden de trabajo'}
              >
                <TbCheck /> Finalizar
              </button>
            )}

            {/* Reactivar OT finalizada por error — solo encargado / administración */}
            {(orden.estado === 'finalizado' || orden.estado === 'listo_entrega') && puedeReactivarOrden(currentUser) && (
              <button
                type="button"
                className="btn btn-sm btn-warning"
                style={{ flex: 1, minWidth: 120, color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.5)' }}
                onClick={() => setModalReactivar({ abierto: true, guardando: false })}
                title="Reabrir esta OT si hubo un error (requiere justificación)"
              >
                <TbRotateClockwise /> Reactivar OT
              </button>
            )}
          </div>
        )}
      </div>

      {orden.diagnosticoInicial && (
        <div style={{
          fontSize: 12,
          color: 'var(--color-text-muted)',
          marginTop: 8,
          background: 'rgba(255,255,255,0.02)',
          padding: 8,
          borderRadius: 'var(--radius-sm)'
        }}>
          <strong style={{ color: 'var(--color-text-secondary)' }}>Falla reportada:</strong> {orden.diagnosticoInicial.slice(0, 95)}...
        </div>
      )}

      {(orden.trabajoRealizado || orden.valeBodega || orden.detalleRepuestos) && (
        <div style={{
          fontSize: 12,
          marginTop: 8,
          background: 'rgba(34, 197, 94, 0.07)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          padding: 8,
          borderRadius: 'var(--radius-sm)'
        }}>
          <strong style={{ color: '#22c55e' }}>Trabajo finalizado:</strong> {orden.trabajoRealizado}
          {orden.valeBodega && (
            <div style={{ marginTop: 3, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
              Vale de bodega: {orden.valeBodega}
            </div>
          )}
          {orden.detalleRepuestos && (
            <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 11, color: 'var(--color-text-secondary)' }}>
              {orden.detalleRepuestos}
            </div>
          )}
        </div>
      )}

      {mostrarFooter && (
        <div className="order-card-footer" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10, marginTop: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            {formatoOT(orden)}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Link to={`/ordenes/${orden.id}`} className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '4px 8px' }}>
              Ver Ficha <TbArrowRight />
            </Link>
          </div>
        </div>
      )}

      {/* MODAL DE PAUSA CON MOTIVO Y OBSERVACIONES */}
      {modalPausa.abierto && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content" style={{ maxWidth: 480 }}>
              <div className="modal-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b' }}>
                  <TbPlayerPause /> Registrar Pausa de Trabajo
                </h3>
                <button type="button" className="btn-icon" onClick={cerrarModalPausa}>
                  <TbX />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                  Indique el motivo técnico por el cual se detiene la labor en la unidad <strong>{modalPausa.orden?.placa}</strong>. El tiempo en pausa no será contabilizado como labor efectiva.
                </p>

                <div className="form-group" style={{ marginBottom: 22 }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 8, fontWeight: 700 }}>
                    Causa de la Pausa *
                  </label>
                  <select
                    className="form-select"
                    value={modalPausa.motivo}
                    onChange={(e) => setModalPausa(prev => ({ ...prev, motivo: e.target.value }))}
                  >
                    {MOTIVOS_PAUSA.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 8, fontWeight: 700 }}>
                    Detalle u Observación del Mecánico
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={modalPausa.observacion}
                    onChange={(e) => setModalPausa(prev => ({ ...prev, observacion: e.target.value }))}
                    placeholder="Motivo de la pausa operativa (falta de repuestos, autorización, etc.)..."
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={cerrarModalPausa}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-warning" onClick={confirmarPausa}>
                  Confirmar Pausa
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL DE AGREGAR SUB-ACTIVIDAD */}
      {modalNuevaActividad.abierto && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content" style={{ maxWidth: 500 }}>
              <div className="modal-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TbPlus /> Nueva Actividad para {modalNuevaActividad.placa}
                </h3>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setModalNuevaActividad(prev => ({ ...prev, abierto: false }))}
                >
                  <TbX />
                </button>
              </div>
              <form onSubmit={handleCrearNuevaActividad}>
                <div className="modal-body">
                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 8, fontWeight: 700 }}>
                      Descripción de la Actividad *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="Descripción técnica de la tarea a realizar..."
                      value={modalNuevaActividad.descripcion}
                      onChange={(e) => setModalNuevaActividad(prev => ({ ...prev, descripcion: e.target.value }))}
                    />
                  </div>

                  <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'block', marginBottom: 8, fontWeight: 700 }}>
                        Área Mecánica
                      </label>
                      <select
                        className="form-select"
                        value={modalNuevaActividad.area}
                        onChange={(e) => setModalNuevaActividad(prev => ({ ...prev, area: e.target.value }))}
                      >
                        {opcionesArea(modalNuevaActividad.area).map(a => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'block', marginBottom: 8, fontWeight: 700 }}>
                        Minutos Estimados
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        min="10"
                        step="5"
                        value={modalNuevaActividad.tiempoEstimadoMinutos}
                        onChange={(e) => setModalNuevaActividad(prev => ({ ...prev, tiempoEstimadoMinutos: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 8, fontWeight: 700 }}>
                      Mecánico Asignado
                    </label>
                    <select
                      className="form-select"
                      value={modalNuevaActividad.mecanicoAsignado}
                      onChange={(e) => setModalNuevaActividad(prev => ({ ...prev, mecanicoAsignado: e.target.value }))}
                    >
                      <option value="">Seleccionar técnico...</option>
                      {mecanicos.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setModalNuevaActividad(prev => ({ ...prev, abierto: false }))}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Añadir Actividad
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL DE ADVERTENCIA DE CONCURRENCIA DE MECÁNICOS */}
      {modalConcurrencia.abierto && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content" style={{ maxWidth: 480, border: '1px solid #ef4444' }}>
              <div className="modal-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444' }}>
                  <TbAlertTriangle /> Alerta de Concurrencia de Mecánico
                </h3>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setModalConcurrencia({ abierto: false, mecanico: '', ordenActivaPrevia: null, accionPendiente: null })}
                >
                  <TbX />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)' }}>
                  El técnico <strong>{modalConcurrencia.mecanico}</strong> actualmente tiene un trabajo activo en ejecución en la unidad <strong>{modalConcurrencia.ordenActivaPrevia?.placa}</strong>.
                </p>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 6, fontSize: 12, color: 'var(--color-text-secondary)', borderLeft: '3px solid #ef4444', marginTop: 10 }}>
                  Para garantizar la integridad del cómputo de horas hombre y evitar registros de tiempo dobles simultáneos, se debe pausar la labor previa antes de iniciar la nueva.
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalConcurrencia({ abierto: false, mecanico: '', ordenActivaPrevia: null, accionPendiente: null })}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={async () => {
                    if (modalConcurrencia.accionPendiente) {
                      await modalConcurrencia.accionPendiente();
                    }
                    setModalConcurrencia({ abierto: false, mecanico: '', ordenActivaPrevia: null, accionPendiente: null });
                  }}
                >
                  Pausar Labor Previa e Iniciar Ésta
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Formulario de Finalización de Orden de Trabajo */}
      <div onClick={(e) => e.stopPropagation()}>
        <FinalizacionOrdenModal
          isOpen={modalFinalizacion.abierto}
          onClose={() => setModalFinalizacion(prev => ({ ...prev, abierto: false }))}
          orden={modalFinalizacion.orden}
          onConfirmar={confirmarFinalizacion}
          guardando={modalFinalizacion.guardando}
          incompleta={!ordenCompleta(orden)}
        />
        {/* Reactivación de OT finalizada por error */}
        <ReactivarOrdenModal
          isOpen={modalReactivar.abierto}
          onClose={() => setModalReactivar(prev => ({ ...prev, abierto: false }))}
          orden={orden}
          onConfirmar={handleReactivar}
          guardando={modalReactivar.guardando}
        />
      </div>
    </>
  );
}
