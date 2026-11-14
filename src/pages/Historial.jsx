import BotonVolver from '../components/BotonVolver';
import { useState, useEffect, useMemo } from 'react';
import { normalizarPlaca } from '../utils/placas';
import { Link } from 'react-router-dom';
import {
  TbSearch, TbTools,
  TbUser, TbClock,
  TbDownload, TbMapPin, TbStack2, TbReportMoney
} from '../icons';
import { escucharOrdenes, formatoOT } from '../firebase/ordenesService';
import { obtenerMecanicosActivos } from '../services/usuariosService';
import StatusBadge from '../components/StatusBadge';
import { AREAS_TRABAJO_CON_TODAS as AREAS } from '../constants/areas';
import { formatearDinero, formatearMiles } from '../utils/formato';

const ESTADOS_FILTRO = [
  { val: 'Todos', label: 'Todos los Estados' },
  { val: 'ingresado', label: 'Ingresado / En Espera' },
  { val: 'en_proceso', label: 'En Proceso' },
  { val: 'esperando_repuestos', label: 'Esperando Repuestos' },
  { val: 'pausado', label: 'Pausado' },
  { val: 'finalizado', label: 'Reparación Finalizada' },
  { val: 'listo_entrega', label: 'Listo para Entrega' },
  { val: 'entregado', label: 'Vehículos Entregados' }
];

