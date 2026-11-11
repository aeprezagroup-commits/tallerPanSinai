import BotonVolver from '../components/BotonVolver';
import { useState, useEffect, useCallback, useRef } from 'react';
import { normalizarPlaca } from '../utils/placas';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  TbClipboardList,
  TbCamera,
  TbUpload,
  TbDeviceFloppy,
  TbX,
  TbCircleCheck,
  TbCheck,
  TbPlus,
  TbLock,
} from '../icons';
import { crearOrden, buscarPorPlaca } from '../firebase/ordenesService';
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

// Convierte la lista de tareas (del catálogo tocado o escritas a mano)
// en actividades de la OT con su área y tiempo estimado
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

export default function NuevaOrden() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast, confirm } = useToast();
  const { currentUser, isAdmin: esAdmin } = useAuth();
  // El mecánico que llena la recepción queda atado a su usuario: receptor y encargado no se modifican
  const esMecanico = currentUser?.rol === 'mecanico';

  const [loading, setLoading] = useState(false);
  // Tipo de atención: 'taller' (ingreso normal) o 'asistencia' (técnico en sitio, autoasignado)
  const [modoAtencion, setModoAtencion] = useState('taller');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  // Anclas para navegación y scroll automático intuitivo (especialmente en móvil)
  const datosVehiculoRef = useRef(null);
  const seccionRecepcionRef = useRef(null);
  const seccionMotivoRef = useRef(null);
  const seccionTareasRef = useRef(null);
  const seccionFotosRef = useRef(null);
  const botonGuardarRef = useRef(null);
  const pendienteScrollRef = useRef(false);

  // Al abrir el formulario de nueva orden, asegurar inicio en la parte superior
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const [vehiculoDetectado, setVehiculoDetectado] = useState(null);
  const [historialPrevio, setHistorialPrevio] = useState([]);
  const [mecanicos] = useState(() => obtenerMecanicosActivos());
  const [fechaIngresoTexto] = useState(() => new Date().toLocaleString('es-SV'));
  // ---- ACTIVIDADES / CHECKLIST DE TAREAS ----
  // El mecánico toca tareas de un catálogo precargado en vez de escribirlas.
  // tareasMarcadas: ids del catálogo seleccionadas (Set)
  // tareasManuales: tareas escritas a mano (para lo que no está en la lista)
  // tareasOmitidasMotivos: motivo por el que se desmarcó una tarea de MANTENIMIENTO (pre-marcada)
  const [servicioMantenimiento, setServicioMantenimiento] = useState(''); // 'mantenimiento_5000' | 'mantenimiento_20000'
  const [tareasMarcadas, setTareasMarcadas] = useState(() => new Set());
  const [tareasManuales, setTareasManuales] = useState([]);
  const [tareasOmitidasMotivos, setTareasOmitidasMotivos] = useState({});
  const [nuevaActividad, setNuevaActividad] = useState('');

  // Fotos de los 4 costados: mostradas desde la BASE del vehículo (estado actual).
  // Solo se suben a la base los archivos que el usuario cambie en este formulario.
  const [fotosLados, setFotosLados] = useState({
    frontal: '',
    lateralIzquierdo: '',
    lateralDerecho: '',
    trasera: ''
  });
  const [fotosLadosNuevas, setFotosLadosNuevas] = useState({});

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
    diagnosticoInicial: '',   // descripción libre del motivo (si el motivo la requiere)
    motivoIngreso: '',        // id del motivo seleccionado (define Mantenimiento vs Reparación)
    tipoTrabajo: 'Reparación',// se deriva del motivo (compatibilidad con datos guardados)
    mecanicoAsignado: '',
    tiempoEstimadoHoras: ''
  });
  // Áreas de Taller elegidas para "Fallas o daños" (1 o varias → tareas de cada una).
  // Se guarda como Set; el valor de texto (para la OT) se deriva: areaPrincipalTexto.
  const [areasSeleccionadas, setAreasSeleccionadas] = useState(() => new Set());

  // Carga la base fotográfica del vehículo (estado actual de los 4 costados)
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

  // En modo "Asistencia": el usuario que llegó al lugar y presionó el botón se autoasigna de inmediato
  useEffect(() => {
    if (modoAtencion === 'asistencia' && currentUser?.nombre) {
      setForm(prev => ({
        ...prev,
        // El encargado/admin NO acude al sitio: no se autoasigna nada con su
        // nombre (se limpia si lo estaba) para que indiquen quién acude y quién
        // introduce la unidad. El mecánico sí acude → queda con su usuario.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoAtencion, currentUser?.nombre, esMecanico]);

  // El Mecánico Receptor se llena SOLO con el usuario logueado: nadie más puede estar usando esa sesión.
  // Si quien recibe es un MECÁNICO, el receptor queda BLOQUEADO con su usuario.
  // La ASIGNACIÓN (encargado) en Ingreso a Taller sí puede decidirse: compañero, uno mismo o sin asignar.
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


  // Función para autocompletar si la placa existe en el catálogo de Pan Sinaí o en órdenes previas
  const aplicarAutocompletado = async (placaABuscar) => {
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
      // Auto-scroll hacia la sección de recepción de forma suave
      setTimeout(() => {
        seccionRecepcionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
    } else {
      setVehiculoDetectado(null);
    }

    // Buscar historial previo de este vehículo en el taller
    try {
      const previas = await buscarPorPlaca(placaABuscar);
      if (previas && previas.length > 0) {
        setHistorialPrevio(previas);
        // Pre-cargar kilometraje si no está puesto
        const ultima = previas[0];
        if (ultima.kilometraje) {
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
    pendienteScrollRef.current = true;
  };

  // Al cerrarse el escáner tras una lectura exitosa, la vista baja hasta la
  // ficha de la unidad: en móvil el resultado quedaba fuera de pantalla.
  useEffect(() => {
    if (isScannerOpen || !pendienteScrollRef.current) return;
    pendienteScrollRef.current = false;
    datosVehiculoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isScannerOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleFotoLadoChange = (lado, e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setFotosLados(prev => ({ ...prev, [lado]: url }));
      // Se sube a la BASE del vehículo al guardar la orden (no a la evidencia de la orden)
      setFotosLadosNuevas(prev => ({ ...prev, [lado]: file }));
    }
    e.target.value = '';
  };

  const handleQuitarFotoLado = (lado) => {
    setFotosLados(prev => ({ ...prev, [lado]: '' }));
    setFotosLadosNuevas(prev => ({ ...prev, [lado]: '' }));
  };

  // ---- CHECKLIST: selección de tareas del catálogo ----
  // El catálogo visible depende del MOTIVO de ingreso:
  //  - Mantenimiento  → lista del servicio tocado (5,000 o 20,000 km), PRE-MARCADA
  //  - Fallas o daños → tareas de TODAS las áreas seleccionadas (1 o varias)
  const modoMantenimiento = form.tipoTrabajo === 'Mantenimiento';
  const areasArr = [...areasSeleccionadas];
  const areaPrincipalTexto = areasArr.join(', ');
  const areaDefecto = areasArr[0] || 'General';
  const tareasCatalogo = (() => {
    if (modoMantenimiento) {
      return servicioMantenimiento ? obtenerTareasMantenimiento(servicioMantenimiento) : [];
    }
    return areasSeleccionadas.size
      ? obtenerTareasReparacion().filter(t => areasSeleccionadas.has(t.area))
      : [];
  })();

  // Tareas finales que se convertirán en actividades de la OT:
  // las marcadas del catálogo + las escritas a mano
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

  // Tareas de MANTENIMIENTO desmarcadas (la lista viene pre-marcada; si se quita
  // una, debe indicarse el motivo: repuesto faltante, no aplica, etc.)
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

  // Alterna el "check" de una tarea del catálogo visible
  const alternarTarea = (id) => {
    const estabaMarcada = tareasMarcadas.has(id);
    setTareasMarcadas(prev => {
      const next = new Set(prev);
      if (estabaMarcada) next.delete(id); else next.add(id);
      return next;
    });
    if (!estabaMarcada) {
      // Se vuelve a marcar como hecha → ya no pide motivo de omisión
      setTareasOmitidasMotivos(prev => {
        if (!(id in prev)) return prev;
        const { [id]: _quitado, ...resto } = prev;
        return resto;
      });
    }
  };

  // Marca o desmarca todas las tareas del catálogo visible
  const marcarTodas = (marcar) => {
    setTareasMarcadas(prev => {
      const next = new Set(prev);
      tareasCatalogo.forEach(t => { if (marcar) next.add(t.id); else next.delete(t.id); });
      return next;
    });
    if (marcar) setTareasOmitidasMotivos({});
  };

  // Motivo por el que se omite una tarea de mantenimiento (pre-marcada desmarcada)
  const marcarMotivoOmitida = (id, texto) => {
    setTareasOmitidasMotivos(prev => ({ ...prev, [id]: texto }));
  };

  // Motivo de ingreso → define Mantenimiento vs Reparación y limpia el checklist
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
    // Auto-scroll hacia la sección de tareas/áreas
    setTimeout(() => {
      seccionTareasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
  };

  // Áreas de Taller → en "Fallas o daños" es selección MÚLTIPLE (1 o varias).
  // Al cambiarlas, las marcas de tareas que ya no pertenecen a las áreas elegidas
  // se podan para que el contador y el envío sean coherentes.
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

  // Servicio de mantenimiento (5,000 / 20,000 km): al elegirlo, la lista viene PRE-MARCADA
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

  // Tareas escritas a mano (escapan al catálogo)
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

    // REGLA DE OPERACIÓN: el camión que INGRESA AL TALLER no puede guardarse
    // sin su registro fotográfico. La orden no guarda copia de las fotos: la
    // base del vehículo es el único registro, así que este es el momento en
    // que se completan o actualizan los 4 costados.
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

    // Confirmación previa: la orden se escribe en la base compartida.
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
      // 1) Actualizar la BASE fotográfica del vehículo.
      //    REGLA: cada vehículo tiene SOLO 4 fotos para toda su vida.
      //    Si el camión no tiene fotos, aquí se cargan; si un costado cambia
      //    (golpe nuevo, reparación), se elimina la vieja y se pone la nueva.
      //    La orden NUNCA guarda copia: solo lee las 4 de la base.
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

      // 2) Crear la orden. Sin fotos embebidas: el documento queda de ~1 KB
      //    y en Detalle de Orden se muestran las 4 fotos vigentes de la base.
      await crearOrden({
        ...form,
        placa: placaLimpia,
        areaPrincipal: areaPrincipalTexto || 'General',
        kilometraje: form.kilometraje ? Number(form.kilometraje) : null,
        costoRepuestos: 0,
        costoManoObra: 0,
        costoTotal: 0,
        tipoAtencion: modoAtencion,
        creadoPor: currentUser?.nombre || 'Sistema',
        tiempoEstimadoHoras: parseFloat(form.tiempoEstimadoHoras) || 0,
        // Tareas tocadas en el checklist + manuales → actividades de la OT
        ...(tareasFinales.length > 0
          ? { actividades: construirActividades(tareasFinales, form.mecanicoAsignado, areaDefecto) }
          : {}),
        // Tareas de mantenimiento omitidas (pre-marcadas y desmarcadas) con su motivo
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

  // ¿La placa ya se escribió/escaneó pero no corresponde a una unidad de la flota?
  const placaNoEnFlota = form.placa.trim().length >= 4 && !vehiculoDetectado;
  // Regla operativa: si la unidad no existe en la flota, los campos de trabajo deben permanecer bloqueados
  const camposBloqueados = !vehiculoDetectado;

  // Estado del registro fotográfico (obligatorio para el ingreso al taller)
  const fotosCompletas = LADOS_VEHICULO.filter((lado) => fotosLados[lado]).length;

  // Kilometraje anterior guardado en el sistema (última visita de la unidad)
  const kmAnterior = historialPrevio?.[0]?.kilometraje;
  const kmAnteriorTexto = kmAnterior ? `${Number(kmAnterior).toLocaleString('es-SV')} km` : 'Sin registro';

  // Características de la unidad → un solo cuadro informativo (solo lectura)
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
          <TbCamera style={{ fontSize: 20 }} /> Obtener Placa
        </button>
      </div>

      {/* Modal de Escaneo con Cámara */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      <form onSubmit={handleSubmit}>
        {/* SECCIÓN: Tipo de Atención (dos apartados: Ingreso a Taller / Asistencia) */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="form-section-title" style={{ marginTop: 0 }}>
            <IconoMascara className="icon" src="/iconos/consultas-taller.png" size={16} /> Tipo de Atención *
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 12 }}>
            <button
              type="button"
              className="option-card"
              onClick={() => setModoAtencion('taller')}
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
              onClick={() => setModoAtencion('asistencia')}
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
          {/* SECCIÓN: Datos del vehículo */}
          <div className="form-section-title" style={{ marginTop: 0 }}>
            <IconoMascara className="icon" src="/iconos/taller-reparacion.png" size={16} /> Datos del Vehículo
          </div>

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
                Último ingreso: <strong>{historialPrevio[0].fechaIngreso?.toDate ? historialPrevio[0].fechaIngreso.toDate().toLocaleDateString('es-SV') : 'Reciente'}</strong> &bull; Km anterior: <strong>{historialPrevio[0].kilometraje ? `${historialPrevio[0].kilometraje.toLocaleString()} km` : 'No registrado'}</strong> &bull; Falla previa: <em>{historialPrevio[0].diagnosticoInicial || 'Mantenimiento preventivo'}</em>
              </div>
            </div>
          )}

          <div className="form-grid">
            {/* Placa: SOLO se obtiene con el botón verde (digitar / QR / foto) */}
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
                <TbCamera style={{ color: 'var(--color-accent)', fontSize: 17, flexShrink: 0 }} />
                {form.placa || 'Sin placa'}
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Carga automática al <strong style={{ color: 'var(--color-accent)' }}>Obtener Placa</strong>
              </span>
            </div>

            {/* Kilometraje NUEVO: editable solo si la unidad es válida */}
            <div className="form-group">
              <label className="form-label">Nuevo Kilometraje (Km)</label>
              <input
                type="number"
                name="kilometraje"
                value={form.kilometraje}
                onChange={handleChange}
                placeholder="Kilometraje actual del odómetro"
                min="0"
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

            {/* Aviso de bloqueo estricto: la placa NO corresponde a una unidad de la flota */}
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

            {/* Aún no se obtiene la placa */}
            {!form.placa.trim() && (
              <div className="form-group full-width">
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  
                </span>
              </div>
            )}
          </div>

          {/* CUADRO INFORMATIVO: todas las características de la unidad que quedan
              almacenadas en el sistema (solo lectura, en un solo espacio) */}
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

          {/* SECCIÓN: Datos de Recepción, Diagnóstico, Tareas y Fotos protegidos por el registro de flota */}
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
              {/* Receptor: automático con el usuario logueado (quien recibe la unidad).
                Para el MECÁNICO queda BLOQUEADO con su sesión (no editable).
                Asignación (encargado): en Ingreso a Taller se decide (compañero, uno mismo o SIN ASIGNAR);
                en Asistencia en Sitio queda autoasignada y bloqueada */}
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

              {/* Encargado de INTRODUCCIÓN de la unidad: en Ingreso a Taller ya se
                podía decidir; en Asistencia en Sitio el encargado/admin también
                puede elegir cualquier mecánico (solo el MECÁNICO queda bloqueado). */}
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

            {/* SECCIÓN: Motivo de Ingreso — 2 opciones: Mantenimiento programado | Fallas o daños */}
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

            {/* Si el motivo es "Otro", describir el problema */}
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

            {/* SECCIÓN: Áreas de Taller — solo en "Fallas o danos": el usuario elige 1 o varias */}
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

            {/* SECCIÓN: Tareas a realizar — checklist precargado (sin escribir) */}
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

            {/* Mantenimiento: elegir servicio 5,000 / 20,000 km (la lista sale PRE-MARCADA) */}
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

            {/* Fallas: las tareas salen de las áreas elegidas arriba */}
            {form.motivoIngreso === 'falla' && areasSeleccionadas.size === 0 && (
              <p className="form-bloque" style={{ fontSize: 12.5, color: 'var(--color-text-muted)', padding: '10px 12px', background: 'var(--color-bg-input)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', margin: 0, marginBottom: 12 }}>
                Seleccione al menos un área de taller para desplegar las tareas sugeridas.
              </p>
            )}

            {/* Paso 2: checklist de tareas del catálogo */}
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
                  // En mantenimiento, si la tarea viene DESMARCADA (pre-marcada quitada) pide motivo
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

            {/* Mantenimiento sin servicio elegido todavía */}
            {modoMantenimiento && !servicioMantenimiento && (
              <p className="form-bloque" style={{ fontSize: 12.5, color: 'var(--color-text-muted)', padding: '10px 12px', background: 'var(--color-bg-input)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', margin: 0 }}>
                Seleccione la pauta de kilometraje para cargar las actividades correspondientes.
              </p>
            )}

            {/* Resumen: las actividades que se crearán en la OT */}
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

            {/* Tareas de mantenimiento omitidas (pre-marcadas y desmarcadas, con motivo) */}
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

            {/* Paso 4: agregar una tarea que no esté en la lista (opcional) */}
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

            {/* SECCIÓN: Inspección Perimetral = ESTADO ACTUAL (base fotográfica del vehículo) */}
            <div className="form-section-title" ref={seccionFotosRef}>
              <TbCamera className="icon" /> Inspección Perimetral 360° (Estado Actual de la Unidad)
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
              {/* Frontal */}
              <div className="side-photo-card">
                <div className="side-photo-header">
                  <span className="side-photo-label"><TbCamera /> 1. Frontal</span>
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
                      <TbCamera />
                    </div>
                    <span className="side-photo-upload-text">Foto Frontal</span>
                    <span className="side-photo-upload-hint">Frente y parrilla</span>
                    {/* Siempre las DOS opciones: tomar desde cámara o subir */}
                    <div className="side-photo-actions">
                      <label className="btn btn-primary btn-sm side-photo-option">
                        <TbCamera /> Cámara
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFotoLadoChange('frontal', e)}
                        />
                      </label>
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

              {/* Lateral Izquierdo */}
              <div className="side-photo-card">
                <div className="side-photo-header">
                  <span className="side-photo-label"><TbCamera /> 2. Lateral Izquierdo</span>
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
                      <TbCamera />
                    </div>
                    <span className="side-photo-upload-text">Costado Izq.</span>
                    <span className="side-photo-upload-hint">Lado del motorista</span>
                    {/* Siempre las DOS opciones: tomar desde cámara o subir */}
                    <div className="side-photo-actions">
                      <label className="btn btn-primary btn-sm side-photo-option">
                        <TbCamera /> Cámara
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFotoLadoChange('lateralIzquierdo', e)}
                        />
                      </label>
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

              {/* Lateral Derecho */}
              <div className="side-photo-card">
                <div className="side-photo-header">
                  <span className="side-photo-label"><TbCamera /> 3. Lateral Derecho</span>
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
                      <TbCamera />
                    </div>
                    <span className="side-photo-upload-text">Costado Der.</span>
                    <span className="side-photo-upload-hint">Lado del copiloto</span>
                    {/* Siempre las DOS opciones: tomar desde cámara o subir */}
                    <div className="side-photo-actions">
                      <label className="btn btn-primary btn-sm side-photo-option">
                        <TbCamera /> Cámara
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFotoLadoChange('lateralDerecho', e)}
                        />
                      </label>
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

              {/* Trasera */}
              <div className="side-photo-card">
                <div className="side-photo-header">
                  <span className="side-photo-label"><TbCamera /> 4. Vista Trasera</span>
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
                      <TbCamera />
                    </div>
                    <span className="side-photo-upload-text">Foto Trasera</span>
                    <span className="side-photo-upload-hint">Compuerta / Baúl</span>
                    {/* Siempre las DOS opciones: tomar desde cámara o subir */}
                    <div className="side-photo-actions">
                      <label className="btn btn-primary btn-sm side-photo-option">
                        <TbCamera /> Cámara
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFotoLadoChange('trasera', e)}
                        />
                      </label>
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

        {/* Botones de acción (sticky al pie en móvil) */}
        <div className="form-actions-bar" ref={botonGuardarRef}>
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={() => navigate(-1)}
          >
            <TbX /> Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading || camposBloqueados}
            title={camposBloqueados ? 'Debe registrar o escanear una placa registrada en la flota para ingresar la orden' : ''}
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
