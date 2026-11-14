import BotonVolver from '../components/BotonVolver';
import { useState, useEffect, useCallback, useRef } from 'react';
import { normalizarPlaca } from '../utils/placas';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  TbClipboardList,
  TbUpload,
  TbDeviceFloppy,
  TbX,
  TbCircleCheck,
  TbCheck,
  TbPlus,
  TbLock,
  TbAlertTriangle,
} from '../icons';
import { crearOrden, buscarPorPlaca, formatoOT } from '../firebase/ordenesService';
import { ESTADOS_CONFIG } from '../components/StatusBadge';
import { useToast } from '../components/ToastContext';
import { buscarVehiculoCatalogo } from '../services/vehiculosService';
import { AREAS_SELECT } from '../constants/areas';
import {
  GRUPOS_MANTENIMIENTO,
  MOTIVOS_INGRESO,
  obtenerTareasMantenimiento,
  obtenerTareasReparacion
} from '../services/catalogoTareasService';
import { obtenerMecanicosActivos } from '../services/usuariosService';
import { useAuth } from '../context/AuthContext';
import { obtenerFotosBase, guardarFotosBase, LADOS_VEHICULO } from '../services/fotosVehiculoService';
import ScannerModal from '../components/ScannerModal';
import IconoMascara from '../components/IconoMascara';
import useDatosSinGuardar, { AVISO_DATOS_SIN_GUARDAR } from '../hooks/useDatosSinGuardar';
import { formatearMiles, formatoKmEntrada, soloDigitos } from '../utils/formato';
import CameraModal from '../components/CameraModal';

function construirActividades(tareas, mecanico = '', areaDefault = 'General') {
  return tareas.map((t, i) => ({
    id: `act-${Date.now().toString(36)}-${i + 1}`,
    descripcion: t.descripcion,
    area: t.area || areaDefault,
    mecanicoAsignado: mecanico,
    estado: 'pendiente',
    tiempoEstimadoMinutos: t.tiempoEstimadoMinutos || 60,
    tiempoRealMinutos: 0,
    observaciones: ''
  }));
}

// Estados en los que la unidad sigue con una orden abierta en el taller.
// Mientras exista una orden así para la placa, no se permite dar de alta
// un nuevo ingreso (evita duplicados por error).
const ESTADOS_EN_TALLER = [
  'ingresado', 'pendiente_diagnostico', 'en_proceso', 'esperando_repuestos',
  'pendiente_autorizacion', 'pausado', 'finalizado', 'listo_entrega'
];

const etiquetaEstadoOrden = (estado) =>
  ESTADOS_CONFIG[estado]?.label || String(estado || '').replace('_', ' ');