export default function Historial() {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mecanicos, setMecanicos] = useState(() => obtenerMecanicosActivos());

  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroArea, setFiltroArea] = useState('Todas');
  const [filtroMecanico, setFiltroMecanico] = useState('Todos');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [vista, setVista] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 900) ? 'cards' : 'fila');

  useEffect(() => {
    const unsubscribe = escucharOrdenes((data) => {
      setOrdenes(data);
      setLoading(false);
    });

    const handleUsers = () => setMecanicos(obtenerMecanicosActivos());
    window.addEventListener('pan_sinai_users_updated', handleUsers);

    return () => {
      unsubscribe();
      window.removeEventListener('pan_sinai_users_updated', handleUsers);
    };
  }, []);

  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter((o) => {
      const q = filtroTexto.trim().toUpperCase();
      if (q) {
        const qDigitos = filtroTexto.replace(/\D/g, '');
        const matchPlaca = normalizarPlaca(o.placa).includes(normalizarPlaca(q));
        const matchMarca = o.marca?.toUpperCase().includes(q);
        const matchModelo = o.modelo?.toUpperCase().includes(q);
        const matchId = o.id?.toUpperCase().includes(q);
        const matchConductor = o.conductorEntrega?.toUpperCase().includes(q);
        const matchOT = formatoOT(o).toUpperCase().includes(q) ||
          (qDigitos && String(o.numeroOrden || '') === qDigitos);
        if (!matchPlaca && !matchMarca && !matchModelo && !matchId && !matchConductor && !matchOT) {
          return false;
        }
      }

      if (filtroArea !== 'Todas' && o.areaPrincipal !== filtroArea) {
        return false;
      }
      if (filtroMecanico !== 'Todos' && o.mecanicoAsignado !== filtroMecanico) {
        return false;
      }
      if (filtroEstado !== 'Todos' && o.estado !== filtroEstado) {
        return false;
      }

      if (fechaDesde && o.fechaIngreso?.toDate) {
        const fechaIng = new Date(o.fechaIngreso.toDate());
        const desde = new Date(fechaDesde);
        if (fechaIng < desde) return false;
      }
      if (fechaHasta && o.fechaIngreso?.toDate) {
        const fechaIng = new Date(o.fechaIngreso.toDate());
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        if (fechaIng > hasta) return false;
      }

      return true;
    });
  }, [ordenes, filtroTexto, filtroArea, filtroMecanico, filtroEstado, fechaDesde, fechaHasta]);

  const formatFecha = (timestamp) => {
    if (!timestamp?.toDate) return '—';
    return new Date(timestamp.toDate()).toLocaleDateString('es-SV', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const exportarCSV = () => {
    if (ordenesFiltradas.length === 0) return;

    const encabezados = [
      'Orden (OT)',
      'Placa',
      'Marca',
      'Modelo',
      'Año',
      'Kilometraje',
      'Departamento',
      'Ruta',
      'Mecánico Responsable',
      'Área Principal',
      'Tipo Trabajo',
      'Diagnóstico Inicial',
      'Costo Repuestos ($)',
      'Costo Mano Obra ($)',
      'Costo Total ($)',
      'Tiempo Real (Min)',
      'Estado',
      'Fecha Ingreso',
      'Fecha Salida',
      'Persona Retira'
    ];

    const filas = ordenesFiltradas.map(o => [
      formatoOT(o),
      `"${o.placa || ''}"`,
      `"${o.marca || ''}"`,
      `"${o.modelo || ''}"`,
      o.anio || '',
      o.kilometraje || '',
      `"${o.departamento || ''}"`,
      `"${o.ruta || ''}"`,
      `"${o.mecanicoAsignado || ''}"`,
      `"${o.areaPrincipal || ''}"`,
      `"${o.tipoTrabajo || ''}"`,
      `"${(o.diagnosticoInicial || '').replace(/"/g, '""')}"`,
      (Number(o.costoRepuestos) || 0).toFixed(2),
      (Number(o.costoManoObra) || 0).toFixed(2),
      (Number(o.costoTotal) || 0).toFixed(2),
      o.tiempoRealMinutos || 0,
      o.estado || '',
      o.fechaIngreso?.toDate ? new Date(o.fechaIngreso.toDate()).toLocaleDateString('es-SV') : '',
      o.fechaSalida?.toDate ? new Date(o.fechaSalida.toDate()).toLocaleDateString('es-SV') : '',
      `"${o.personaRetira || ''}"`
    ]);

    const csvContent = '\uFEFF' + [encabezados.join(','), ...filas.map(f => f.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Reporte_Taller_Pan_Sinai_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
          <h1>Historial y Auditoría</h1>
          <p>Expediente histórico y trazabilidad de servicios por unidad.</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={exportarCSV}
          style={{ gap: 8 }}
          title="Descargar reporte con las órdenes filtradas"
        >
          <TbDownload /> Exportar CSV
        </button>
      </div>


      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title" style={{ marginBottom: 16 }}>Filtros de Búsqueda Combinables</h3>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Buscar por Placa, Marca o N° Orden</label>
            <div className="search-input-wrapper">
              <TbSearch className="search-icon" />
              <input
                type="text"
                className="form-input"
                placeholder="Buscar por placa, modelo o N° de OT..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Estado de la Orden</label>
            <select
              className="form-select"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              {ESTADOS_FILTRO.map((est) => (
                <option key={est.val} value={est.val}>{est.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Área Principal</label>
            <select
              className="form-select"
              value={filtroArea}
              onChange={(e) => setFiltroArea(e.target.value)}
            >
              {AREAS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Mecánico Asignado</label>
            <select
              className="form-select"
              value={filtroMecanico}
              onChange={(e) => setFiltroMecanico(e.target.value)}
            >
              <option value="Todos">Todos los Mecánicos</option>
              {mecanicos.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Fecha Desde</label>
            <input
              type="date"
              className="form-input"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Fecha Hasta</label>
            <input
              type="date"
              className="form-input"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>

          <div className="form-group full-width" style={{ justifyContent: 'flex-end', display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setFiltroTexto('');
                setFiltroArea('Todas');
                setFiltroMecanico('Todos');
                setFiltroEstado('Todos');
                setFechaDesde('');
                setFechaHasta('');
              }}
            >
              Limpiar Todos los Filtros
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            Órdenes Registradas ({ordenesFiltradas.length})
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Mostrando resultados con trazabilidad completa
            </span>
            <div className="btn-group">
              <button
                className={`btn btn-sm ${vista === 'fila' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setVista('fila')}
              >
                Vista Fila
              </button>
              <button
                className={`btn btn-sm ${vista === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setVista('cards')}
              >
                Vista Cuadrícula
              </button>
            </div>
          </div>
        </div>

        {vista === 'fila' ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>N° Orden</th>
                  <th>Placa</th>
                  <th>Vehículo</th>
                  <th>Kilometraje</th>
                  <th>Tipo / Área</th>
                  <th>Fecha Ingreso</th>
                  <th>Mecánico</th>
                  <th>Costo Total</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {ordenesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: 36, color: 'var(--color-text-muted)' }}>
                      No se encontraron órdenes con los criterios especificados.
                    </td>
                  </tr>
                ) : (
                  ordenesFiltradas.map((ord) => (
                    <tr key={ord.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
                        {formatoOT(ord)}
                      </td>
                      <td className="placa">
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontWeight: 'bold' }}
                          onClick={() => setFiltroTexto(ord.placa)}
                          title="Filtrar el listado por esta placa"
                        >
                          {ord.placa || 'S/P'}
                        </button>
                      </td>
                      <td>{ord.marca} {ord.modelo}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-accent)' }}>
                        {ord.kilometraje ? `${formatearMiles(ord.kilometraje)} km` : '—'}
                      </td>
                      <td>{ord.tipoTrabajo} &bull; {ord.areaPrincipal}</td>
                      <td>{formatFecha(ord.fechaIngreso)}</td>
                      <td>{ord.mecanicoAsignado || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#22c55e' }}>
                        {formatearDinero(Number(ord.costoTotal) || 0)}
                      </td>
                      <td>
                        <StatusBadge estado={ord.estado} />
                      </td>
                      <td>
                        <Link to={`/ordenes/${ord.id}`} className="btn btn-sm btn-secondary">
                          Expediente
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : ordenesFiltradas.length === 0 ? (
          <div className="empty-state">
            <TbStack2 className="empty-state-icon" />
            <h3>No se encontraron órdenes</h3>
            <p>Ajusta los filtros de búsqueda o registra una nueva orden de servicio.</p>
          </div>
        ) : (
          <div className="order-cards-grid">
            {ordenesFiltradas.map((ord) => (
              <div key={ord.id} className={`order-card estado-${ord.estado}`} style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="order-card-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="order-card-placa">{ord.placa || 'S/P'}</span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{formatoOT(ord)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                      {ord.marca} {ord.modelo} {ord.anio ? `(${ord.anio})` : ''}
                    </div>
                  </div>
                  <StatusBadge estado={ord.estado} />
                </div>
                <div className="order-card-body">
                  <div className="order-card-info">
                    <TbTools className="icon" />
                    <span>{ord.tipoTrabajo} • {ord.areaPrincipal}</span>
                  </div>
                  <div className="order-card-info">
                    <TbUser className="icon" />
                    <span>{ord.mecanicoAsignado || '—'}</span>
                  </div>
                  <div className="order-card-info">
                    <TbClock className="icon" />
                    <span>Ingreso: {formatFecha(ord.fechaIngreso)}</span>
                  </div>
                  <div className="order-card-info">
                    <TbMapPin className="icon" />
                    <span>{ord.kilometraje ? `${formatearMiles(ord.kilometraje)} km` : 'Sin kilometraje'}</span>
                  </div>
                  <div className="order-card-info">
                    <TbReportMoney className="icon" />
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#22c55e' }}>
                      {formatearDinero(Number(ord.costoTotal) || (Number(ord.costoRepuestos) || 0) + (Number(ord.costoManoObra) || 0))}
                    </span>
                  </div>
                </div>
                <div className="order-card-footer">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setFiltroTexto(ord.placa)}
                  >
                    Filtrar por placa
                  </button>
                  <Link to={`/ordenes/${ord.id}`} className="btn btn-primary btn-sm">
                    Expediente
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
