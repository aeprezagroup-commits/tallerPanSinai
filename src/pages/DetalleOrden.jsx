import BotonVolver from '../components/BotonVolver';
import { useState, useEffect, useCallback, useRef } from 'react';
import { normalizarPlaca } from '../utils/placas';
import { useParams, useNavigate } from 'react-router-dom';
import {
  TbPencil,
  TbTrash,
  TbUser,
  TbUpload,
  TbCircleCheck,
  TbPrinter,
  TbShieldCheck,
  TbMapPin,
  TbLock,
  TbX,
} from '../icons';
import { obtenerOrden, actualizarOrden, eliminarOrden, cambiarEstado, finalizarTrabajo, reactivarOrden, TRANSICIONES_VALIDAS, formatoOT } from '../firebase/ordenesService';
import { obtenerFotosBase, guardarFotosBase } from '../services/fotosVehiculoService';
import { useToast } from '../components/ToastContext';
import { useAuth } from '../context/AuthContext';
import { puedeVerOrden, puedeModificarOrden, ordenCompleta, puedeReactivarOrden, puedeCambiarEstadoActividad, apoyosDeOrden } from '../services/permisosService';
import { obtenerMecanicosActivos } from '../services/usuariosService';
import { DEPARTAMENTOS_EL_SALVADOR, RUTAS_PREDETERMINADAS } from '../services/vehiculosService';
import { opcionesArea } from '../constants/areas';
import StatusBadge from '../components/StatusBadge';
import InspectionCertificateModal from '../components/InspectionCertificateModal';
import FinalizacionOrdenModal from '../components/FinalizacionOrdenModal';
import ReactivarOrdenModal from '../components/ReactivarOrdenModal';
import ModalPortal from '../components/ModalPortal';
import IconoMascara from '../components/IconoMascara';
import CameraModal from '../components/CameraModal';

const LADOS_FICHA = [
  { key: 'frontal', num: 1, label: 'Frontal', tag: 'Frente', vacio: 'Sin foto frontal' },
  { key: 'lateralIzquierdo', num: 2, label: 'Lateral Izq.', tag: 'Conductor', vacio: 'Sin foto lateral izq.' },
  { key: 'lateralDerecho', num: 3, label: 'Lateral Der.', tag: 'Acompañante', vacio: 'Sin foto lateral der.' },
  { key: 'trasera', num: 4, label: 'Trasera', tag: 'Posterior', vacio: 'Sin foto trasera' }
];

const docsDesdeLegacy = (f) => {
  if (Array.isArray(f?.facturas)) return f.facturas;
  const provs = (Array.isArray(f?.proveedores) && f.proveedores.length)
    ? f.proveedores
    : (f?.proveedor || f?.dte ? [{ nombre: f.proveedor || '', dte: f.dte || '' }] : []);
  const detalle = f?.detalleRepuestos || '';
  const total = f?.costoRepuestos || '';
  const vale = f?.valeAlmacen || f?.valeBodega || '';
  if (!provs.length && !detalle && !total && !vale) return [];
  const docs = provs.map((p, idx) => ({
    tipo: 'proveedor',
    proveedor: p.nombre || '',
    dte: p.dte || '',
    vale: '',
    detalle: idx === 0 ? detalle : '',
    total: idx === 0 ? total : ''
  }));
  if (vale) docs.push({ tipo: 'almacen', proveedor: '', dte: '', vale, detalle: provs.length ? '' : detalle, total: provs.length ? '' : total });
  if (!docs.length) docs.push({ tipo: 'almacen', proveedor: '', dte: '', vale: '', detalle, total });
  return docs;
};