export default function NuevaOrden() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast, confirm } = useToast();
  const { currentUser, isAdmin: esAdmin } = useAuth();
  const esMecanico = currentUser?.rol === 'mecanico';

  const [loading, setLoading] = useState(false);
  const [modoAtencion, setModoAtencion] = useState('taller');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const tipoAtencionRef = useRef(null);
  const datosVehiculoRef = useRef(null);
  const seccionRecepcionRef = useRef(null);
  const seccionMotivoRef = useRef(null);
  const seccionTareasRef = useRef(null);
  const seccionFotosRef = useRef(null);
  const botonGuardarRef = useRef(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const [vehiculoDetectado, setVehiculoDetectado] = useState(null);
  const [ordenActiva, setOrdenActiva] = useState(null);
  const [historialPrevio, setHistorialPrevio] = useState([]);
  const [mecanicos] = useState(() => obtenerMecanicosActivos());
  const [fechaIngresoTexto] = useState(() => new Date().toLocaleString('es-SV'));
  const [servicioMantenimiento, setServicioMantenimiento] = useState(''); 
  const [tareasMarcadas, setTareasMarcadas] = useState(() => new Set());
  const [tareasManuales, setTareasManuales] = useState([]);
  const [tareasOmitidasMotivos, setTareasOmitidasMotivos] = useState({});
  const [nuevaActividad, setNuevaActividad] = useState('');

  const [fotosLados, setFotosLados] = useState({
    frontal: '',
    lateralIzquierdo: '',
    lateralDerecho: '',
    trasera: ''
  });
  const [fotosLadosNuevas, setFotosLadosNuevas] = useState({});
  const [camaraLado, setCamaraLado] = useState('');

  const [form, setForm] = useState({
    placa: '',
    marca: '',
    modelo: '',
    numMotor: '',
    vin: '',
    anio: '',
    kilometraje: '',
    departamento: 'San Salvador',
    ruta: 'Ruta 01 - San Salvador Centro & Escalerón',
    conductorEntrega: '',
    mecanicoReceptor: '',
    diagnosticoInicial: '',   
    motivoIngreso: '',        
    tipoTrabajo: 'Reparación',
    mecanicoAsignado: '',
    tiempoEstimadoHoras: ''
  });
  const [areasSeleccionadas, setAreasSeleccionadas] = useState(() => new Set());

  const hayDatosSinGuardar = Boolean(
    form.placa ||
    form.motivoIngreso ||
    form.kilometraje ||
    tareasMarcadas.size ||
    tareasManuales.length ||
    areasSeleccionadas.size ||
    Object.values(fotosLadosNuevas).some(Boolean)
  );
  useDatosSinGuardar(hayDatosSinGuardar, confirm);

  const cargarBaseFotos = useCallback(async (placa) => {
    try {
      const base = await obtenerFotosBase(placa);
      setFotosLados({
        frontal: base.frontal || '',
        lateralIzquierdo: base.lateralIzquierdo || '',
        lateralDerecho: base.lateralDerecho || '',
        trasera: base.trasera || ''
      });
      setFotosLadosNuevas({});
      if (base.frontal || base.lateralIzquierdo || base.lateralDerecho || base.trasera) {
        addToast('Base fotográfica del vehículo cargada: estado actual de los 4 costados', 'info');
      }
    } catch (e) {
      console.warn('Error cargando base fotográfica:', e);
    }
  }, [addToast]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const p = params.get('placa');
    if (p) {
      setForm(prev => ({ ...prev, placa: normalizarPlaca(p) }));
      cargarBaseFotos(p);
      const v = buscarVehiculoCatalogo(p);
      if (v) {
        setVehiculoDetectado(v);
        setForm(prev => ({
          ...prev,
          marca: v.marca || prev.marca,
          modelo: v.modelo || prev.modelo,
          numMotor: v.numMotor || prev.numMotor,
          vin: v.vin || prev.vin,
          anio: v.anio || prev.anio,
          departamento: v.departamento || prev.departamento,
          ruta: v.ruta || prev.ruta,
          conductorEntrega: v.conductorHabitual || prev.conductorEntrega
        }));
      }
    }
  }, [location.search, cargarBaseFotos]);

  useEffect(() => {
    if (modoAtencion === 'asistencia' && currentUser?.nombre) {
      setForm(prev => ({
        ...prev,
        mecanicoAsignado: esMecanico
          ? (prev.mecanicoAsignado || currentUser.nombre)
          : (prev.mecanicoAsignado === currentUser.nombre ? '' : prev.mecanicoAsignado),
        mecanicoReceptor: esMecanico
          ? (prev.mecanicoReceptor || currentUser.nombre)
          : (prev.mecanicoReceptor === currentUser.nombre ? '' : prev.mecanicoReceptor)
      }));
      addToast(
        esMecanico
          ? `Asistencia en sitio: orden autoasignada a ${currentUser.nombre}`
          : 'Asistencia en sitio: indique el técnico',
        'info'
      );
    }
  }, [modoAtencion, currentUser?.nombre, esMecanico]);

  useEffect(() => {
    if (!currentUser?.nombre) return;
    setForm(prev => {
      if (esMecanico) {
        if (prev.mecanicoReceptor === currentUser.nombre) return prev;
        return { ...prev, mecanicoReceptor: currentUser.nombre };
      }
      return prev.mecanicoReceptor ? prev : { ...prev, mecanicoReceptor: currentUser.nombre };
    });
  }, [currentUser?.nombre, esMecanico]);


  const aplicarAutocompletado = async (placaABuscar) => {
    setOrdenActiva(null);
    cargarBaseFotos(placaABuscar);
    const vehiculo = buscarVehiculoCatalogo(placaABuscar);
    if (vehiculo) {
      setVehiculoDetectado(vehiculo);
      setForm(prev => ({
        ...prev,
        placa: vehiculo.placa,
        marca: vehiculo.marca || '',
        modelo: vehiculo.modelo || '',
        numMotor: vehiculo.numMotor || '',
        vin: vehiculo.vin || '',
        anio: vehiculo.anio || '',
        departamento: vehiculo.departamento || prev.departamento,
        ruta: vehiculo.ruta || prev.ruta,
        conductorEntrega: vehiculo.conductorHabitual || prev.conductorEntrega
      }));
      addToast(`Vehículo detectado en catálogo. Asignado a ${vehiculo.departamento} (${vehiculo.ruta}).`, 'success');
    } else {
      setVehiculoDetectado(null);
    }

    setTimeout(() => {
      (vehiculo ? tipoAtencionRef : datosVehiculoRef).current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);

    try {
      const previas = await buscarPorPlaca(placaABuscar);
      if (previas && previas.length > 0) {
        setHistorialPrevio(previas);
        const abierta = previas.find(o => ESTADOS_EN_TALLER.includes(o.estado));
        if (abierta) {
          setOrdenActiva(abierta);
          addToast(
            `La placa ${placaABuscar} ya está en el taller con la orden ${formatoOT(abierta)} (${etiquetaEstadoOrden(abierta.estado)}). No puede ingresar la unidad de nuevo.`,
            'error',
            9000
          );
        } else if (previas[0].kilometraje) {
          addToast(`Se encontraron ${previas.length} ingresos previos de esta unidad en taller.`, 'info');
        }
      } else {
        setHistorialPrevio([]);
      }
    } catch (err) {
      console.warn('Error buscando historial previo:', err);
    }
  };

  const handleScanSuccess = (placaEscaneada) => {
    setForm(prev => ({ ...prev, placa: placaEscaneada }));
    aplicarAutocompletado(placaEscaneada);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    // El kilometraje se guarda sólo con dígitos; la coma de miles es visual en el campo.
    setForm(prev => ({ ...prev, [name]: name === 'kilometraje' ? soloDigitos(value) : value }));
  };

  const guardarFotoLado = (lado, file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setFotosLados(prev => ({ ...prev, [lado]: url }));
    setFotosLadosNuevas(prev => ({ ...prev, [lado]: file }));
  };

  const handleFotoLadoChange = (lado, e) => {
    guardarFotoLado(lado, e.target.files[0]);
    e.target.value = '';
  };

  const handleQuitarFotoLado = (lado) => {
    setFotosLados(prev => ({ ...prev, [lado]: '' }));
    setFotosLadosNuevas(prev => ({ ...prev, [lado]: '' }));
  };

  const modoMantenimiento = form.tipoTrabajo === 'Mantenimiento';
  const areasArr = [...areasSeleccionadas];
  const areaPrincipalTexto = areasArr.join(', ');
  const areaPorDefecto = modoMantenimiento
    ? 'Mantenimiento'
    : modoAtencion === 'asistencia'
      ? 'Asistencia'
      : 'General';
  const areaDefecto = areasArr[0] || areaPorDefecto;
  const tareasCatalogo = (() => {
    if (modoMantenimiento) {
      return servicioMantenimiento ? obtenerTareasMantenimiento(servicioMantenimiento) : [];
    }
    return areasSeleccionadas.size
      ? obtenerTareasReparacion().filter(t => areasSeleccionadas.has(t.area))
      : [];
  })();

  const tareasFinales = [
    ...tareasCatalogo.filter(t => tareasMarcadas.has(t.id)),
    ...tareasManuales.map(t => ({
      id: t.id,
      _manual: true,
      descripcion: t.descripcion,
      area: areaDefecto,
      tiempoEstimadoMinutos: 60
    }))
  ];

  const tareasOmitidasFinales = modoMantenimiento
    ? tareasCatalogo
      .filter(t => !tareasMarcadas.has(t.id))
      .map(t => ({
        id: t.id,
        descripcion: t.descripcion,
        area: t.area,
        motivo: (tareasOmitidasMotivos[t.id] || '').trim()
      }))
    : [];

  const alternarTarea = (id) => {
    const estabaMarcada = tareasMarcadas.has(id);
    setTareasMarcadas(prev => {
      const next = new Set(prev);
      if (estabaMarcada) next.delete(id); else next.add(id);
      return next;
    });
    if (!estabaMarcada) {
      setTareasOmitidasMotivos(prev => {
        if (!(id in prev)) return prev;
        const { [id]: _quitado, ...resto } = prev;
        return resto;
      });
    }
  };

  const marcarTodas = (marcar) => {
    setTareasMarcadas(prev => {
      const next = new Set(prev);
      tareasCatalogo.forEach(t => { if (marcar) next.add(t.id); else next.delete(t.id); });
      return next;
    });
    if (marcar) setTareasOmitidasMotivos({});
  };

  const marcarMotivoOmitida = (id, texto) => {
    setTareasOmitidasMotivos(prev => ({ ...prev, [id]: texto }));
  };

  const seleccionarMotivo = (motivo) => {
    setForm(prev => ({
      ...prev,
      motivoIngreso: motivo.id,
      tipoTrabajo: motivo.modo === 'mantenimiento' ? 'Mantenimiento' : 'Reparación'
    }));
    setServicioMantenimiento('');
    setAreasSeleccionadas(new Set());
    setTareasMarcadas(new Set());
    setTareasOmitidasMotivos({});
    setTimeout(() => {
      seccionTareasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 250);
  };

  // Tras elegir el tipo de atención, la vista lleva a verificar el vehículo
  // y registrar el kilometraje antes de seguir con la recepción.
  const seleccionarTipoAtencion = (modo) => {
    setModoAtencion(modo);
    setTimeout(() => {
      datosVehiculoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
  };

  const seleccionarAreaTaller = (area) => {
    const next = new Set(areasSeleccionadas);
    if (next.has(area)) next.delete(area); else next.add(area);
    setAreasSeleccionadas(next);

    const validas = new Set(
      (next.size ? obtenerTareasReparacion().filter(t => next.has(t.area)) : []).map(t => t.id)
    );
    setTareasMarcadas(prev => {
      const limpio = new Set([...prev].filter(id => validas.has(id)));
      return limpio;
    });
  };

  const seleccionarServicioMantenimiento = (grupo) => {
    const apagando = servicioMantenimiento === grupo;
    setServicioMantenimiento(apagando ? '' : grupo);
    if (apagando) {
      setTareasMarcadas(new Set());
    } else {
      const todas = obtenerTareasMantenimiento(grupo);
      setTareasMarcadas(new Set(todas.map(t => t.id)));
    }
    setTareasOmitidasMotivos({});
  };

  const agregarActividadManual = () => {
    const desc = nuevaActividad.trim();
    if (!desc) {
      addToast('Escribe una descripción antes de agregar la actividad', 'warning');
      return;
    }
    setTareasManuales(prev => [...prev, { id: `manual-${Date.now()}-${prev.length}`, descripcion: desc }]);
    setNuevaActividad('');
  };

  const quitarActividadManual = (id) => {
    setTareasManuales(prev => prev.filter(a => a.id !== id));
  };

  const quitarTareaCatalogo = (id) => {
    setTareasMarcadas(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.placa.trim()) {
      addToast('La placa del vehículo es obligatoria', 'warning');
      return;
    }
    if (!vehiculoDetectado) {
      addToast('La unidad no está registrada en la flota. Registre el vehículo para poder continuar.', 'error');
      return;
    }
    if (ordenActiva) {
      addToast(`Esta unidad ya tiene una orden abierta en el taller (${formatoOT(ordenActiva)}). No es posible ingresarla de nuevo.`, 'error');
      return;
    }
    if (modoAtencion === 'taller') {
      if (!form.conductorEntrega.trim()) {
        addToast('El nombre del conductor es obligatorio', 'warning');
        return;
      }
      if (form.conductorEntrega.trim().length < 3) {
        addToast('Indica el nombre completo del conductor (al menos 3 caracteres)', 'warning');
        return;
      }
    }
    if (!form.mecanicoReceptor.trim()) {
      addToast('Seleccione el mecánico receptor', 'warning');
      return;
    }
    if (!form.motivoIngreso) {
      addToast('Seleccione el Motivo de Ingreso', 'warning');
      return;
    }
    if (form.motivoIngreso === 'falla' && areasSeleccionadas.size === 0) {
      addToast('Seleccione al menos un Área de Taller', 'warning');
      return;
    }
    const motivoSel = MOTIVOS_INGRESO.find(m => m.id === form.motivoIngreso);
    if (motivoSel?.requiereTexto && !form.diagnosticoInicial.trim()) {
      addToast('Describa el motivo en el campo de texto', 'warning');
      return;
    }
    if (form.tipoTrabajo === 'Mantenimiento' && !servicioMantenimiento) {
      addToast('Elija el servicio de mantenimiento (5,000 o 20,000 km)', 'warning');
      return;
    }
    if (tareasOmitidasFinales.some(t => !t.motivo)) {
      addToast('Indique el motivo por el que se omite cada tarea de mantenimiento', 'warning');
      return;
    }

    if (form.kilometraje !== '' && form.kilometraje !== null && form.kilometraje !== undefined) {
      const kmNum = Number(form.kilometraje);
      if (isNaN(kmNum) || kmNum < 0) {
        addToast('El kilometraje debe ser un valor numérico positivo mayor o igual a 0', 'error');
        return;
      }
    }

    if (form.tiempoEstimadoHoras !== '' && form.tiempoEstimadoHoras !== null && form.tiempoEstimadoHoras !== undefined) {
      const horasNum = parseFloat(form.tiempoEstimadoHoras);
      if (isNaN(horasNum) || horasNum < 0 || horasNum > 1000) {
        addToast('El tiempo estimado en horas debe ser un número entre 0 y 1,000', 'error');
        return;
      }
    }

    if (modoAtencion === 'taller') {
      const faltantes = LADOS_VEHICULO.filter((lado) => !fotosLados[lado]);
      if (faltantes.length > 0) {
        const nombres = {
          frontal: 'Frontal',
          lateralIzquierdo: 'Lateral Izquierdo',
          lateralDerecho: 'Lateral Derecho',
          trasera: 'Trasera'
        };
        addToast(
          `Falta${faltantes.length > 1 ? 'n' : ''} la${faltantes.length > 1 ? 's' : ''} foto${faltantes.length > 1 ? 's' : ''}: ` +
          `${faltantes.map((lado) => nombres[lado]).join(', ')}. ` +
          'El ingreso al taller se registra únicamente con las 4 fotos del estado actual de la unidad.',
          'warning',
          9000
        );
        return;
      }
    }

    // Revalidación al momento de guardar: la orden pudo abrirse en otra
    // pestaña mientras se llenaba el formulario.
    try {
      const previasFrescas = await buscarPorPlaca(form.placa);
      const abiertaFresca = previasFrescas?.find(o => ESTADOS_EN_TALLER.includes(o.estado));
      if (abiertaFresca) {
        setOrdenActiva(abiertaFresca);
        addToast(`Esta unidad ya tiene una orden abierta en el taller (${formatoOT(abiertaFresca)}). No es posible ingresarla de nuevo.`, 'error');
        return;
      }
    } catch (err) {
      console.warn('No se pudo revalidar órdenes abiertas:', err);
    }

    const placaPreview = normalizarPlaca(form.placa) || 'sin placa';
    const confirmadoOrden = await confirm({
      title: modoAtencion === 'asistencia' ? '¿Registrar asistencia?' : '¿Crear orden de trabajo?',
      message: `Se registrará la unidad "${placaPreview}"${form.marca ? ` (${form.marca}${form.modelo ? ` ${form.modelo}` : ''})` : ''} y la orden quedará visible para todo el taller.`,
      confirmText: 'Sí, crear orden',
      cancelText: 'Cancelar',
      danger: false
    });
    if (!confirmadoOrden) return;

    setLoading(true);
    try {
      const placaLimpia = normalizarPlaca(form.placa);
      const cambiosLados = {};
      for (const lado of LADOS_VEHICULO) {
        if (Object.prototype.hasOwnProperty.call(fotosLadosNuevas, lado)) {
          cambiosLados[lado] = fotosLadosNuevas[lado];
        }
      }
      if (placaLimpia && Object.keys(cambiosLados).length > 0) {
        const { errores } = await guardarFotosBase(
          placaLimpia,
          cambiosLados,
          currentUser?.nombre || ''
        );
        if (errores.length > 0) {
          addToast(
            `No se pudo subir: ${errores.join(', ')}. Se conservaron las fotos anteriores.`,
            'warning',
            7000
          );
        } else {
          addToast('Fotos del vehículo actualizadas (las 4 de la base)', 'success');
        }
      }

      await crearOrden({
        ...form,
        placa: placaLimpia,
        areaPrincipal: areaPrincipalTexto || areaPorDefecto,
        kilometraje: form.kilometraje ? Number(form.kilometraje) : null,
        costoRepuestos: 0,
        costoManoObra: 0,
        costoTotal: 0,
        tipoAtencion: modoAtencion,
        creadoPor: currentUser?.nombre || 'Sistema',
        tiempoEstimadoHoras: parseFloat(form.tiempoEstimadoHoras) || 0,
        ...(tareasFinales.length > 0
          ? { actividades: construirActividades(tareasFinales, form.mecanicoAsignado, areaDefecto) }
          : {}),
        ...(tareasOmitidasFinales.length > 0 ? { tareasOmitidas: tareasOmitidasFinales } : {})
      });

      addToast(
        modoAtencion === 'asistencia'
          ? `Asistencia registrada y autoasignada a ${form.mecanicoAsignado || currentUser?.nombre}`
          : 'Orden de trabajo creada exitosamente',
        'success'
      );
      navigate('/ordenes');
    } catch (error) {
      console.error(error);
      addToast('Error al crear la orden: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const placaNoEnFlota = form.placa.trim().length >= 4 && !vehiculoDetectado;
  const camposBloqueados = !vehiculoDetectado;

  const fotosCompletas = LADOS_VEHICULO.filter((lado) => fotosLados[lado]).length;

  const kmAnterior = historialPrevio?.[0]?.kilometraje;
  const kmAnteriorTexto = kmAnterior ? `${formatearMiles(kmAnterior)} km` : 'Sin registro';

  const caracteristicasVehiculo = [
    ['Marca', form.marca],
    ['Modelo', form.modelo],
    ['Año', form.anio],
    ['N° de Motor', form.numMotor],
    ['VIN', form.vin],
    ['Departamento', form.departamento],
    ['Ruta asignada', form.ruta],
    ['Kilometraje anterior', kmAnteriorTexto]
  ];

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <BotonVolver a="/ordenes" etiqueta="Volver a Órdenes" />
          <h1>Nueva Orden de Trabajo</h1>
          <p>Recepción e ingreso de vehiculos.</p>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={() => setIsScannerOpen(true)}
          style={{ gap: 8, boxShadow: 'var(--shadow-glow)' }}
        >
          <IconoMascara src="/iconos/camara-de-video.png" size={20} /> Obtener Placa
        </button>
      </div>

      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      <CameraModal
        isOpen={Boolean(camaraLado)}
        onClose={() => setCamaraLado('')}
        onFoto={archivo => guardarFotoLado(camaraLado, archivo)}
      />

      <form onSubmit={handleSubmit}>
        <div className="card" ref={tipoAtencionRef} style={{ marginBottom: 24, scrollMarginTop: 84 }}>
          <div className="form-section-title" style={{ marginTop: 0 }}>
            <IconoMascara className="icon" src="/iconos/consultas-taller.png" size={16} /> Tipo de Atención *
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 12 }}>
            <button
              type="button"
              className="option-card"
              onClick={() => seleccionarTipoAtencion('taller')}
              style={{
                textAlign: 'left',
                padding: '16px 18px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                border: `1.5px solid ${modoAtencion === 'taller' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: modoAtencion === 'taller' ? 'rgba(134,153,46,0.10)' : 'var(--color-bg-card)',
                color: 'var(--color-text-primary)',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start'
              }}
            >
              <IconoMascara src="/iconos/llave-inglesa.png" size={22} estilo={{ color: 'var(--color-accent)', marginTop: 2 }} />
              <span>
                <strong style={{ display: 'block', fontSize: 15, marginBottom: 3 }}>Ingreso a Taller</strong>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  La unidad queda en el taller para reparación.
                </span>
              </span>
            </button>

            <button
              type="button"
              className="option-card"
              onClick={() => seleccionarTipoAtencion('asistencia')}
              style={{
                textAlign: 'left',
                padding: '16px 18px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                border: `1.5px solid ${modoAtencion === 'asistencia' ? '#f59e0b' : 'var(--color-border)'}`,
                background: modoAtencion === 'asistencia' ? 'rgba(245, 158, 11, 0.10)' : 'var(--color-bg-card)',
                color: 'var(--color-text-primary)',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start'
              }}
            >
              <IconoMascara src="/iconos/ubicacion-taller.png" size={22} estilo={{ color: '#f59e0b', marginTop: 2 }} />
              <span>
                <strong style={{ display: 'block', fontSize: 15, marginBottom: 3 }}>Asistencia en Sitio</strong>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  Atención en el lugar, sin ingreso al taller.
                </span>
              </span>
            </button>
          </div>

          {modoAtencion === 'asistencia' && currentUser?.nombre && (
            <div className="form-bloque" style={{
              marginTop: 14,
              padding: '10px 14px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              color: '#f59e0b',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <TbCircleCheck style={{ fontSize: 16, flexShrink: 0 }} />
              <span>
                {esMecanico
                  ? <>Autoasignada a <strong>{currentUser.nombre}</strong>.</>
                  : <>Elija el <strong>técnico</strong> y el <strong>encargado</strong>.</>}
              </span>
            </div>
          )}
        </div>

        <div
          className="card"
          ref={datosVehiculoRef}
          style={{ marginBottom: 24, scrollMarginTop: 84 }}
        >
          <div className="form-section-title" style={{ marginTop: 0 }}>
            <IconoMascara className="icon" src="/iconos/taller-reparacion.png" size={16} /> Datos del Vehículo
          </div>

          {ordenActiva && (
            <div role="alert" style={{
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#ef4444',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontSize: 13
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <TbAlertTriangle style={{ fontSize: 16, flexShrink: 0 }} />
                <span>Vehículo ya ingresado al taller: no puede darse de alta de nuevo</span>
              </div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 400 }}>
                La unidad mantiene la orden <strong>{formatoOT(ordenActiva)}</strong> en
                estado <strong>{etiquetaEstadoOrden(ordenActiva.estado)}</strong>. Entregue o cierre esa
                orden antes de registrar un nuevo ingreso.
              </div>
            </div>
          )}

          {historialPrevio && historialPrevio.length > 0 && (
            <div className="form-bloque" style={{
              background: 'rgba(134,153,46,0.10)',
              border: '1px solid rgba(134,153,46,0.3)',
              color: 'var(--color-text)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontSize: 13
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#60a5fa', fontWeight: 600 }}>
                <TbClipboardList style={{ fontSize: 16 }} />
                <span>Expediente histórico encontrado: {historialPrevio.length} {historialPrevio.length === 1 ? 'visita previa' : 'visitas previas'}</span>
              </div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                Último ingreso: <strong>{historialPrevio[0].fechaIngreso?.toDate ? historialPrevio[0].fechaIngreso.toDate().toLocaleDateString('es-SV') : 'Reciente'}</strong> &bull; Km anterior: <strong>{historialPrevio[0].kilometraje ? `${formatearMiles(historialPrevio[0].kilometraje)} km` : 'No registrado'}</strong> &bull; Falla previa: <em>{historialPrevio[0].diagnosticoInicial || 'Mantenimiento preventivo'}</em>
              </div>
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Placa o Código QR *</label>
              <div style={{
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 12px',
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: 15,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: form.placa ? 'var(--color-text-primary)' : 'var(--color-text-muted)'
              }}>
                <IconoMascara src="/iconos/camara-de-video.png" size={17} estilo={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                {form.placa || 'Sin placa'}
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Carga automática al <strong style={{ color: 'var(--color-accent)' }}>Obtener Placa</strong>
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Nuevo Kilometraje (Km)</label>
              <input
                type="text"
                name="kilometraje"
                value={formatoKmEntrada(form.kilometraje)}
                onChange={handleChange}
                placeholder="Kilometraje actual del odómetro"
                className="form-input"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="next"
                disabled={camposBloqueados}
              />
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {camposBloqueados ? 'Bloqueado hasta registrar placa válida.' : 'Editable.'}
              </span>
            </div>

            {placaNoEnFlota && (
              <div className="form-group full-width form-bloque">
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1.5px solid rgba(239, 68, 68, 0.45)',
                  color: '#ef4444',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)'
                }}>
                  <TbLock style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, textTransform: 'none' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>
                      La unidad no está registrada en la flota.
                    </div>
                    <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                      Los demás campos del formulario permanecen bloqueados. Registre primero el vehículo en el módulo de flota para poder habilitar el ingreso a taller.
                    </div>
                    {esAdmin && (
                      <div style={{ marginTop: 10 }}>
                        <Link to="/admin/vehiculos" className="btn btn-sm btn-secondary" style={{ color: '#ef4444', borderColor: '#ef4444' }}>
                          Ir al Registro de Vehículos
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!form.placa.trim() && (
              <div className="form-group full-width">
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  
                </span>
              </div>
            )}
          </div>

          {vehiculoDetectado && (
            <div className="form-bloque" style={{
              marginTop: 4,
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-input)',
              padding: '11px 14px 13px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 10.5,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: 0.7,
                color: 'var(--color-accent)',
                marginBottom: 10
              }}>
                <TbCircleCheck style={{ fontSize: 14 }} />
                Información almacenada en el sistema — {form.placa}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))',
                gap: '8px 16px'
              }}>
                {caracteristicasVehiculo.map(([etiqueta, valor]) => (
                  <div key={etiqueta} style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      color: 'var(--color-text-muted)'
                    }}>
                      {etiqueta}
                    </div>
                    <div style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: etiqueta === 'Kilometraje anterior' ? 'var(--color-accent)' : 'var(--color-text-primary)',
                      fontFamily: ['VIN', 'N° de Motor'].includes(etiqueta) ? 'var(--font-mono)' : 'inherit',
                      wordBreak: 'break-word'
                    }}>
                      {valor || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <fieldset
            disabled={camposBloqueados}
            style={{
              border: 'none',
              padding: 0,
              margin: 0,
              opacity: camposBloqueados ? 0.45 : 1,
              pointerEvents: camposBloqueados ? 'none' : 'auto',
              transition: 'opacity 0.25s ease'
            }}
          >
            <div className="form-section-title" ref={seccionRecepcionRef}>
              <IconoMascara className="icon" src="/iconos/personal-taller.png" size={16} /> Datos de Recepción, Encargado y Personal
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">
                  Conductor que Entrega {modoAtencion === 'asistencia' ? '(opcional en asistencia en sitio)' : '*'}
                </label>
                <input
                  type="text"
                  name="conductorEntrega"
                  value={form.conductorEntrega}
                  onChange={handleChange}
                  placeholder="Nombre completo del motorista"
                  className="form-input"
                  autoComplete="name"
                  enterKeyHint="next"
                  required={modoAtencion === 'taller'}
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Usuario Receptor *{esMecanico && (
                    <TbLock style={{ marginLeft: 5, verticalAlign: -1, color: 'var(--color-text-muted)' }} title="Bloqueado por sesión" />
                  )}
                </label>
                <input
                  list="lista-mecanicos-receptor"
                  name="mecanicoReceptor"
                  value={form.mecanicoReceptor}
                  onChange={handleChange}
                  placeholder="Escriba para buscar un mecánico..."
                  className="form-input"
                  required={modoAtencion === 'taller'}
                  disabled={esMecanico}
                  style={{ fontSize: 13, opacity: esMecanico ? 0.75 : 1, cursor: esMecanico ? 'not-allowed' : 'text' }}
                />
                <datalist id="lista-mecanicos-receptor">
                  {mecanicos.map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {esMecanico
                    ? <><TbLock style={{ marginRight: 4, verticalAlign: -1 }} />Bloqueado: {currentUser.nombre} recibe la unidad.</>
                    : modoAtencion === 'asistencia'
                      ? 'Técnico que acudirá al sitio.'
                      : form.mecanicoReceptor && currentUser?.nombre && form.mecanicoReceptor === currentUser.nombre
                        ? `Automático: ${currentUser.nombre}.`
                        : 'Técnico que recibe la unidad.'}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Encargado de trabajar en la Unidad
                  {(esMecanico && modoAtencion === 'asistencia') && (
                    <TbLock style={{ marginLeft: 5, verticalAlign: -1, color: 'var(--color-text-muted)' }} title="Bloqueado por sesión" />
                  )}
                </label>
                <input
                  list="lista-mecanicos-encargado"
                  name="mecanicoAsignado"
                  value={form.mecanicoAsignado}
                  onChange={handleChange}
                  placeholder="Sin asignación — escriba para buscar un mecánico..."
                  className="form-input"
                  disabled={esMecanico && modoAtencion === 'asistencia'}
                  style={{ fontSize: 13, opacity: (esMecanico && modoAtencion === 'asistencia') ? 0.75 : 1, cursor: (esMecanico && modoAtencion === 'asistencia') ? 'not-allowed' : 'text' }}
                />
                <datalist id="lista-mecanicos-encargado">
                  {mecanicos.map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {esMecanico && modoAtencion === 'asistencia'
                    ? <>Bloqueado: tú introduces la unidad.</>
                    : modoAtencion === 'asistencia'
                      ? 'Opcional: cualquier mecánico.'
                      : 'Opcional: asígnelo a un compañero o déjelo sin asignar.'}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Tiempo Estimado de Solución (horas)</label>
                <input
                  type="number"
                  name="tiempoEstimadoHoras"
                  value={form.tiempoEstimadoHoras}
                  onChange={handleChange}
                  placeholder="Horas estimadas de trabajo"
                  className="form-input"
                  min="0"
                  step="0.5"
                  inputMode="decimal"
                  enterKeyHint="done"
                />
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  SLA operativo para cálculo de tiempos hombre
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Fecha y Hora de Ingreso (Automática)</label>
                <input
                  type="text"
                  value={fechaIngresoTexto}
                  className="form-input"
                  disabled
                  style={{ opacity: 0.7 }}
                />
              </div>
            </div>

            <div className="form-section-title" ref={seccionMotivoRef}>
              <IconoMascara className="icon" src="/iconos/registro.png" size={16} /> Motivo de Ingreso *
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 10 }}>
              Seleccione el tipo de servicio requerido para la unidad.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 10, marginBottom: 12 }}>
              {MOTIVOS_INGRESO.map(m => {
                const activo = form.motivoIngreso === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="option-card"
                    onClick={() => seleccionarMotivo(m)}
                    style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      border: `1.5px solid ${activo ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      background: activo ? 'var(--color-accent-light)' : 'var(--color-bg-card)',
                      color: 'var(--color-text-primary)',
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      minHeight: 52
                    }}
                  >
                    <span style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: `2px solid ${activo ? 'var(--color-accent)' : 'var(--color-text-muted)'}`,
                      background: activo ? 'var(--color-accent)' : 'transparent',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {activo && <TbCircleCheck size={11} color="#fff" />}
                    </span>
                    <strong style={{ fontSize: 14.5 }}>{m.label}</strong>
                  </button>
                );
              })}
            </div>

            {MOTIVOS_INGRESO.find(m => m.id === form.motivoIngreso)?.requiereTexto && (
              <div className="form-group full-width form-bloque" style={{ marginBottom: 14 }}>
                <label className="form-label">Describa el motivo / problema *</label>
                <textarea
                  name="diagnosticoInicial"
                  value={form.diagnosticoInicial}
                  onChange={handleChange}
                  placeholder="Describa el problema o la razón del ingreso..."
                  className="form-textarea"
                  rows={3}
                />
              </div>
            )}

            {form.motivoIngreso === 'falla' && (
              <div className="form-bloque">
                <div className="form-section-title">
                  <IconoMascara className="icon" src="/iconos/taller.png" size={16} /> Áreas de Taller *
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                  Seleccione las especialidades asignadas a la reparación.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                  {AREAS_SELECT.map(area => {
                    const activo = areasSeleccionadas.has(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => seleccionarAreaTaller(area)}
                        style={{
                          padding: '10px 14px',
                          fontSize: 13.5,
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          border: `1.5px solid ${activo ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          background: activo ? 'var(--color-accent-light)' : 'var(--color-bg-card)',
                          color: activo ? 'var(--color-accent)' : 'var(--color-text-primary)',
                          fontWeight: activo ? 700 : 500,
                          minHeight: 44,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        {activo && <TbCheck size={14} style={{ flexShrink: 0 }} />}
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="form-section-title" ref={seccionTareasRef}>
              <IconoMascara className="icon" src="/iconos/llave-inglesa.png" size={16} /> Tareas a Realizar
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 10 }}>
              {modoMantenimiento ? (
                <>Protocolo de servicio pre-cargado. Si omite alguna tarea, justifique el motivo.</>
              ) : (
                <>Seleccione las tareas que se incorporarán a la orden de trabajo.</>
              )}
            </p>

            {modoMantenimiento && (
              <div className="form-bloque" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                  1. Elija el servicio de mantenimiento:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 10 }}>
                  {GRUPOS_MANTENIMIENTO.map(g => {
                    const activo = servicioMantenimiento === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        className="option-card"
                        onClick={() => seleccionarServicioMantenimiento(g.id)}
                        style={{
                          textAlign: 'left',
                          padding: '14px 16px',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          border: `1.5px solid ${activo ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          background: activo ? 'var(--color-accent-light)' : 'var(--color-bg-card)',
                          color: 'var(--color-text-primary)',
                          display: 'flex',
                          gap: 12,
                          alignItems: 'flex-start'
                        }}
                      >
                        <TbCircleCheck style={{ fontSize: 22, color: activo ? 'var(--color-accent)' : 'var(--color-text-muted)', marginTop: 2, flexShrink: 0 }} />
                        <span>
                          <strong style={{ display: 'block', fontSize: 15, marginBottom: 3 }}>{g.nombre}</strong>
                          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{g.resumen}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {form.motivoIngreso === 'falla' && areasSeleccionadas.size === 0 && (
              <p className="form-bloque" style={{ fontSize: 12.5, color: 'var(--color-text-muted)', padding: '10px 12px', background: 'var(--color-bg-input)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', margin: 0, marginBottom: 12 }}>
                Seleccione al menos un área de taller para desplegar las tareas sugeridas.
              </p>
            )}

            {tareasCatalogo.length > 0 && (
              <div className="task-checklist form-bloque">
                <div className="task-checklist-header">
                  <span>{tareasMarcadas.size} de {tareasCatalogo.length} seleccionadas</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => marcarTodas(true)}>Todas</button>
                    {!modoMantenimiento && (
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => marcarTodas(false)}>Ninguna</button>
                    )}
                  </div>
                </div>
                {tareasCatalogo.map(t => {
                  const marcada = tareasMarcadas.has(t.id);
                  const omitidaEnMantenimiento = modoMantenimiento && !marcada;
                  return (
                    <div key={t.id}>
                      <label className={`task-check-item ${marcada ? 'is-checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() => alternarTarea(t.id)}
                        />
                        <span className="task-check-desc">{t.descripcion}</span>
                        <span className="task-check-meta">
                          <span className="task-check-area">{t.area}</span>
                          <span className="task-check-time">{t.tiempoEstimadoMinutos} min</span>
                        </span>
                      </label>
                      {omitidaEnMantenimiento && (
                        <div className="task-omission">
                          <label className="task-omission-label">Motivo por el que se omite *</label>
                          <input
                            type="text"
                            className="form-input"
                            value={tareasOmitidasMotivos[t.id] || ''}
                            onChange={(e) => marcarMotivoOmitida(t.id, e.target.value)}
                            placeholder="Motivo u observación de omisión..."
                            enterKeyHint="done"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {modoMantenimiento && !servicioMantenimiento && (
              <p className="form-bloque" style={{ fontSize: 12.5, color: 'var(--color-text-muted)', padding: '10px 12px', background: 'var(--color-bg-input)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', margin: 0 }}>
                Seleccione la pauta de kilometraje para cargar las actividades correspondientes.
              </p>
            )}

            {tareasFinales.length > 0 && (
              <div className="form-bloque" style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                  Actividades que se crearán ({tareasFinales.length}):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {tareasFinales.map((a, i) => (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 13
                      }}
                    >
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 800,
                        color: 'var(--color-accent)',
                        background: 'var(--color-accent-light)',
                        borderRadius: 4,
                        padding: '2px 6px',
                        flexShrink: 0
                      }}>
                        #{i + 1}
                      </span>
                      <span style={{ flex: 1, color: 'var(--color-text-primary)' }}>{a.descripcion}</span>
                      <span style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        background: 'var(--color-bg-input)',
                        borderRadius: 4,
                        padding: '2px 6px',
                        flexShrink: 0
                      }}>
                        {a.area}
                      </span>
                      <button
                        type="button"
                        onClick={() => (a._manual ? quitarActividadManual(a.id) : quitarTareaCatalogo(a.id))}
                        title="Quitar actividad"
                        style={{
                          background: 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.3)',
                          color: '#ef4444',
                          borderRadius: 4,
                          width: 24,
                          height: 24,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          flexShrink: 0
                        }}
                      >
                        <TbX size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tareasOmitidasFinales.length > 0 && (
              <div className="form-bloque" style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                  Tareas omitidas ({tareasOmitidasFinales.length}):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {tareasOmitidasFinales.map(a => (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        background: 'var(--color-bg-input)',
                        border: '1px dashed var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 13
                      }}
                    >
                      <span style={{ flex: 1, color: 'var(--color-text-secondary)' }}>{a.descripcion}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic', flexShrink: 0 }}>
                        {a.motivo || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                ¿Falta una tarea? Agréguela (opcional):
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 1 }}
                  value={nuevaActividad}
                  onChange={(e) => setNuevaActividad(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarActividadManual(); } }}
                  placeholder="Descripción de la tarea a agregar..."
                  enterKeyHint="done"
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={agregarActividadManual}
                  title="Agregar esta actividad a la OT"
                  style={{ padding: '10px 16px', fontSize: 18, lineHeight: 1, flexShrink: 0 }}
                >
                  <TbPlus />
                </button>
              </div>
            </div>

            <div className="form-section-title" ref={seccionFotosRef}>
              <IconoMascara className="icon" src="/iconos/camara-fotografica.png" size={16} /> Inspección Perimetral 360° (Estado Actual de la Unidad)
              <span
                className={`badge ${fotosCompletas === LADOS_VEHICULO.length ? 'badge-finalizado' : 'badge-pausado'}`}
                style={{ marginLeft: 8, fontSize: 10.5, padding: '2px 8px' }}
              >
                {fotosCompletas}/{LADOS_VEHICULO.length} fotos
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 14 }}>
              Registro fotográfico perimetral del vehículo. Las 4 tomas son obligatorias para el ingreso formal a taller.
            </p>

            <div className="side-photos-grid">
              <div className="side-photo-card">
                <div className="side-photo-header">
                  <span className="side-photo-label"><IconoMascara src="/iconos/camara-fotografica.png" size={12} /> 1. Frontal</span>
                  <span className="side-photo-angle-tag">Frente</span>
                </div>
                {fotosLados.frontal ? (
                  <div className="side-photo-preview">
                    <img src={fotosLados.frontal} alt="Vista Frontal" />
                    <span className="badge-captured"><TbCircleCheck /> Lista</span>
                    <button
                      type="button"
                      className="remove-btn"
                      title="Eliminar foto"
                      onClick={() => handleQuitarFotoLado('frontal')}
                    >
                      <TbX />
                    </button>
                  </div>
                ) : (
                  <div className="side-photo-upload">
                    <div className="upload-icon-circle">
                      <IconoMascara src="/iconos/camara-fotografica.png" size={20} />
                    </div>
                    <span className="side-photo-upload-text">Foto Frontal</span>
                    <span className="side-photo-upload-hint">Frente y parrilla</span>
                    <div className="side-photo-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm side-photo-option"
                        onClick={() => setCamaraLado('frontal')}
                      >
                        <IconoMascara src="/iconos/camara-fotografica.png" size={12} /> Cámara
                      </button>
                      <label className="btn btn-secondary btn-sm side-photo-option">
                        <TbUpload /> Subir
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFotoLadoChange('frontal', e)}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="side-photo-card">
                <div className="side-photo-header">
                  <span className="side-photo-label"><IconoMascara src="/iconos/camara-fotografica.png" size={12} /> 2. Lateral Izquierdo</span>
                  <span className="side-photo-angle-tag">Conductor</span>
                </div>
                {fotosLados.lateralIzquierdo ? (
                  <div className="side-photo-preview">
                    <img src={fotosLados.lateralIzquierdo} alt="Lateral Izquierdo" />
                    <span className="badge-captured"><TbCircleCheck /> Lista</span>
                    <button
                      type="button"
                      className="remove-btn"
                      title="Eliminar foto"
                      onClick={() => handleQuitarFotoLado('lateralIzquierdo')}
                    >
                      <TbX />
                    </button>
                  </div>
                ) : (
                  <div className="side-photo-upload">
                    <div className="upload-icon-circle">
                      <IconoMascara src="/iconos/camara-fotografica.png" size={20} />
                    </div>
                    <span className="side-photo-upload-text">Costado Izq.</span>
                    <span className="side-photo-upload-hint">Lado del motorista</span>
                    <div className="side-photo-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm side-photo-option"
                        onClick={() => setCamaraLado('lateralIzquierdo')}
                      >
                        <IconoMascara src="/iconos/camara-fotografica.png" size={12} /> Cámara
                      </button>
                      <label className="btn btn-secondary btn-sm side-photo-option">
                        <TbUpload /> Subir
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFotoLadoChange('lateralIzquierdo', e)}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="side-photo-card">
                <div className="side-photo-header">
                  <span className="side-photo-label"><IconoMascara src="/iconos/camara-fotografica.png" size={12} /> 3. Lateral Derecho</span>
                  <span className="side-photo-angle-tag">Acompañante</span>
                </div>
                {fotosLados.lateralDerecho ? (
                  <div className="side-photo-preview">
                    <img src={fotosLados.lateralDerecho} alt="Lateral Derecho" />
                    <span className="badge-captured"><TbCircleCheck /> Lista</span>
                    <button
                      type="button"
                      className="remove-btn"
                      title="Eliminar foto"
                      onClick={() => handleQuitarFotoLado('lateralDerecho')}
                    >
                      <TbX />
                    </button>
                  </div>
                ) : (
                  <div className="side-photo-upload">
                    <div className="upload-icon-circle">
                      <IconoMascara src="/iconos/camara-fotografica.png" size={20} />
                    </div>
                    <span className="side-photo-upload-text">Costado Der.</span>
                    <span className="side-photo-upload-hint">Lado del copiloto</span>
                    <div className="side-photo-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm side-photo-option"
                        onClick={() => setCamaraLado('lateralDerecho')}
                      >
                        <IconoMascara src="/iconos/camara-fotografica.png" size={12} /> Cámara
                      </button>
                      <label className="btn btn-secondary btn-sm side-photo-option">
                        <TbUpload /> Subir
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFotoLadoChange('lateralDerecho', e)}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="side-photo-card">
                <div className="side-photo-header">
                  <span className="side-photo-label"><IconoMascara src="/iconos/camara-fotografica.png" size={12} /> 4. Vista Trasera</span>
                  <span className="side-photo-angle-tag">Posterior</span>
                </div>
                {fotosLados.trasera ? (
                  <div className="side-photo-preview">
                    <img src={fotosLados.trasera} alt="Vista Trasera" />
                    <span className="badge-captured"><TbCircleCheck /> Lista</span>
                    <button
                      type="button"
                      className="remove-btn"
                      title="Eliminar foto"
                      onClick={() => handleQuitarFotoLado('trasera')}
                    >
                      <TbX />
                    </button>
                  </div>
                ) : (
                  <div className="side-photo-upload">
                    <div className="upload-icon-circle">
                      <IconoMascara src="/iconos/camara-fotografica.png" size={20} />
                    </div>
                    <span className="side-photo-upload-text">Foto Trasera</span>
                    <span className="side-photo-upload-hint">Compuerta / Baúl</span>
                    <div className="side-photo-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm side-photo-option"
                        onClick={() => setCamaraLado('trasera')}
                      >
                        <IconoMascara src="/iconos/camara-fotografica.png" size={12} /> Cámara
                      </button>
                      <label className="btn btn-secondary btn-sm side-photo-option">
                        <TbUpload /> Subir
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFotoLadoChange('trasera', e)}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </fieldset>
        </div>

        <div className="form-actions-bar" ref={botonGuardarRef}>
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={async () => {
              if (hayDatosSinGuardar) {
                const ok = await confirm({
                  title: '¿Cancelar la orden?',
                  message: AVISO_DATOS_SIN_GUARDAR,
                  confirmText: 'Sí, salir',
                  cancelText: 'Seguir aquí',
                });
                if (!ok) return;
              }
              navigate(-1);
            }}
          >
            <TbX /> Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading || camposBloqueados || Boolean(ordenActiva)}
            title={
              ordenActiva
                ? 'Esta unidad ya tiene una orden abierta en el taller: no puede ingresar de nuevo'
                : camposBloqueados
                  ? 'Debe registrar o escanear una placa registrada en la flota para ingresar la orden'
                  : ''
            }
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                {modoAtencion === 'asistencia' ? 'Guardando...' : 'Registrando...'}
              </>
            ) : (
              <>
                <TbDeviceFloppy /> {modoAtencion === 'asistencia' ? 'Guardar Asistencia' : 'Ingresar a Taller'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
