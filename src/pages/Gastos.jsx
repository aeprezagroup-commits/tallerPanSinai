import BotonVolver from '../components/BotonVolver';
import { useState, useEffect, useMemo } from 'react';
import {
  TbPlus, TbDownload, TbSearch, TbFilter, TbTrash, TbPencil,
  TbReportMoney, TbX, TbStack2, TbCircleCheck, TbAlertTriangle, TbTruck
} from '../icons';
import {
  escucharGastos, guardarGasto, actualizarGasto, eliminarGasto,
  montoConDescuento, CENTROS_COSTO
} from '../services/gastosService';
import { obtenerFlotaVehiculos, centroCostoPorDepartamento, opcionesCatalogo } from '../services/vehiculosService';
import { escucharOrdenes, formatoOT } from '../firebase/ordenesService';
import { useToast } from '../components/ToastContext';
import ModalPortal from '../components/ModalPortal';

const FORM_VACIO = {
  fecha: new Date().toISOString().slice(0, 10),
  tipo: 'proveedor',
  dte: '',
  vale: '',
  proveedor: '',
  gastos: '',
  cantidad: '',
  monto: '',
  descuento: '',
  centroCosto: '',
  estado: 'por_pagar',
  unidad: '',
  ordenId: ''
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;

const normPlaca = (p) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const toMillis = (v) => {
  if (!v) return null;
  if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate().getTime();
  if (v instanceof Date) return v.getTime();
  const d = new Date(v);
  return isNaN(d) ? null : d.getTime();
};

const fmtFecha = (f) => {
  if (!f) return '—';
  const s = String(f).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
};

const fmtFechaAuto = (v) => {
  const ms = toMillis(v);
  if (!ms) return '—';
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

// Referencia documental: DTE/CCF de proveedor o N° de vale del almacén
const docRef = (g) => {
  if (g?.dte || g?.ccf) return g.dte || g.ccf;
  if (g?.vale) return `VALE ${g.vale}`;
  return '—';
};

const esAlmacenG = (g) => g?.tipo === 'almacen' || (!g?.dte && !g?.ccf && !!g?.vale);

// En almacén no se captura dinero (el costo lo lleva otro sistema): si el
// registro no tiene monto, en lugar de $0.00 se muestra un guion.
const montoTexto = (g) => (esAlmacenG(g) && !(Number(g.monto) > 0)) ? '—' : fmtMoney(montoConDescuento(g));

// OTs de una placa vigentes en un mes (YYYY-MM): no canceladas,
// ingreso antes del fin del mes y salida/abierta después del inicio del mes
function calcularOtsDelMes(ordenes, unidad, mes) {
  const k = normPlaca(unidad);
  if (!k) return [];
  const [y, m] = String(mes || '').split('-').map(Number);
  if (!y || !m) return [];
  const inicioMes = new Date(y, m - 1, 1).getTime();
  const finMes = new Date(y, m, 1).getTime();
  return ordenes
    .filter(o => {
      if (normPlaca(o?.placa) !== k) return false;
      if (o?.estado === 'cancelado') return false;
      const ini = toMillis(o.fechaIngreso);
      if (ini === null) return false;
      const fin = toMillis(o.fechaSalida) ?? Number.POSITIVE_INFINITY;
      return ini < finMes && fin >= inicioMes;
    })
    .sort((a, b) => (toMillis(b.fechaIngreso) || 0) - (toMillis(a.fechaIngreso) || 0));
}

export default function Gastos() {
  const { addToast, confirm } = useToast();
  const [gastos, setGastos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 900) ? 'cards' : 'fila');

  // Filtros
  const mesActual = new Date().toISOString().slice(0, 7);
  const [filtroMes, setFiltroMes] = useState(mesActual);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCentro, setFiltroCentro] = useState('Todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Modal de registro/edición
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  // Flota vigente (ruta, ubicación y centro de costo de cada unidad)
  const [flota, setFlota] = useState(() => {
    try { return obtenerFlotaVehiculos() || []; } catch { return []; }
  });

  useEffect(() => {
    const unsubG = escucharGastos((data) => {
      setGastos(Array.isArray(data) ? data : []);
      setLoading(false);
    });
    const unsubO = escucharOrdenes((data) => {
      setOrdenes(Array.isArray(data) ? data : []);
    });
    // La flota puede cambiar (nuevas unidades o cambio de ruta/centro de costo)
    const onFlota = () => {
      try { setFlota(obtenerFlotaVehiculos() || []); } catch { setFlota([]); }
    };
    window.addEventListener('pan_sinai_vehicles_updated', onFlota);
    return () => {
      unsubG();
      unsubO();
      window.removeEventListener('pan_sinai_vehicles_updated', onFlota);
    };
  }, []);

  // Catálogo de vehículos: base de OT + flota vigente.
  // La flota manda en asignación actual (ruta, ubicación, centro de costo).
  const catalogo = useMemo(() => {
    const map = new Map();
    ordenes.forEach(o => {
      const k = normPlaca(o?.placa);
      if (!k) return;
      map.set(k, {
        placa: o.placa || '',
        marca: o.marca || '', modelo: o.modelo || '', anio: o.anio || '',
        tipo: '',
        conductor: o.conductorEntrega || '',
        ruta: o.ruta || '',
        departamento: o.departamento || '',
        centroCosto: centroCostoPorDepartamento(o.departamento),
        fuente: 'Historial de OT'
      });
    });
    try {
      flota.forEach(v => {
        const k = normPlaca(v?.placa);
        if (!k) return;
        const prev = map.get(k) || {};
        map.set(k, {
          placa: v.placa,
          marca: v.marca || prev.marca || '',
          modelo: v.modelo || prev.modelo || '',
          anio: v.anio || prev.anio || '',
          tipo: v.tipo || prev.tipo || '',
          conductor: v.conductorHabitual || prev.conductor || '',
          ruta: v.ruta || prev.ruta || '',
          departamento: v.departamento || prev.departamento || '',
          centroCosto: v.centroCosto
            || centroCostoPorDepartamento(v.departamento)
            || prev.centroCosto || '',
          fuente: 'Flota Pan Sinaí'
        });
      });
    } catch { /* sin flota local */ }
    return map;
  }, [ordenes, flota]);

  const placasConocidas = useMemo(() => {
    const set = new Set();
    catalogo.forEach(v => v?.placa && set.add(v.placa));
    gastos.forEach(g => g?.unidad && set.add(g.unidad));
    return Array.from(set);
  }, [catalogo, gastos]);

  // Vehículo detectado al escribir/seleccionar la placa
  const vehiculoDetectado = useMemo(() => {
    const k = normPlaca(form.unidad);
    if (!k) return null;
    const v = catalogo.get(k);
    return v ? { encontrado: true, ...v } : { encontrado: false, placa: form.unidad.trim() };
  }, [form.unidad, catalogo]);

  // OTs del mes en las que se puede cargar el gasto
  // (mes de la fecha del gasto, placa coincidente, no cancelada,
  //  y vigente dentro de ese mes: ingreso ≤ fin de mes y salida/hoy ≥ inicio de mes)
  const mesGasto = (form.fecha || '').slice(0, 7);

  const otsDelMes = useMemo(
    () => calcularOtsDelMes(ordenes, form.unidad, mesGasto),
    [ordenes, form.unidad, mesGasto]
  );

  const otsPlacaTotal = useMemo(() => {
    const k = normPlaca(form.unidad);
    if (!k) return 0;
    return ordenes.filter(o => normPlaca(o?.placa) === k && o?.estado !== 'cancelado').length;
  }, [ordenes, form.unidad]);

  const mesLabel = useMemo(() => {
    const [y, m] = mesGasto.split('-').map(Number);
    if (!y || !m) return '';
    return `${MESES[m - 1]} ${y}`;
  }, [mesGasto]);

  const centrosExistentes = useMemo(() => {
    const set = new Set(CENTROS_COSTO);
    gastos.forEach(g => g?.centroCosto && set.add(g.centroCosto));
    return Array.from(set);
  }, [gastos]);

  const mesesDisponibles = useMemo(() => {
    const set = new Set();
    const hoy = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      set.add(mStr);
    }
    gastos.forEach(g => {
      if (g.fecha && g.fecha.length >= 7) {
        set.add(g.fecha.slice(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [gastos]);

  const gastosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = gastos.filter(g => {
      if (q) {
        const texto = `${g.fecha || ''} ${g.ccf || ''} ${g.dte || ''} ${g.vale || ''} ${g.proveedor || ''} ${g.gastos || ''} ${g.centroCosto || ''} ${g.unidad || ''} ${g.ot || ''}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      if (filtroMes && filtroMes !== 'todos' && !(g.fecha || '').startsWith(filtroMes)) return false;
      if (filtroCentro !== 'Todos' && (g.centroCosto || '') !== filtroCentro) return false;
      if (filtroEstado !== 'todos' && (g.estado || 'por_pagar') !== filtroEstado) return false;
      if (fechaDesde && (g.fecha || '') < fechaDesde) return false;
      if (fechaHasta && (g.fecha || '') > fechaHasta) return false;
      return true;
    });
    return lista.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }, [gastos, busqueda, filtroMes, filtroCentro, filtroEstado, fechaDesde, fechaHasta]);

  const totales = useMemo(() => {
    const monto = gastosFiltrados.reduce((s, g) => s + (Number(g.monto) || 0), 0);
    const descuento = gastosFiltrados.reduce((s, g) => s + (Number(g.descuento) || 0), 0);
    const conDescuento = gastosFiltrados.reduce((s, g) => s + montoConDescuento(g), 0);
    return { monto, descuento, conDescuento };
  }, [gastosFiltrados]);

  const abrirNuevo = () => {
    setEditandoId(null);
    setForm({ ...FORM_VACIO, fecha: new Date().toISOString().slice(0, 10) });
    setModalAbierto(true);
  };

  const abrirEdicion = (g) => {
    setEditandoId(g.id);
    // Solo conserva la OT si sigue vigente en el mes de la fecha del gasto
    const mes = (g.fecha || FORM_VACIO.fecha).slice(0, 7);
    const otsValidas = calcularOtsDelMes(ordenes, g.unidad, mes);
    const ordenId = (g.ordenId && otsValidas.some(o => o.id === g.ordenId)) ? g.ordenId : '';
    setForm({
      fecha: g.fecha || FORM_VACIO.fecha,
      tipo: esAlmacenG(g) ? 'almacen' : 'proveedor',
      dte: g.dte ?? g.ccf ?? '',
      vale: g.vale ?? '',
      proveedor: g.proveedor || '',
      gastos: g.gastos || '',
      cantidad: g.cantidad ?? '',
      monto: g.monto ?? '',
      descuento: g.descuento ?? '',
      centroCosto: g.centroCosto || '',
      estado: g.estado || 'por_pagar',
      unidad: g.unidad || '',
      ordenId
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    if (guardando) return;
    setModalAbierto(false);
    setEditandoId(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const next = { ...prev, [name]: value };
      // Al escribir la placa: precargar el centro de costo según la
      // ubicación/centro del vehículo (solo si el usuario no escribió otro)
      if (name === 'unidad') {
        const veh = catalogo.get(normPlaca(value));
        if (veh && !next.centroCosto) {
          const centro = veh.centroCosto || centroCostoPorDepartamento(veh.departamento);
          if (centro) next.centroCosto = centro;
        }
      }
      // Si cambia la placa o la fecha, la OT elegida podría ya no aplicar al mes
      if ((name === 'unidad' || name === 'fecha') && next.ordenId) {
        const lista = calcularOtsDelMes(ordenes, next.unidad, (next.fecha || '').slice(0, 7));
        if (!lista.some(o => o.id === next.ordenId)) next.ordenId = '';
      }
      return next;
    });
  };

  const cambiarTipo = (tipo) => {
    setForm(prev => {
      const cambioDeTipo = prev.tipo !== tipo;
      // Desde almacén no se pide monto (ese costo lo registra otro sistema):
      // al cambiar de tipo se limpia para no guardar un valor oculto.
      const limpiarMonto = tipo === 'almacen' && cambioDeTipo;
      return {
        ...prev,
        tipo,
        // Desde almacén no hay descuento: se limpia para no guardar un valor oculto.
        descuento: tipo === 'almacen' ? '' : prev.descuento,
        ...(limpiarMonto ? { monto: '' } : {}),
        ...(tipo === 'almacen' ? { dte: '', proveedor: '', centroCosto: prev.centroCosto || 'TALLER' } : { vale: '' })
      };
    });
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const esAlmacen = form.tipo === 'almacen';
    if (!form.fecha) {
      addToast('Indica la fecha del gasto operacional', 'error');
      return;
    }
    if (esAlmacen) {
      if (!form.vale.trim()) {
        addToast('Indica el N° de Vale del almacén central', 'error');
        return;
      }
    } else {
      if (!form.proveedor.trim()) {
        addToast('El nombre del proveedor es obligatorio', 'error');
        return;
      }
      if (!form.dte.trim()) {
        addToast('Indica el número de DTE/CCF de la factura', 'error');
        return;
      }
    }
    if (!form.gastos.trim()) {
      addToast('Describe los repuestos o conceptos adquiridos (GASTOS)', 'error');
      return;
    }

    const fechaDate = new Date(form.fecha);
    if (isNaN(fechaDate.getTime())) {
      addToast('La fecha seleccionada no tiene un formato válido', 'error');
      return;
    }

    // La cantidad de repuestos se pide en ambos tipos; desde almacén no se
    // pide monto (ese costo lo registra otro sistema).
    if (form.cantidad !== '' && form.cantidad !== null && form.cantidad !== undefined) {
      const cantNum = Number(form.cantidad);
      if (isNaN(cantNum) || cantNum <= 0) {
        addToast('La cantidad debe ser un valor numérico positivo mayor a 0', 'error');
        return;
      }
    }

    const montoNum = parseFloat(form.monto);
    if (!esAlmacen && (isNaN(montoNum) || montoNum <= 0)) {
      addToast('El monto del gasto debe ser una cifra positiva mayor a $0.00', 'error');
      return;
    }

    const descNum = esAlmacen ? 0 : (parseFloat(form.descuento) || 0);
    if (!esAlmacen && (descNum < 0 || descNum >= montoNum)) {
      addToast('El descuento no puede ser negativo ni igualar/superar el monto total del gasto', 'error');
      return;
    }

    const unidadLimpia = form.unidad.trim().toUpperCase();
    if (unidadLimpia && unidadLimpia.length < 3) {
      addToast('La placa de la unidad debe tener al menos 3 caracteres alfanuméricos', 'error');
      return;
    }

    if (!unidadLimpia && !form.centroCosto.trim()) {
      addToast('Indica la placa de la unidad o el centro de costo asignado al gasto', 'error');
      return;
    }

    // Confirmación previa: el gasto se escribe en la base compartida.
    const docPrevio = esAlmacen ? form.vale.trim() : form.dte.trim();
    const detalle = form.gastos.trim() || 'concepto sin detalle';
    // Almacén: no se pide dinero, así que el aviso habla del vale, no del monto.
    const cantTxt = form.cantidad !== '' && form.cantidad !== null && form.cantidad !== undefined
      ? ` (${form.cantidad} repuestos)` : '';
    const mensajeAlmacen = editandoId
      ? `Se actualizará el vale de almacén ${docPrevio || '(sin número)'} por ${detalle}${cantTxt}. El monto se controla en el almacén.`
      : `Se registrará el vale de almacén ${docPrevio || '(sin número)'} por ${detalle}${cantTxt}. El costo lo controla el almacén.`;
    const confirmadoGasto = await confirm({
      title: editandoId ? '¿Guardar cambios del gasto?' : '¿Registrar un gasto nuevo?',
      message: esAlmacen
        ? mensajeAlmacen
        : editandoId
          ? `Se actualizará el gasto ${docPrevio || '(sin documento)'} por ${fmtMoney(montoNum)}.`
          : `Se registrará un gasto de ${fmtMoney(montoNum)} por ${detalle}.`,
      confirmText: editandoId ? 'Sí, guardar cambios' : 'Sí, registrar gasto',
      cancelText: 'Cancelar',
      danger: false
    });
    if (!confirmadoGasto) return;

    setGuardando(true);
    try {
      const doc = esAlmacen ? form.vale.trim() : form.dte.trim();
      const ordenSel = ordenes.find(o => o.id === form.ordenId);
      const payload = {
        fecha: form.fecha,
        tipo: form.tipo,
        ccf: doc,
        dte: esAlmacen ? '' : form.dte.trim(),
        vale: esAlmacen ? form.vale.trim() : '',
        proveedor: esAlmacen ? '' : form.proveedor.trim(),
        gastos: form.gastos.trim(),
        cantidad: form.cantidad === '' ? '' : (Number(form.cantidad) || form.cantidad),
        // Almacén sin cantidad ni monto capturados: se guarda 0 (nunca NaN).
        monto: Number.isFinite(montoNum) ? montoNum : 0,
        descuento: descNum,
        centroCosto: form.centroCosto.trim() || 'TALLER',
        estado: esAlmacen ? 'almacen' : form.estado,
        unidad: form.unidad.trim().toUpperCase(),
        ordenId: form.ordenId || '',
        ot: ordenSel ? formatoOT(ordenSel) : ''
      };
      if (editandoId) {
        await actualizarGasto(editandoId, payload);
        addToast('Gasto operacional actualizado con éxito', 'success');
      } else {
        await guardarGasto(payload);
        addToast('Gasto operacional registrado con éxito', 'success');
      }
      setModalAbierto(false);
      setEditandoId(null);
    } catch (err) {
      console.error(err);
      addToast('Error al guardar el gasto: ' + (err.message || 'error desconocido'), 'error');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (g) => {
    const doc = docRef(g);
    const emisor = esAlmacenG(g) ? 'Vale Almacén' : (g.proveedor || 'Proveedor');
    const valor = montoTexto(g);

    const confirmado = await confirm({
      title: '¿Eliminar registro de gasto?',
      message: `¿Estás seguro de eliminar el gasto ${doc} (${emisor})${valor === '—' ? '' : ` por valor de ${valor}`}? Esta acción no se puede deshacer.`,
      confirmText: 'Sí, eliminar gasto',
      cancelText: 'Cancelar',
      danger: true
    });

    if (!confirmado) return;

    try {
      await eliminarGasto(g.id);
      addToast(`Gasto ${doc} eliminado correctamente`, 'info');
    } catch (err) {
      console.error(err);
      addToast('Error al eliminar gasto: ' + (err.message || 'error desconocido'), 'error');
    }
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroMes(mesActual);
    setFiltroCentro('Todos');
    setFiltroEstado('todos');
    setFechaDesde('');
    setFechaHasta('');
  };

  const exportarCSV = () => {
    if (gastosFiltrados.length === 0) { addToast('No hay gastos para exportar', 'error'); return; }
    const encabezados = [
      'FECHA', 'CCF', 'PROVEEDOR', 'GASTOS', 'CANTIDAD',
      'DESCUENTO', 'MONTO CON DESCUENTO', 'CENTRO DE COSTO', 'ESTADO', 'UNIDAD', 'OT'
    ];
    const escapar = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = gastosFiltrados.map(g => [
      fmtFecha(g.fecha),
      docRef(g),
      esAlmacenG(g) ? 'BODEGA/ALMACÉN' : (g.proveedor || ''),
      g.gastos || '',
      g.cantidad ?? '',
      fmtMoney(g.descuento),
      montoTexto(g),
      g.centroCosto || '',
      g.estado === 'pagado' ? 'Pagado' : 'Pendiente de pago',
      g.unidad || '',
      g.ot || ''
    ].map(escapar).join(','));
    const csv = '﻿' + [encabezados.join(','), ...filas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gastos_vehiculo_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(`CSV exportado (${gastosFiltrados.length} registros)`, 'success');
  };

  const vehDePlaca = (placa) => catalogo.get(normPlaca(placa));
  const esAlmacen = form.tipo === 'almacen';

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <BotonVolver a="/admin" etiqueta="Volver al Panel" />
          <h1>Gastos por Vehículo</h1>
          <p>Control de facturas, créditos fiscales y vales de almacén por unidad.</p>
        </div>
        <div className="btn-group">
          <button type="button" className="btn btn-secondary" onClick={exportarCSV}>
            <TbDownload /> Exportar CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
            <TbPlus /> Registrar Gasto
          </button>
        </div>
      </div>

      {/* Filtros + totales */}
      <div className="filters-bar" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--color-bg-card)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
        <div className="form-group" style={{ flex: '2 1 260px', minWidth: 220, marginBottom: 0 }}>
          <label className="form-label">Búsqueda</label>
          <div style={{ position: 'relative' }}>
            <TbSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 14 }} />
            <input
              className="form-input"
              style={{ paddingLeft: 32 }}
              placeholder="Buscar por CCF/Vale, proveedor, placa u OT..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group" style={{ flex: '1 1 180px', minWidth: 160, marginBottom: 0 }}>
          <label className="form-label">Mes de Consulta</label>
          <select className="form-select" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
            <option value="todos">Todos los meses</option>
            {mesesDisponibles.map(m => {
              const [y, mesNum] = m.split('-').map(Number);
              const nombre = `${MESES[mesNum - 1]} ${y}`;
              return <option key={m} value={m}>{nombre.toUpperCase()}</option>;
            })}
          </select>
        </div>

        <div className="form-group" style={{ flex: '1 1 180px', minWidth: 160, marginBottom: 0 }}>
          <label className="form-label">Centro de Costo</label>
          <select className="form-select" value={filtroCentro} onChange={(e) => setFiltroCentro(e.target.value)}>
            <option value="Todos">Todos</option>
            {centrosExistentes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="form-group" style={{ flex: '1 1 150px', minWidth: 140, marginBottom: 0 }}>
          <label className="form-label">Estado</label>
          <select className="form-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="todos">Todos los estados</option>
            <option value="por_pagar">Pendiente de pago</option>
            <option value="pagado">Pagado</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="date" className="form-input" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} title="Fecha desde" style={{ fontSize: 12 }} />
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>a</span>
          <input type="date" className="form-input" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} title="Fecha hasta" style={{ fontSize: 12 }} />
        </div>

        <button type="button" className="btn btn-secondary btn-sm" onClick={limpiarFiltros} title="Limpiar filtros">
          <TbFilter /> Limpiar
        </button>

        <div className="btn-group">
          <button className={`btn btn-sm ${vista === 'fila' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setVista('fila')}>
            Vista Fila
          </button>
          <button className={`btn btn-sm ${vista === 'cards' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setVista('cards')}>
            Vista Cuadrícula
          </button>
        </div>
      </div>

      {/* Totales con desglose mensual */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
          Resumen de Gasto {filtroMes !== 'todos' ? `(${MESES[Number(filtroMes.split('-')[1]) - 1]?.toUpperCase()} ${filtroMes.split('-')[0]})` : '(Histórico General)'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {gastosFiltrados.length} gasto(s) contabilizado(s)
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))', gap: 14, marginBottom: 24 }}>
        <div className="card" style={{ padding: 14, margin: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Registros</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{gastosFiltrados.length}</div>
        </div>
        <div className="card" style={{ padding: 14, margin: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Monto total</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{fmtMoney(totales.monto)}</div>
        </div>
        <div className="card" style={{ padding: 14, margin: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Descuentos</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#ef4444' }}>-{fmtMoney(totales.descuento)}</div>
        </div>
        <div className="card" style={{ padding: 14, margin: 0, border: '1px solid rgba(34,197,95,0.35)' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Monto con descuento</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>{fmtMoney(totales.conDescuento)}</div>
        </div>
      </div>

      {gastosFiltrados.length === 0 ? (
        <div className="empty-state">
          <TbStack2 className="empty-state-icon" />
          <h3>Sin gastos registrados</h3>
          <p>Registra el primer gasto con el botón "Registrar Gasto" o ajusta los filtros.</p>
        </div>
      ) : vista === 'fila' ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>FECHA</th>
                <th>CCF / VALE</th>
                <th>PROVEEDOR</th>
                <th>GASTOS</th>
                <th>CANTIDAD</th>
                <th>DESCUENTO</th>
                <th>MONTO CON DESCUENTO</th>
                <th>CENTRO DE COSTO</th>
                <th>ESTADO</th>
                <th>UNIDAD</th>
                <th>OT</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {gastosFiltrados.map(g => {
                const veh = vehDePlaca(g.unidad);
                const almac = esAlmacenG(g);
                return (
                  <tr key={g.id}>
                    <td style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtFecha(g.fecha)}</td>
                    <td style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>{docRef(g)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <strong>{almac ? 'Bodega / Almacén' : (g.proveedor || '—')}</strong>
                      <div style={{ marginTop: 3 }}>
                        <span className="badge badge-info" style={{ fontSize: 9, padding: '2px 6px' }}>{almac ? 'ALMACÉN' : 'PROVEEDOR'}</span>
                      </div>
                    </td>
                    <td style={{ minWidth: 220, fontSize: 12.5 }}>{g.gastos || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{g.cantidad !== '' && g.cantidad != null ? g.cantidad : '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#ef4444' }}>{g.descuento ? `-${fmtMoney(g.descuento)}` : '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#22c55e', whiteSpace: 'nowrap' }}>{montoTexto(g)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className="tech-tag">{g.centroCosto || '—'}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${g.estado === 'pagado' ? 'badge-finalizado' : 'badge-pausado'}`}
                        style={{ fontSize: 10, whiteSpace: 'nowrap' }}
                      >
                        {g.estado === 'pagado' ? 'Pagado' : 'Pendiente de pago'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>{g.unidad || '—'}</span>
                      {veh && (veh.marca || veh.modelo) && (
                        <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>{veh.marca} {veh.modelo}{veh.anio ? ` (${veh.anio})` : ''}</div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {g.ot || '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => abrirEdicion(g)} title="Editar gasto">
                          <TbPencil />
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => handleEliminar(g)} title="Eliminar gasto"
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                          <TbTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="order-cards-grid">
          {gastosFiltrados.map(g => {
            const veh = vehDePlaca(g.unidad);
            const almac = esAlmacenG(g);
            return (
              <div key={g.id} className={`order-card ${g.estado === 'pagado' ? 'estado-finalizado' : 'estado-esperando_repuestos'}`} style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="order-card-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 14 }}>{docRef(g)}</span>
                      <span className="badge badge-info" style={{ fontSize: 9, padding: '2px 7px' }}>{almac ? 'ALMACÉN' : 'PROVEEDOR'}</span>
                      <span className="badge badge-info" style={{ fontSize: 9, padding: '2px 7px' }}>{g.centroCosto || 'SIN CENTRO'}</span>
                      {g.ot && <span className="badge badge-en_proceso" style={{ fontSize: 9, padding: '2px 7px' }}>{g.ot}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                      <strong>{almac ? 'Bodega / Almacén' : (g.proveedor || '—')}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                      {fmtFecha(g.fecha)}{g.unidad ? ` • ${g.unidad}` : ''}
                      {veh && (veh.marca || veh.modelo) ? ` · ${veh.marca} ${veh.modelo}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span className={`badge ${g.estado === 'pagado' ? 'badge-finalizado' : 'badge-pausado'}`} style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
                      {g.estado === 'pagado' ? 'Pagado' : 'Pendiente de pago'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#22c55e', fontSize: 16 }}>
                      {montoTexto(g)}
                    </span>
                  </div>
                </div>
                <div className="order-card-body">
                  <div className="order-card-info" style={{ alignItems: 'flex-start' }}>
                    <TbReportMoney className="icon" style={{ marginTop: 2 }} />
                    <span style={{ fontSize: 12.5 }}>{g.gastos || '—'}</span>
                  </div>
                  {(Number(g.descuento) > 0 || g.cantidad !== '') && (
                    <div className="order-card-info">
                      <TbFilter className="icon" />
                      <span style={{ fontSize: 12 }}>
                        {g.cantidad !== '' ? `Cantidad: ${g.cantidad} · ` : ''}
                        {Number(g.descuento) > 0 ? `Descuento: -${fmtMoney(g.descuento)}` : ''}
                      </span>
                    </div>
                  )}
                </div>
                <div className="order-card-footer">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => abrirEdicion(g)}>
                    <TbPencil /> Editar
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => handleEliminar(g)}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                    <TbTrash /> Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de registro / edición */}
      {modalAbierto && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={cerrarModal}>
            <div className="modal-content" style={{ maxWidth: 780 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ margin: 0 }}>{editandoId ? 'Editar Gasto' : 'Registrar Gasto de Vehículo'}</h3>
                <button type="button" className="modal-close" onClick={cerrarModal} disabled={guardando} aria-label="Cerrar">
                  <TbX />
                </button>
              </div>
              <div className="modal-body" style={{ padding: 20 }}>
                <form onSubmit={handleGuardar}>
                {/* Tipo de registro */}
                <div className="form-group" style={{ gap: 4, marginBottom: 12 }}>
                  <label className="form-label">Tipo de registro *</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className={`btn btn-sm ${!esAlmacen ? 'btn-primary' : 'btn-secondary'}`} onClick={() => cambiarTipo('proveedor')}
                      style={{ flex: '1 1 200px', justifyContent: 'center' }}>
                      Factura de Proveedor (desglose con DTE)
                    </button>
                    <button type="button" className={`btn btn-sm ${esAlmacen ? 'btn-primary' : 'btn-secondary'}`} onClick={() => cambiarTipo('almacen')}
                      style={{ flex: '1 1 200px', justifyContent: 'center' }}>
                      Bodega / Almacén (solo vale, sin DTE)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: 12 }}>
                  <div className="form-group" style={{ gap: 4, marginBottom: 0 }}>
                    <label className="form-label">Fecha *</label>
                    <input type="date" name="fecha" value={form.fecha} onChange={handleChange} className="form-input" required />
                  </div>
                  {!esAlmacen ? (
                    <>
                      <div className="form-group" style={{ gap: 4, marginBottom: 0 }}>
                        <label className="form-label">DTE / CCF *</label>
                        <input name="dte" value={form.dte} onChange={handleChange} className="form-input" placeholder="Número de DTE / CCF" style={{ fontFamily: 'var(--font-mono)' }} />
                      </div>
                      <div className="form-group" style={{ gap: 4, marginBottom: 0 }}>
                        <label className="form-label">Proveedor *</label>
                        <input name="proveedor" value={form.proveedor} onChange={handleChange} className="form-input" placeholder="Razón social del proveedor" />
                      </div>
                    </>
                  ) : (
                    <div className="form-group" style={{ gap: 4, marginBottom: 0 }}>
                      <label className="form-label">N° de Vale (Bodega) *</label>
                      <input name="vale" value={form.vale} onChange={handleChange} className="form-input" placeholder="Número de vale de almacén" style={{ fontFamily: 'var(--font-mono)' }} />
                    </div>
                  )}
                  <div className="form-group" style={{ gap: 4, marginBottom: 0 }}>
                    <label className="form-label">Unidad (busca la placa) *</label>
                    <select name="unidad" value={form.unidad} onChange={handleChange} className="form-select"
                      style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                      <option value="">— Seleccione la unidad —</option>
                      {opcionesCatalogo(placasConocidas, form.unidad).map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Vehículo detectado en la base: ficha completa (ruta, ubicación, centro de costo) */}
                {vehiculoDetectado && (
                  <div style={{
                    marginTop: 12, padding: '10px 12px',
                    borderRadius: 'var(--radius-md)', fontSize: 13,
                    background: vehiculoDetectado.encontrado ? 'rgba(34,197,95,0.08)' : 'rgba(245,158,11,0.1)',
                    border: `1px solid ${vehiculoDetectado.encontrado ? 'rgba(34,197,95,0.3)' : 'rgba(245,158,11,0.35)'}`,
                    display: 'flex', gap: 10, alignItems: 'flex-start'
                  }}>
                    <TbTruck style={{ fontSize: 18, flexShrink: 0, color: vehiculoDetectado.encontrado ? '#22c55e' : '#f59e0b', marginTop: 2 }} />
                    {vehiculoDetectado.encontrado ? (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div>
                          <strong>Vehículo encontrado:</strong>{' '}
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{vehiculoDetectado.placa}</span>
                          {' — '}{vehiculoDetectado.marca} {vehiculoDetectado.modelo}{vehiculoDetectado.anio ? ` (${vehiculoDetectado.anio})` : ''}
                          {vehiculoDetectado.fuente ? <span style={{ color: 'var(--color-text-muted)' }}> · {vehiculoDetectado.fuente}</span> : null}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: '4px 14px', marginTop: 8 }}>
                          <div style={{ fontSize: 12 }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>Ruta asignada: </span>
                            <strong>{vehiculoDetectado.ruta || 'Sin ruta asignada'}</strong>
                          </div>
                          <div style={{ fontSize: 12 }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>Ubicación: </span>
                            <strong>{vehiculoDetectado.departamento || '—'}</strong>
                          </div>
                          <div style={{ fontSize: 12 }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>Centro de costo: </span>
                            <span className="tech-tag">
                              {vehiculoDetectado.centroCosto || centroCostoPorDepartamento(vehiculoDetectado.departamento) || 'SIN DEFINIR'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12 }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>Conductor: </span>
                            <strong>{vehiculoDetectado.conductor || '—'}</strong>
                          </div>
                          {vehiculoDetectado.tipo && (
                            <div style={{ fontSize: 12 }}>
                              <span style={{ color: 'var(--color-text-muted)' }}>Tipo: </span>
                              {vehiculoDetectado.tipo}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 7 }}>
                          El centro de costo se precargó desde la ubicación actual de la unidad. Si la empresa la muda de ruta/departamento, actualízalo en Administración → Personal &amp; Flota CSV.
                        </div>
                      </div>
                    ) : (
                      <span>
                        <strong>Placa no encontrada</strong> en flota ni en órdenes existentes. Se registrará el gasto con la placa escrita igualmente.
                      </span>
                    )}
                  </div>
                )}

                {/* OT del mes disponibles para esa placa */}
                <div className="form-group" style={{ gap: 4, marginTop: 12, marginBottom: 0 }}>
                  <label className="form-label">
                    OT en las que se puede cargar el gasto {mesLabel ? `(${mesLabel})` : ''}
                  </label>
                  <select name="ordenId" value={form.ordenId} onChange={handleChange} className="form-select"
                    disabled={!normPlaca(form.unidad)}>
                    <option value="">
                      {!normPlaca(form.unidad)
                        ? '— Ingresa la placa primero —'
                        : (otsDelMes.length > 0 ? '— Sin OT (gasto general) —' : '— Sin OT disponible en el mes —')}
                    </option>
                    {otsDelMes.map(o => (
                      <option key={o.id} value={o.id}>
                        {formatoOT(o)} · {o.placa} · {String(o.estado || '').replace(/_/g, ' ')} · ingreso {fmtFechaAuto(o.fechaIngreso)}
                      </option>
                    ))}
                  </select>
                  {normPlaca(form.unidad) && (
                    <div style={{ fontSize: 11.5, color: otsDelMes.length > 0 ? 'var(--color-text-muted)' : '#f59e0b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {otsDelMes.length > 0 ? (
                        <><TbCircleCheck style={{ color: '#22c55e' }} /> {otsDelMes.length} OT vigente(s) en {mesLabel} para {form.unidad.toUpperCase()} · {otsPlacaTotal} OT(s) registradas en total</>
                      ) : (
                        <><TbAlertTriangle /> Ninguna OT vigente en {mesLabel} para {form.unidad.toUpperCase()} ({otsPlacaTotal} OT en otros meses)</>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ gap: 4, marginTop: 12, marginBottom: 0 }}>
                  <label className="form-label">Gastos (repuestos / conceptos) *</label>
                  <textarea name="gastos" value={form.gastos} onChange={handleChange} className="form-textarea" rows={2}
                    placeholder={esAlmacen ? 'Detalle de repuestos o insumos despachados de bodega...' : 'Detalle de repuestos, lubricantes o servicios facturados...'} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: 12, marginTop: 12 }}>
                  <div className="form-group" style={{ gap: 4, marginBottom: 0 }}>
                    <label className="form-label">{esAlmacen ? 'Cantidad de repuestos' : 'Cantidad'}</label>
                    <input name="cantidad" value={form.cantidad} onChange={handleChange} className="form-input"
                      placeholder={esAlmacen ? 'Total de repuestos' : 'Cantidad'} />
                    {esAlmacen && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        Ingrese aquí el total de los repuestos.
                      </div>
                    )}
                  </div>

                  {esAlmacen ? (
                    <div className="form-group" style={{ gap: 4, marginBottom: 0 }}>
                      <label className="form-label">Monto ($)</label>
                      <div style={{
                        fontSize: 12, color: 'var(--color-text-muted)', background: 'var(--color-bg-input)',
                        border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-sm)',
                        padding: '11px 12px', minHeight: 40, display: 'flex', alignItems: 'center'
                      }}>
                        No se captura: el costo lo controla el sistema de almacén.
                      </div>
                    </div>
                  ) : (
                    <div className="form-group" style={{ gap: 4, marginBottom: 0 }}>
                      <label className="form-label">Monto ($)</label>
                      <input name="monto" type="number" step="0.01" min="0" value={form.monto} onChange={handleChange} className="form-input" placeholder="0.00" style={{ fontFamily: 'var(--font-mono)' }} />
                    </div>
                  )}
                  {!esAlmacen && (
                    <>
                      <div className="form-group" style={{ gap: 4, marginBottom: 0 }}>
                        <label className="form-label">Descuento ($)</label>
                        <input name="descuento" type="number" step="0.01" min="0" value={form.descuento} onChange={handleChange} className="form-input" placeholder="0.00" style={{ fontFamily: 'var(--font-mono)' }} />
                      </div>
                      <div className="form-group" style={{ gap: 4, marginBottom: 0 }}>
                        <label className="form-label">Monto con Descuento ($)</label>
                        <input type="text" readOnly
                          value={fmtMoney((parseFloat(form.monto) || 0) - (parseFloat(form.descuento) || 0))}
                          className="form-input"
                          style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#22c55e', background: 'rgba(34,197,95,0.06)', cursor: 'default' }} />
                      </div>
                    </>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12, marginTop: 12 }}>
                  <div className="form-group" style={{ gap: 4, marginBottom: 0 }}>
                    <label className="form-label">Centro de Costo</label>
                    <select name="centroCosto" value={form.centroCosto} onChange={handleChange} className="form-select">
                      <option value="">— Seleccione el centro de costo —</option>
                      {opcionesCatalogo(centrosExistentes, form.centroCosto).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  {!esAlmacen && (
                    <div className="form-group" style={{ gap: 4, marginBottom: 0 }}>
                      <label className="form-label">Estado de Pago</label>
                      <select name="estado" value={form.estado} onChange={handleChange} className="form-select">
                        <option value="por_pagar">Pendiente de pago</option>
                        <option value="pagado">Pagado</option>
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                  <button type="button" className="btn btn-secondary" onClick={cerrarModal} disabled={guardando}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={guardando}>
                    {guardando ? 'Guardando...' : (editandoId ? 'Guardar Cambios' : 'Registrar Gasto')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </ModalPortal>
    )}
    </div>
  );
}