export default function DetalleOrden() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast, confirm } = useToast();
  const { currentUser, isAdmin } = useAuth();
  const puedeModificar = puedeModificarOrden(currentUser);
  const [mecanicos] = useState(() => obtenerMecanicosActivos());

  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [formEdit, setFormEdit] = useState({});
  const [isCertOpen, setIsCertOpen] = useState(false);
  const [isFinalizacionOpen, setIsFinalizacionOpen] = useState(false);
  const [guardandoFinalizacion, setGuardandoFinalizacion] = useState(false);
  const [isReactivarOpen, setIsReactivarOpen] = useState(false);
  const [guardandoReactivar, setGuardandoReactivar] = useState(false);
  const [modalTransicion, setModalTransicion] = useState({
    abierto: false,
    nuevoEstado: '',
    etiqueta: '',
    motivo: '',
    guardando: false
  });
  const [fotosBase, setFotosBase] = useState(null);
  const [ladoPendiente, setLadoPendiente] = useState(null);
  const baseInputRef = useRef(null);
  const [camaraLado, setCamaraLado] = useState('');

  useEffect(() => {
    let cancelado = false;
    if (orden?.placa) {
      obtenerFotosBase(orden.placa)
        .then(base => { if (!cancelado) setFotosBase(base); })
        .catch(err => console.warn('Error cargando base fotográfica:', err));
    }
    return () => { cancelado = true; };
  }, [orden?.placa]);

  const actualizarFotoBase = (lado, desdeCamara = false) => {
    setLadoPendiente(lado);
    const inp = baseInputRef.current;
    if (!inp) return;
    inp.value = '';
    if (desdeCamara) inp.setAttribute('capture', 'environment');
    else inp.removeAttribute('capture');
    inp.click();
  };

  const procesarArchivoBase = async (lado, file) => {
    if (!file || !orden?.placa || !lado) return;
    try {
      const { registro: nuevo, errores } = await guardarFotosBase(
        orden.placa,
        { [lado]: file },
        currentUser?.nombre || ''
      );
      setFotosBase(nuevo);
      if (errores.length > 0) {
        addToast(
          `No se pudo subir: ${errores.join(', ')}. Se conservó la foto anterior.`,
          'error',
          7000
        );
      } else {
        addToast('Base fotográfica del vehículo actualizada', 'success');
      }
    } catch (err) {
      console.error(err);
      addToast('Error al actualizar la foto: ' + err.message, 'error');
    }
  };

  const handleArchivoBase = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !orden?.placa || !ladoPendiente) return;
    await procesarArchivoBase(ladoPendiente, file);
  };

  const cargarOrden = useCallback(async () => {
    try {
      const data = await obtenerOrden(id);
      if (data) {
        setOrden(data);
        setFormEdit(data);
      } else {
        addToast('Orden no encontrada', 'error');
        navigate('/ordenes');
      }
    } catch (err) {
      console.error(err);
      addToast('Error al cargar la orden', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, addToast]);

  useEffect(() => {
    cargarOrden();
  }, [cargarOrden]);

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setFormEdit(prev => ({ ...prev, [name]: value }));
  };

  const apoyosForm = (Array.isArray(formEdit.mecanicosApoyo) && formEdit.mecanicosApoyo.length > 0)
    ? formEdit.mecanicosApoyo
    : (formEdit.mecanicoAsignado2 ? [formEdit.mecanicoAsignado2] : []);
  const slotsApoyoForm = apoyosForm.length > 0 ? apoyosForm : [''];
  const setApoyosForm = (nuevos) => setFormEdit(prev => ({
    ...prev,
    mecanicosApoyo: nuevos,
    mecanicoAsignado2: nuevos.find(Boolean) || null
  }));
  const cambiarApoyoForm = (i, valor) => setApoyosForm(slotsApoyoForm.map((a, j) => (j === i ? valor : a)));
  const agregarApoyoForm = () => setApoyosForm([...slotsApoyoForm, '']);
  const quitarApoyoForm = (i) => setApoyosForm(slotsApoyoForm.filter((_, j) => j !== i));

  const docsForm = docsDesdeLegacy(formEdit);
  const sumaDocs = docsForm.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);
  const agregarDoc = (tipo) => setFormEdit(prev => ({
    ...prev,
    facturas: [...docsForm, tipo === 'almacen'
      ? { tipo: 'almacen', proveedor: '', dte: '', vale: '', detalle: '', total: '' }
      : { tipo: 'proveedor', proveedor: '', dte: '', vale: '', detalle: '', total: '' }]
  }));
  const cambiarDoc = (i, campo, valor) => setFormEdit(prev => ({
    ...prev,
    facturas: docsForm.map((d, j) => (j === i ? { ...d, [campo]: valor } : d))
  }));
  const quitarDoc = (i) => setFormEdit(prev => ({
    ...prev,
    facturas: docsForm.filter((_, j) => j !== i)
  }));

  const handleGuardar = async () => {
    const placaNorm = normalizarPlaca(formEdit.placa);
    const marcaNorm = (formEdit.marca || '').trim();
    const modeloNorm = (formEdit.modelo || '').trim();

    if (!placaNorm || placaNorm.length < 3) {
      addToast('La placa del vehículo es obligatoria (mínimo 3 caracteres).', 'error');
      return;
    }
    if (!marcaNorm) {
      addToast('La marca del vehículo es obligatoria.', 'error');
      return;
    }
    if (!modeloNorm) {
      addToast('El modelo del vehículo es obligatorio.', 'error');
      return;
    }

    if (formEdit.anio) {
      const anioNum = parseInt(formEdit.anio, 10);
      const anioMax = new Date().getFullYear() + 1;
      if (isNaN(anioNum) || anioNum < 1970 || anioNum > anioMax) {
        addToast(`El año debe ser un valor válido entre 1970 y ${anioMax}`, 'error');
        return;
      }
    }

    if (formEdit.kilometraje !== '' && formEdit.kilometraje !== null && formEdit.kilometraje !== undefined) {
      const kmNum = Number(formEdit.kilometraje);
      if (isNaN(kmNum) || kmNum < 0) {
        addToast('El kilometraje debe ser un número positivo mayor o igual a 0', 'error');
        return;
      }
    }

    if (isAdmin && formEdit.costoManoObra !== '' && parseFloat(formEdit.costoManoObra) < 0) {
      addToast('El costo de mano de obra no puede ser una cifra negativa', 'error');
      return;
    }

    const confirmadoEdicion = await confirm({
      title: '¿Guardar cambios de la orden?',
      message: `Se actualizará la orden ${formatoOT(orden)} (${orden?.placa || 'unidad'}) con los datos modificados.`,
      confirmText: 'Sí, guardar cambios',
      cancelText: 'Cancelar',
      danger: false
    });
    if (!confirmadoEdicion) return;

    try {
      const cMo = Math.max(0, parseFloat(formEdit.costoManoObra) || 0);
      const docsNorm = docsForm
        .filter(d => (d.proveedor || '').trim() || (d.vale || '').trim() || (d.detalle || '').trim() || parseFloat(d.total))
        .map(d => ({
          tipo: d.tipo === 'almacen' ? 'almacen' : 'proveedor',
          proveedor: (d.proveedor || '').trim(),
          dte: (d.dte || '').trim(),
          vale: (d.vale || '').trim(),
          detalle: (d.detalle || '').trim(),
          total: Math.max(0, parseFloat(d.total) || 0)
        }));

      if (docsForm.some(d => parseFloat(d.total) < 0)) {
        addToast('Los costos de facturas o repuestos no pueden ser negativos', 'error');
        return;
      }

      const cRep = docsNorm.reduce((s, d) => s + d.total, 0);
      const resumenDocs = docsNorm
        .map(d => `${d.tipo === 'almacen'
          ? `Vale de almacén ${d.vale || 's/n'}`
          : `${d.proveedor || 'Proveedor'}${d.dte ? ` (DTE: ${d.dte})` : ''}`}${d.detalle ? ` — ${d.detalle}` : ''}${d.total ? ` ($${d.total.toFixed(2)})` : ''}`)
        .join(' | ');
      const provNorm = docsNorm
        .filter(d => d.tipo === 'proveedor' && (d.proveedor || d.dte))
        .map(d => ({ nombre: d.proveedor, dte: d.dte }));

      await actualizarOrden(id, {
        placa: placaNorm,
        marca: formEdit.marca,
        modelo: formEdit.modelo,
        numMotor: formEdit.numMotor,
        vin: (formEdit.vin || '').toUpperCase(),
        anio: formEdit.anio,
        kilometraje: formEdit.kilometraje ? Number(formEdit.kilometraje) : (orden.kilometraje || null),
        departamento: formEdit.departamento || orden.departamento,
        ruta: formEdit.ruta || orden.ruta,
        ...(isAdmin ? {
          costoRepuestos: cRep,
          costoManoObra: cMo,
          costoTotal: cRep + cMo,
          detalleRepuestos: resumenDocs,
          facturas: docsNorm,
          proveedores: provNorm,
          proveedor: provNorm[0]?.nombre || '',
          dte: provNorm[0]?.dte || '',
          valeAlmacen: docsNorm.find(d => d.tipo === 'almacen')?.vale || ''
        } : {}),
        conductorEntrega: formEdit.conductorEntrega,
        mecanicoReceptor: formEdit.mecanicoReceptor,
        diagnosticoInicial: formEdit.diagnosticoInicial,
        tipoTrabajo: formEdit.tipoTrabajo,
        areaPrincipal: formEdit.areaPrincipal,
        mecanicoAsignado: formEdit.mecanicoAsignado,
        mecanicosApoyo: apoyosForm.map(v => (v || '').trim()),
        mecanicoAsignado2: apoyosForm.map(v => (v || '').trim()).find(Boolean) || null,
        tiempoEstimadoHoras: parseFloat(formEdit.tiempoEstimadoHoras) || 0,
      });
      addToast('Orden actualizada exitosamente', 'success');
      setEditando(false);
      cargarOrden();
    } catch (err) {
      console.error(err);
      addToast('Error al actualizar', 'error');
    }
  };

  const handleEliminar = async () => {
    const ordenCodigo = formatoOT(orden);
    const placaVehiculo = orden?.placa || 'unidad';

    const confirmado = await confirm({
      title: '¿Eliminar orden de trabajo?',
      message: `¿Estás seguro de eliminar permanentemente la orden ${ordenCodigo} (${placaVehiculo})? Esta acción borrará el registro y no se puede deshacer.`,
      confirmText: 'Sí, eliminar orden',
      cancelText: 'Cancelar',
      danger: true
    });

    if (!confirmado) return;

    try {
      await eliminarOrden(id);
      addToast(`Orden ${ordenCodigo} eliminada exitosamente`, 'info');
      navigate('/ordenes');
    } catch (err) {
      console.error(err);
      addToast('Error al eliminar orden: ' + err.message, 'error');
    }
  };

  const handleCambiarEstado = async (nuevoEstado, motivo = '', nombreEtiqueta = '') => {
    if (!puedeCambiarEstadoActividad(orden, currentUser)) {
      addToast('Solo el encargado de taller, administración o el mecánico asignado a esta OT puede cambiar los estados.', 'warning');
      return;
    }
    try {
      await cambiarEstado(id, nuevoEstado, currentUser?.nombre || 'Taller', motivo || `Cambio de estado a ${nuevoEstado}`);
      const textoFinal = nombreEtiqueta || nuevoEstado.replace('_', ' ');
      addToast(`Transición completada: Orden en estado "${textoFinal}"`, 'success');
      setModalTransicion(prev => ({ ...prev, abierto: false, guardando: false }));
      cargarOrden();
    } catch (err) {
      console.error(err);
      addToast('Error al cambiar estado: ' + err.message, 'error');
      setModalTransicion(prev => ({ ...prev, guardando: false }));
    }
  };

  const handleFinalizarOrden = async (detalle) => {
    if (!puedeCambiarEstadoActividad(orden, currentUser)) {
      addToast('Solo el encargado de taller, administración o el mecánico asignado a esta OT puede cambiar los estados.', 'warning');
      setIsFinalizacionOpen(false);
      return;
    }
    setGuardandoFinalizacion(true);
    try {
      await finalizarTrabajo(id, Number(orden.tiempoRealMinutos) || 0, detalle);
      setIsFinalizacionOpen(false);
      addToast('Orden de trabajo finalizada y lista para entrega.', 'success');
      cargarOrden();
    } catch (err) {
      console.error(err);
      addToast('Error al finalizar: ' + err.message, 'error');
    } finally {
      setGuardandoFinalizacion(false);
    }
  };

  const handleReactivar = async (justificacion) => {
    setGuardandoReactivar(true);
    try {
      await reactivarOrden(id, currentUser?.nombre || 'Taller', justificacion);
      setIsReactivarOpen(false);
      addToast('OT reactivada: la unidad volvió a En Proceso y sale de Entrega de Vehículo.', 'success');
      cargarOrden();
    } catch (err) {
      console.error(err);
      addToast('Error al reactivar: ' + err.message, 'error');
    } finally {
      setGuardandoReactivar(false);
    }
  };

  const formatFecha = (timestamp) => {
    if (!timestamp?.toDate) return '—';
    return new Date(timestamp.toDate()).toLocaleString('es-SV');
  };

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  if (!orden) return null;

  if (!puedeVerOrden(orden, currentUser)) {
    return (
      <div className="animate-fade-in">
        <div className="card" style={{ padding: 36, textAlign: 'center', border: '1.5px solid var(--color-border)' }}>
          <TbShieldCheck style={{ fontSize: 40, color: 'var(--color-accent)', marginBottom: 10 }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Sin acceso a esta orden</h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 20 }}>
            Como mecánico solo puedes consultar las órdenes de trabajo asignadas a ti.
          </p>
          <button onClick={() => navigate('/ordenes')} className="btn btn-primary">
            Ver mis órdenes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <BotonVolver a="/ordenes" etiqueta="Volver a Órdenes" margen={false} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{
                fontSize: 28, fontWeight: 800,
                background: 'linear-gradient(135deg, var(--color-text-primary), var(--color-text-secondary))',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0
              }}>
                {orden.placa || 'Sin placa'}
              </h1>
              <span className="badge badge-finalizado" style={{ fontSize: 10, padding: '3px 8px' }}>
                {formatoOT(orden)}
              </span>
              <span className="badge badge-finalizado" style={{ fontSize: 10, padding: '3px 8px' }}>
                AUDITORÍA V4.2
              </span>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: '4px 0 0 0' }}>
              {orden.marca} {orden.modelo} {orden.anio && `(${orden.anio})`} • {orden.tipoTrabajo || 'Correctivo'}
            </p>
          </div>
        </div>

        <div className="btn-group">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsCertOpen(true)}
            title="Emitir e imprimir Acta de Taller"
          >
            <TbPrinter /> Acta de Taller
          </button>

          {puedeModificar ? (
            <>
              <button onClick={() => setEditando(!editando)} className="btn btn-secondary">
                <TbPencil /> {editando ? 'Cancelar Edición' : 'Editar'}
              </button>
              <button onClick={handleEliminar} className="btn btn-danger">
                <TbTrash /> Eliminar
              </button>
            </>
          ) : (
            <span
              title="Solo el encargado de taller o la administración pueden modificar una orden guardada"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                border: '1px dashed var(--color-border)',
                background: 'var(--color-bg-card)'
              }}
            >
              <TbLock style={{ marginRight: 5, verticalAlign: -2 }} /> Orden solo editable por Encargado / Administración
            </span>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                ESTADO ACTUAL DEL TRABAJO
              </div>
              <StatusBadge estado={orden.estado} style={{ fontSize: 13, padding: '6px 14px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', alignSelf: 'center', marginRight: 4 }}>
              Transición de estado autorizada:
            </span>
            {(TRANSICIONES_VALIDAS[orden.estado] || []).length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                {orden.estado === 'entregado' ? 'Expediente cerrado con entrega finalizada' : 'Sin transiciones pendientes'}
              </span>
            ) : (
              (TRANSICIONES_VALIDAS[orden.estado] || []).map((trans) => {
                const esReactivacion = trans === 'en_proceso' && (orden.estado === 'finalizado' || orden.estado === 'listo_entrega');
                if (esReactivacion && !puedeReactivarOrden(currentUser)) return null;

                const config = {
                  pendiente_diagnostico: { label: 'A Diagnóstico', cls: 'btn-secondary' },
                  en_proceso: { label: 'Iniciar / Reanudar', cls: 'btn-primary' },
                  esperando_repuestos: { label: 'Esperando Repuestos', cls: 'btn-warning' },
                  pausado: { label: 'Pausar', cls: 'btn-warning' },
                  pendiente_autorizacion: { label: 'Requiere Autorización', cls: 'btn-secondary' },
                  finalizado: { label: 'Finalizar Reparación', cls: 'btn-success' },
                  listo_entrega: { label: 'Listo para Entrega', cls: 'btn-success' },
                  entregado: { label: 'Registrar Entrega', cls: 'btn-primary' },
                  cancelado: { label: 'Cancelar', cls: 'btn-danger' }
                }[trans] || { label: trans, cls: 'btn-secondary' };

                const etiqueta = esReactivacion ? { label: 'Reactivar OT (hubo error)', cls: 'btn-warning' } : config;

                return (
                  <button
                    key={trans}
                    type="button"
                    className={`btn btn-sm ${etiqueta.cls}`}
                    onClick={() => {
                      if (trans === 'finalizado') {
                        if (currentUser?.rol === 'mecanico' && !ordenCompleta(orden)) {
                          addToast(
                            'No puedes cerrar la OT: quedan actividades pendientes. Solo el encargado de taller puede cerrarla con justificación.',
                            'warning'
                          );
                          return;
                        }
                        setIsFinalizacionOpen(true);
                        return;
                      }
                      if (esReactivacion) {
                        setIsReactivarOpen(true);
                        return;
                      }
                      setModalTransicion({
                        abierto: true,
                        nuevoEstado: trans,
                        etiqueta: etiqueta.label,
                        motivo: '',
                        guardando: false
                      });
                    }}
                  >
                    {etiqueta.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 20 }}>
        <div className="card">
          <div className="form-section-title" style={{ marginTop: 0 }}>
            <IconoMascara className="icon" src="/iconos/taller-reparacion.png" size={16} /> Datos del Vehículo y Operación
          </div>
          {editando ? (
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Placa</label>
                <input name="placa" value={formEdit.placa || ''} onChange={handleEditChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Marca</label>
                <input name="marca" value={formEdit.marca || ''} onChange={handleEditChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Modelo</label>
                <input name="modelo" value={formEdit.modelo || ''} onChange={handleEditChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Motor</label>
                <input name="numMotor" value={formEdit.numMotor || ''} onChange={handleEditChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Número VIN</label>
                <input
                  name="vin"
                  value={formEdit.vin || ''}
                  onChange={handleEditChange}
                  className="form-input"
                  maxLength={17}
                  placeholder="Número de chasis / VIN (17 dígitos)"
                  style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontSize: 13 }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Año</label>
                <input name="anio" value={formEdit.anio || ''} onChange={handleEditChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Kilometraje (Km)</label>
                <input name="kilometraje" type="number" value={formEdit.kilometraje || ''} onChange={handleEditChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Departamento</label>
                <select
                  name="departamento"
                  value={formEdit.departamento || orden.departamento || 'San Salvador'}
                  onChange={handleEditChange}
                  className="form-select"
                >
                  {DEPARTAMENTOS_EL_SALVADOR.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="form-group full-width">
                <label className="form-label">Ruta de Distribución</label>
                <select
                  name="ruta"
                  value={formEdit.ruta || orden.ruta || 'Ruta 01 - San Salvador Centro & Escalerón'}
                  onChange={handleEditChange}
                  className="form-select"
                >
                  {RUTAS_PREDETERMINADAS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-item-label">Placa</div>
                <div className="detail-item-value" style={{ fontFamily: 'var(--font-mono)' }}>{orden.placa || '—'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Marca / Modelo</div>
                <div className="detail-item-value">{orden.marca || '—'} {orden.modelo || ''}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Kilometraje</div>
                <div className="detail-item-value" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                  {orden.kilometraje ? `${Number(orden.kilometraje).toLocaleString()} km` : 'No registrado'}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Departamento</div>
                <div className="detail-item-value" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
                  <TbMapPin style={{ marginRight: 4 }} /> {orden.departamento || 'San Salvador'}
                </div>
              </div>
              <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                <div className="detail-item-label">Ruta Asignada</div>
                <div className="detail-item-value">{orden.ruta || 'Ruta de Distribución General'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Motor</div>
                <div className="detail-item-value">{orden.numMotor || '—'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Número VIN</div>
                <div className="detail-item-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  {orden.vin || '—'}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Año</div>
                <div className="detail-item-value">{orden.anio || '—'}</div>
              </div>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="card">
            <div className="form-section-title" style={{ marginTop: 0 }}>
              <IconoMascara className="icon" src="/iconos/taller-balances.png" size={16} /> Registro Administrativo de Costos y Recursos
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
              Control de comprobantes de repuestos, lubricantes y mano de obra.
            </p>
            {editando ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12, alignItems: 'end' }}>
                  <div className="form-group" style={{ gap: 4 }}>
                    <label className="form-label">Repuestos e Insumos ($ USD)</label>
                    <input
                      type="text"
                      readOnly
                      value={`$${sumaDocs.toFixed(2)}`}
                      className="form-input"
                      style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-accent)', background: 'var(--color-bg-input)', cursor: 'default' }}
                    />
                  </div>
                  <div className="form-group" style={{ gap: 4 }}>
                    <label className="form-label">Total ($ USD)</label>
                    <input
                      type="text"
                      readOnly
                      value={`$${(sumaDocs + (parseFloat(formEdit.costoManoObra) || 0)).toFixed(2)}`}
                      className="form-input"
                      style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#22c55e', background: 'rgba(34,197,95,0.06)', cursor: 'default' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="form-label" style={{ margin: 0 }}>Agregar documento:</span>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => agregarDoc('proveedor')}>
                    + Factura (Proveedor)
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => agregarDoc('almacen')}>
                    + Vale de Almacén
                  </button>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {docsForm.length} documento(s)
                  </span>
                </div>

                <div style={{ marginTop: 12 }}>
                  {docsForm.length === 0 && (
                    <div style={{
                      fontSize: 12.5,
                      color: 'var(--color-text-muted)',
                      padding: '14px',
                      border: '1px dashed var(--color-border)',
                      borderRadius: 8,
                      textAlign: 'center'
                    }}>
                      Sin documentos todavía. Agrega una <strong>Factura de Proveedor</strong> o un <strong>Vale de Almacén</strong> con los botones de arriba.
                    </div>
                  )}

                  {docsForm.map((doc, i) => (
                    <div
                      key={i}
                      style={{
                        border: '1px solid var(--color-border)',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 10
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                        <div className="btn-group">
                          <button
                            type="button"
                            className={`btn btn-sm ${doc.tipo !== 'almacen' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => cambiarDoc(i, 'tipo', 'proveedor')}
                          >
                            Proveedor
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${doc.tipo === 'almacen' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => cambiarDoc(i, 'tipo', 'almacen')}
                          >
                            Almacén
                          </button>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          DOC #{i + 1}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => quitarDoc(i)}
                          title="Quitar este documento"
                          style={{
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#ef4444',
                            padding: '3px 11px'
                          }}
                        >
                          ×
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 8, alignItems: 'end' }}>
                        {doc.tipo === 'almacen' ? (
                          <div className="form-group" style={{ gap: 4 }}>
                            <label className="form-label">N° de Vale de Almacén</label>
                            <input
                              className="form-input"
                              value={doc.vale || ''}
                              onChange={(e) => cambiarDoc(i, 'vale', e.target.value)}
                              placeholder="Número de vale de almacén"
                              style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                            />
                          </div>
                        ) : (
                          <>
                            <div className="form-group" style={{ gap: 4 }}>
                              <label className="form-label">Proveedor</label>
                              <input
                                className="form-input"
                                value={doc.proveedor || ''}
                                onChange={(e) => cambiarDoc(i, 'proveedor', e.target.value)}
                                placeholder="Razón social del proveedor"
                                style={{ fontSize: 13 }}
                              />
                            </div>
                            <div className="form-group" style={{ gap: 4 }}>
                              <label className="form-label">DTE o Identificador de Factura</label>
                              <input
                                className="form-input"
                                value={doc.dte || ''}
                                onChange={(e) => cambiarDoc(i, 'dte', e.target.value)}
                                placeholder="Número de DTE o factura"
                                style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                              />
                            </div>
                          </>
                        )}
                        <div className="form-group" style={{ gap: 4 }}>
                          <label className="form-label">Total de la factura ($ USD)</label>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            value={doc.total ?? ''}
                            onChange={(e) => cambiarDoc(i, 'total', e.target.value)}
                            placeholder="0.00"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ gap: 4, marginTop: 8 }}>
                        <label className="form-label">Repuestos e insumos</label>
                        <textarea
                          className="form-textarea"
                          rows={2}
                          value={doc.detalle || ''}
                          onChange={(e) => cambiarDoc(i, 'detalle', e.target.value)}
                          placeholder="Detalle de repuestos, lubricantes e insumos adquiridos..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-item-label">Repuestos e Insumos</div>
                  <div className="detail-item-value" style={{ fontFamily: 'var(--font-mono)' }}>
                    ${(Number(orden.costoRepuestos) || 0).toFixed(2)}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-item-label">Documentos</div>
                  <div className="detail-item-value">
                    {docsDesdeLegacy(orden).length} factura(s) / vale(s)
                  </div>
                </div>
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="detail-item-label">Facturas y Vales (trazabilidad del gasto)</div>
                  <div className="detail-item-value">
                    {docsDesdeLegacy(orden).length === 0 ? '—' : (
                      docsDesdeLegacy(orden).map((d, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                            alignItems: 'baseline',
                            fontSize: 13,
                            marginBottom: 5,
                            paddingBottom: 5,
                            borderBottom: '1px dashed var(--color-border)'
                          }}
                        >
                          <span style={{
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: 0.5,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: d.tipo === 'almacen' ? 'rgba(249,115,22,0.14)' : 'rgba(134,153,46,0.14)',
                            color: d.tipo === 'almacen' ? 'var(--color-accent)' : 'var(--color-accent)',
                            border: `1px solid ${d.tipo === 'almacen' ? 'rgba(249,115,22,0.35)' : 'rgba(134,153,46,0.35)'}`
                          }}>
                            {d.tipo === 'almacen' ? 'ALMACÉN' : 'PROVEEDOR'}
                          </span>
                          {d.tipo === 'almacen' ? (
                            <span style={{ fontFamily: 'var(--font-mono)' }}>Vale: {d.vale || '—'}</span>
                          ) : (
                            <span>
                              <strong>{d.proveedor || '—'}</strong>
                              {d.dte ? (
                                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', marginLeft: 6, wordBreak: 'break-all' }}>
                                  {d.dte}
                                </span>
                              ) : null}
                            </span>
                          )}
                          {d.detalle ? (
                            <span style={{ color: 'var(--color-text-secondary)', flex: '1 1 220px' }}>— {d.detalle}</span>
                          ) : null}
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#22c55e', marginLeft: 'auto' }}>
                            ${(Number(d.total) || 0).toFixed(2)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="detail-item-label">Total Recursos Invertidos</div>
                  <div className="detail-item-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: '#22c55e', fontWeight: 800 }}>
                    ${(Number(orden.costoTotal) || (Number(orden.costoRepuestos) || 0) + (Number(orden.costoManoObra) || 0)).toFixed(2)} USD
                  </div>
                </div>
                {orden.detalleRepuestos && docsDesdeLegacy(orden).length === 0 && (
                  <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                    <div className="detail-item-label">Repuestos cargados a la unidad</div>
                    <div className="detail-item-value" style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>
                      {orden.detalleRepuestos}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="card">
          <div className="form-section-title" style={{ marginTop: 0 }}>
            <IconoMascara className="icon" src="/iconos/personal-taller.png" size={16} /> Recepción
          </div>
          {editando ? (
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Conductor</label>
                <input name="conductorEntrega" value={formEdit.conductorEntrega || ''} onChange={handleEditChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Mecánico Receptor</label>
                <select name="mecanicoReceptor" value={formEdit.mecanicoReceptor || ''} onChange={handleEditChange} className="form-select">
                  <option value="">Seleccionar...</option>
                  {mecanicos.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-item-label">Conductor</div>
                <div className="detail-item-value">{orden.conductorEntrega || '—'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Mecánico Receptor</div>
                <div className="detail-item-value">{orden.mecanicoReceptor || '—'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Fecha Ingreso</div>
                <div className="detail-item-value">{formatFecha(orden.fechaIngreso)}</div>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="form-section-title" style={{ marginTop: 0 }}>
            <IconoMascara className="icon" src="/iconos/registro.png" size={16} /> Recepción: Motivo de Ingreso
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
            Información registrada durante la recepción inicial del vehículo.
          </p>
          {editando ? (
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Motivo de Ingreso / Falla Reportada</label>
                <textarea name="diagnosticoInicial" value={formEdit.diagnosticoInicial || ''} onChange={handleEditChange} className="form-textarea" rows={3} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select name="tipoTrabajo" value={formEdit.tipoTrabajo || ''} onChange={handleEditChange} className="form-select">
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Reparación">Reparación</option>
                  <option value="Preventivo">Preventivo (legado)</option>
                  <option value="Correctivo">Correctivo (legado)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Área</label>
                <select name="areaPrincipal" value={formEdit.areaPrincipal || ''} onChange={handleEditChange} className="form-select">
                  {opcionesArea(formEdit.areaPrincipal).map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 16, lineHeight: 1.7 }}>
                {orden.diagnosticoInicial || 'Sin motivo de ingreso registrado.'}
              </p>
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-item-label">Tipo</div>
                  <div className="detail-item-value">{orden.tipoTrabajo}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-item-label">Área</div>
                  <div className="detail-item-value">{orden.areaPrincipal}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-item-label">Tipo de Atención</div>
                  <div className="detail-item-value">
                    {orden.tipoAtencion === 'asistencia'
                      ? <><TbMapPin style={{ marginRight: 5, verticalAlign: -2 }} /> Asistencia en sitio (autoasignada)</>
                      : 'Ingreso a taller'}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="form-section-title" style={{ marginTop: 0 }}>
            <IconoMascara className="icon" src="/iconos/taller.png" size={16} /> Taller
          </div>
          {editando ? (
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Mecánico Responsable</label>
                <select name="mecanicoAsignado" value={formEdit.mecanicoAsignado || ''} onChange={handleEditChange} className="form-select">
                  <option value="">Sin asignar</option>
                  {mecanicos.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Mecánicos de Apoyo (opcional)</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={agregarApoyoForm}
                    style={{ fontSize: 12, padding: '3px 10px' }}
                  >
                    + Agregar apoyo
                  </button>
                </label>
                {slotsApoyoForm.map((valor, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <select
                      className="form-select"
                      style={{ flex: 1 }}
                      value={valor}
                      onChange={(e) => cambiarApoyoForm(i, e.target.value)}
                    >
                      <option value="">{slotsApoyoForm.length > 1 ? `Sin apoyo #${i + 1}` : 'Sin apoyo'}</option>
                      {mecanicos
                        .filter((m) => m !== formEdit.mecanicoAsignado && !slotsApoyoForm.filter((_, j) => j !== i).includes(m))
                        .map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {slotsApoyoForm.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => quitarApoyoForm(i)}
                        title="Quitar este mecánico de apoyo"
                        style={{
                          background: 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.3)',
                          color: '#ef4444',
                          padding: '4px 10px',
                          flexShrink: 0
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">Tiempo Estimado (horas)</label>
                <input name="tiempoEstimadoHoras" type="number" value={formEdit.tiempoEstimadoHoras || ''} onChange={handleEditChange} className="form-input" step="0.5" />
              </div>
            </div>
          ) : (
            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-item-label">Mecánico Responsable</div>
                <div className="detail-item-value">{orden.mecanicoAsignado || 'Sin asignar'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Mecánicos de Apoyo</div>
                <div className="detail-item-value">{apoyosDeOrden(orden).filter(Boolean).join(', ') || '—'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Tiempo Estimado</div>
                <div className="detail-item-value">{orden.tiempoEstimadoHoras || 0} horas</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Tiempo Real</div>
                <div className="detail-item-value">{orden.tiempoRealMinutos || 0} minutos</div>
              </div>
              {(orden.trabajoRealizado || orden.valeBodega || orden.detalleRepuestos) && (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="detail-item-label">Cierre de Orden (trabajo realizado)</div>
                  <div className="detail-item-value" style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>
                    {orden.trabajoRealizado || '—'}
                    {orden.valeBodega && (
                      <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                        Vale de bodega: {orden.valeBodega}
                      </div>
                    )}
                    {orden.detalleRepuestos && (
                      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        Repuestos utilizados:<br />
                        {orden.detalleRepuestos}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="form-section-title" style={{ marginTop: 0 }}>
          <IconoMascara className="icon" src="/iconos/llave-inglesa.png" size={16} /> Actividades Técnicas de Reparación ({orden.actividades?.length || 0})
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Tareas por especialidad y horas hombre.
        </p>

        {(!orden.actividades || orden.actividades.length === 0) ? (
          <div style={{ padding: '16px', background: 'var(--color-bg-input)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-secondary)', fontSize: 13, fontStyle: 'italic' }}>
            No se han registrado actividades desglosadas para esta orden. Se trabaja bajo el diagnóstico general: "{orden.diagnosticoInicial || 'Mantenimiento preventivo'}".
          </div>
        ) : (
          <div className="table-container">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Actividad / Labor</th>
                  <th style={{ padding: '10px 12px' }}>Área</th>
                  <th style={{ padding: '10px 12px' }}>Mecánico Responsable</th>
                  <th style={{ padding: '10px 12px' }}>T. Estimado</th>
                  <th style={{ padding: '10px 12px' }}>T. Real</th>
                  <th style={{ padding: '10px 12px' }}>Estado</th>
                  <th style={{ padding: '10px 12px' }}>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {orden.actividades.map((act) => (
                  <tr key={act.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {act.descripcion}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>
                      {act.area || orden.areaPrincipal}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text-primary)' }}>
                      <TbUser style={{ marginRight: 5, verticalAlign: -2 }} /> {act.mecanicoAsignado || orden.mecanicoAsignado || 'Sin asignar'}
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>
                      {act.tiempoEstimadoMinutos || 60} min
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', color: (act.tiempoRealMinutos || 0) > (act.tiempoEstimadoMinutos || 60) ? '#ef4444' : '#22c55e', fontWeight: 700 }}>
                      {act.tiempoRealMinutos || 0} min
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className={`badge badge-${act.estado}`} style={{ fontSize: 10, padding: '3px 8px' }}>
                        {act.estado}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: 'var(--color-text-muted)', maxWidth: 200 }}>
                      {act.observaciones || (act.motivoPausa ? `Pausado: ${act.motivoPausa}` : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="form-section-title" style={{ marginTop: 0 }}>
          <IconoMascara className="icon" src="/iconos/historial.png" size={16} /> Expediente de Trazabilidad y Auditoría de Estados
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Cambios de estado y responsables.
        </p>

        {(!orden.historialEstados || orden.historialEstados.length === 0) ? (
          <div style={{ padding: '14px', background: 'var(--color-bg-input)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)', fontSize: 13 }}>
            Orden recién creada. Estado inicial: <strong>{orden.estado}</strong> registrado en el ingreso.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', paddingLeft: 12 }}>
            <div style={{ position: 'absolute', top: 12, bottom: 12, left: 19, width: 2, background: 'var(--color-border)', zIndex: 0 }} />
            {orden.historialEstados.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: h.estado === 'entregado' ? '#a855f7' : (h.estado === 'finalizado' || h.estado === 'listo_entrega' ? '#22c55e' : (h.estado === 'en_proceso' ? 'var(--color-accent)' : '#f59e0b')),
                  border: '3px solid var(--color-bg-card)',
                  boxShadow: '0 0 0 1px var(--color-border)',
                  marginTop: 3, flexShrink: 0
                }} />
                <div style={{
                  background: 'var(--color-bg-input)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  flex: 1
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusBadge estado={h.estado} style={{ fontSize: 10, padding: '2px 8px' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {h.usuario || 'Sistema'}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {h.fecha ? new Date(h.fecha).toLocaleString('es-SV') : 'Fecha no registrada'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    {h.motivo || 'Transición registrada sin notas adicionales.'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="form-section-title" style={{ marginTop: 0 }}>
          <IconoMascara className="icon" src="/iconos/camara-fotografica.png" size={16} /> Inspección Perimetral 360° — Estado Actual de la Unidad
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 14 }}>
          Fotografías perimetrales de la unidad. En caso de novedades o reparaciones, actualice la toma correspondiente.
          {fotosBase?.actualizadoEn && (
            <span style={{ display: 'block', marginTop: 4, fontSize: 11 }}>
              Última actualización:{' '}
              {new Date(fotosBase.actualizadoEn).toLocaleString('es-SV')}
              {fotosBase.actualizadoPor ? ` por ${fotosBase.actualizadoPor}` : ''}
            </span>
          )}
        </p>
        <input
          type="file"
          ref={baseInputRef}
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleArchivoBase}
        />
        <CameraModal
          isOpen={Boolean(camaraLado)}
          onClose={() => setCamaraLado('')}
          onFoto={archivo => procesarArchivoBase(camaraLado, archivo)}
        />
        <div className="side-photos-grid">
          {LADOS_FICHA.map((lado) => {
            const foto = fotosBase?.[lado.key] || orden.fotosLados?.[lado.key];
            return (
              <div key={lado.key} className="side-photo-card">
                <div className="side-photo-header">
                  <span className="side-photo-label"><IconoMascara src="/iconos/camara-fotografica.png" size={12} /> {lado.num}. {lado.label}</span>
                  <span className="side-photo-angle-tag">{lado.tag}</span>
                </div>
                {foto ? (
                  <div className="side-photo-preview">
                    <img src={foto} alt={lado.label} />
                    <span className="badge-captured"><TbCircleCheck /> Actual</span>
                  </div>
                ) : (
                  <div style={{ padding: '36px 12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
                    {lado.vacio}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setCamaraLado(lado.key)}
                    title="Tomar esta fotografía con la cámara"
                    style={{
                      width: '100%',
                      padding: '6px 6px',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg-card)',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <IconoMascara src="/iconos/camara-fotografica.png" size={12} /> Cámara
                  </button>
                  <button
                    type="button"
                    onClick={() => actualizarFotoBase(lado.key, false)}
                    title="Subir una fotografía desde el equipo"
                    style={{
                      width: '100%',
                      padding: '6px 6px',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg-card)',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <TbUpload size={12} /> Subir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(orden.fotosIngreso?.length > 0 || orden.fotosSalida?.length > 0) && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="form-section-title" style={{ marginTop: 0 }}>
            <IconoMascara className="icon" src="/iconos/camara-fotografica.png" size={16} /> Fotos de Evidencia de esta Orden (ingreso y reparación)
          </div>
          {orden.fotosIngreso?.length > 0 && (
            <>
              <h4 style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 10 }}>Fotos de evidencia al ingresar (fallas detectadas)</h4>
              <div className="photo-grid" style={{ marginBottom: 20 }}>
                {orden.fotosIngreso.map((url, i) => (
                  <div key={i} className="photo-thumbnail">
                    <img src={url} alt={`Ingreso ${i + 1}`} />
                  </div>
                ))}
              </div>
            </>
          )}
          {orden.fotosSalida?.length > 0 && (
            <>
              <h4 style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 10 }}>Fotos de Entrega al Motorista (daños posteriores a la entrega)</h4>
              <div className="photo-grid">
                {orden.fotosSalida.map((url, i) => (
                  <div key={i} className="photo-thumbnail">
                    <img src={url} alt={`Salida ${i + 1}`} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {orden.estado === 'entregado' && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="form-section-title" style={{ marginTop: 0 }}>
            <IconoMascara className="icon" src="/iconos/salida-taller.png" size={16} /> Datos de Entrega
          </div>
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-item-label">Persona que Retiró</div>
              <div className="detail-item-value">{orden.personaRetira || '—'}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">Despachado por</div>
              <div className="detail-item-value">{orden.empleadoDespacha || 'Recepción de Taller'}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">Fecha de Salida</div>
              <div className="detail-item-value">{formatFecha(orden.fechaSalida)}</div>
            </div>
            <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
              <div className="detail-item-label">Observaciones Finales</div>
              <div className="detail-item-value" style={{ fontWeight: 400 }}>{orden.observacionesFinales || '—'}</div>
            </div>
            <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
              <div className="detail-item-label">Recomendaciones</div>
              <div className="detail-item-value" style={{ fontWeight: 400 }}>{orden.recomendaciones || '—'}</div>
            </div>
          </div>
        </div>
      )}

      {editando && (
        <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: 24, marginBottom: 20 }}>
          <button className="btn btn-secondary btn-lg" onClick={() => { setEditando(false); setFormEdit(orden); }}>
            Cancelar
          </button>
          <button className="btn btn-primary btn-lg" onClick={handleGuardar}>
            <TbCircleCheck /> Guardar Cambios
          </button>
        </div>
      )}

      {modalTransicion.abierto && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={() => !modalTransicion.guardando && setModalTransicion(prev => ({ ...prev, abierto: false }))}>
            <div className="modal-content" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 16 }}>
                  <TbShieldCheck style={{ color: 'var(--color-accent)' }} /> Transición de Estado Operativo
                </h3>
                <button
                  type="button"
                  className="btn-icon"
                  disabled={modalTransicion.guardando}
                  onClick={() => setModalTransicion(prev => ({ ...prev, abierto: false }))}
                >
                  <TbX />
                </button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                setModalTransicion(prev => ({ ...prev, guardando: true }));
                handleCambiarEstado(modalTransicion.nuevoEstado, modalTransicion.motivo.trim() || `Transición a ${modalTransicion.etiqueta}`, modalTransicion.etiqueta);
              }}>
                <div className="modal-body" style={{ padding: '20px 24px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: 'var(--color-bg-input)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    marginBottom: 18
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Cambiar a:</span>
                    <span style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: 'var(--color-accent)'
                    }}>
                      {modalTransicion.etiqueta}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                      Unidad: <strong>{orden?.placa}</strong>
                    </span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 8, fontWeight: 700 }}>
                      Justificación u Observación Operativa
                    </label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      placeholder="Indique el motivo técnico o nota de la transición (ej. Espera de repuesto en proveedor, pruebas aprobadas, etc.)..."
                      value={modalTransicion.motivo}
                      onChange={(e) => setModalTransicion(prev => ({ ...prev, motivo: e.target.value }))}
                      autoFocus
                    />
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginTop: 4 }}>
                      Quedará registrada en la bitácora y trazabilidad de la orden.
                    </span>
                  </div>
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 24px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={modalTransicion.guardando}
                    onClick={() => setModalTransicion(prev => ({ ...prev, abierto: false }))}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={modalTransicion.guardando}
                  >
                    {modalTransicion.guardando ? 'Actualizando...' : 'Confirmar Transición'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      <InspectionCertificateModal
        isOpen={isCertOpen}
        onClose={() => setIsCertOpen(false)}
        orden={orden}
      />

      <FinalizacionOrdenModal
        isOpen={isFinalizacionOpen}
        onClose={() => setIsFinalizacionOpen(false)}
        orden={orden}
        onConfirmar={handleFinalizarOrden}
        guardando={guardandoFinalizacion}
        incompleta={!ordenCompleta(orden)}
      />

      <ReactivarOrdenModal
        isOpen={isReactivarOpen}
        onClose={() => setIsReactivarOpen(false)}
        orden={orden}
        onConfirmar={handleReactivar}
        guardando={guardandoReactivar}
      />
    </div>
  );
}
