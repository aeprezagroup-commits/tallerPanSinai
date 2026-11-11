import { useState, useEffect, useMemo, Fragment } from 'react';
import { Link } from 'react-router-dom';
import {
  TbSearch, TbFilter, TbEye, TbTruck,
  TbTools, TbClock, TbCirclePlus, TbArrowUpRight, TbStack2, TbMapPin, TbCalendar, TbChevronDown, TbChevronRight,
  TbPrinter
} from '../icons';
import { escucharOrdenes, formatoOT } from '../firebase/ordenesService';
import { obtenerMecanicosActivos } from '../services/usuariosService';
import { useAuth } from '../context/AuthContext';
import { filtrarOrdenesPorUsuario, visiblesParaTaller, esColaRecepcion, apoyosDeOrden } from '../services/permisosService';
import StatusBadge from '../components/StatusBadge';
import OrdenOperativa from '../components/OrdenOperativa';
import InspectionCertificateModal from '../components/InspectionCertificateModal';
import { AREAS_TRABAJO_CON_TODAS as AREAS } from '../constants/areas';

// Convierte marcas de tiempo de Firestore / ISO / Date a objeto Date
const aFecha = (ts) => {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
};

export default function Ordenes() {
  const { isAdmin, isMecanico, currentUser } = useAuth();

  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  // El mecánico trabaja con sus órdenes activas; los demás ven el registro completo
  const [filtroEstado, setFiltroEstado] = useState(isMecanico ? 'activos' : 'todos');
  const [filtroArea, setFiltroArea] = useState('Todas');
  const [filtroMecanico, setFiltroMecanico] = useState('Todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [mecanicos] = useState(() => obtenerMecanicosActivos());
  const [ordenCertificado, setOrdenCertificado] = useState(null);
  // En celular se arranca con la vista de tarjetas (no cabe una tabla)
  const [vista, setVista] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 900) ? 'cards' : 'tabla');
  // Orden tocada: despliega su panel operativo (actividades y estados) en línea
  const [ordenAbierta, setOrdenAbierta] = useState(null);

  useEffect(() => {
    const unsubscribe = escucharOrdenes((data) => {
      setOrdenes(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const ordenesFiltradas = useMemo(() => {
    // Visibilidad por rol: el mecánico ve sus órdenes + cola de recepción (su trabajo activo)
    const visibles = isMecanico ? visiblesParaTaller(ordenes, currentUser) : filtrarOrdenesPorUsuario(ordenes, currentUser);
    return visibles.filter(o => {
      const busquedaNorm = busqueda.trim().toLowerCase();
      const busquedaDigitos = busqueda.replace(/\D/g, '');
      const matchBusqueda =
        !busqueda ||
        o.placa?.toLowerCase().includes(busquedaNorm) ||
        o.marca?.toLowerCase().includes(busquedaNorm) ||
        o.modelo?.toLowerCase().includes(busquedaNorm) ||
        o.departamento?.toLowerCase().includes(busquedaNorm) ||
        o.ruta?.toLowerCase().includes(busquedaNorm) ||
        o.mecanicoAsignado?.toLowerCase().includes(busquedaNorm) ||
        o.conductorEntrega?.toLowerCase().includes(busquedaNorm) ||
        // Búsqueda por contador de orden (OT-0001, 1, 15...)
        formatoOT(o).toLowerCase().includes(busquedaNorm) ||
        (busquedaDigitos && String(o.numeroOrden || '') === busquedaDigitos);

      const matchEstado =
        filtroEstado === 'todos' ? true
          : filtroEstado === 'activos' ? (o.estado !== 'entregado' && o.estado !== 'cancelado')
            : o.estado === filtroEstado;
      const matchArea = filtroArea === 'Todas' || o.areaPrincipal === filtroArea;
      const matchMecanico = filtroMecanico === 'Todos'
        || o.mecanicoAsignado === filtroMecanico
        || o.mecanicoReceptor === filtroMecanico
        || apoyosDeOrden(o).includes(filtroMecanico)
        || (o.actividades || []).some(a => a.mecanicoAsignado === filtroMecanico);

      // Filtro por rango de fechas de ingreso al taller
      const fechaIng = aFecha(o.fechaIngreso);
      const desde = fechaDesde ? new Date(`${fechaDesde}T00:00:00`) : null;
      const hasta = fechaHasta ? new Date(`${fechaHasta}T23:59:59`) : null;
      const matchDesde = !desde || (fechaIng && fechaIng >= desde);
      const matchHasta = !hasta || (fechaIng && fechaIng <= hasta);

      return matchBusqueda && matchEstado && matchArea && matchMecanico && matchDesde && matchHasta;
    });
  }, [ordenes, currentUser, isMecanico, busqueda, filtroEstado, filtroArea, filtroMecanico, fechaDesde, fechaHasta]);

  const toggleOrden = (id) => {
    setOrdenAbierta(prev => (prev === id ? null : id));
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroEstado(isMecanico ? 'activos' : 'todos');
    setFiltroArea('Todas');
    setFiltroMecanico('Todos');
    setFechaDesde('');
    setFechaHasta('');
  };

  const formatFecha = (timestamp) => {
    if (!timestamp?.toDate) return '—';
    return new Date(timestamp.toDate()).toLocaleDateString('es-SV', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  const totalColumnas = 8 + (isAdmin ? 1 : 0);

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>{isMecanico ? 'Mis Órdenes de Trabajo' : 'Registro de Órdenes de Trabajo'}</h1>
          <p>
            {isMecanico
              ? `Toca una unidad para gestionar sus actividades (${ordenesFiltradas.length} órdenes)`
              : `Órdenes de servicio mecánico (${ordenesFiltradas.length} órdenes)`}
          </p>
        </div>
        <Link to="/nueva-orden" className="btn btn-primary">
          <TbCirclePlus /> Nueva Orden
        </Link>
      </div>

      {/* Filtros */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <TbSearch className="search-icon" />
          <input
            type="text"
            className="form-input"
            placeholder="Buscar por placa, modelo, técnico o motorista..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <select
          className="form-select filter-select"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="todos">Todos los Estados</option>
          <option value="activos">Órdenes Activas (sin entregadas)</option>
          <option value="ingresado">En Diagnóstico / Espera</option>
          <option value="en_proceso">En Reparación Activa</option>
          <option value="finalizado">Listo para Entrega</option>
          <option value="pausado">En Espera de Repuestos</option>
          <option value="entregado">Despachado / Entregado</option>
        </select>

        <select
          className="form-select filter-select"
          value={filtroArea}
          onChange={(e) => setFiltroArea(e.target.value)}
        >
          {AREAS.map(a => (
            <option key={a} value={a}>{a === 'Todas' ? 'Todas las Áreas' : a}</option>
          ))}
        </select>

        <select
          className="form-select filter-select"
          value={filtroMecanico}
          onChange={(e) => setFiltroMecanico(e.target.value)}
          title="Filtrar por mecánico asignado o receptor"
        >
          <option value="Todos">Todos los Mecánicos</option>
          {mecanicos.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* Rango de fechas de ingreso */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TbCalendar style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <input
            type="date"
            className="form-input"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            title="Fecha de ingreso desde"
            style={{ fontSize: 12 }}
          />
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>a</span>
          <input
            type="date"
            className="form-input"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            title="Fecha de ingreso hasta"
            style={{ fontSize: 12 }}
          />
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={limpiarFiltros}
          title="Restablecer todos los filtros"
        >
          <TbFilter /> Limpiar
        </button>

        {/* Toggle vista */}
        <div className="btn-group">
          <button
            className={`btn btn-sm ${vista === 'tabla' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setVista('tabla')}
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

      {ordenesFiltradas.length === 0 ? (
        <div className="empty-state">
          <TbStack2 className="empty-state-icon" />
          <h3>No se encontraron registros</h3>
          <p>Ajusta los filtros de búsqueda o registra una nueva orden de servicio.</p>
        </div>
      ) : vista === 'tabla' ? (
        /* VISTA: Tabla Corporativa — toca la fila para desplegar actividades y controles */
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Código OT</th>
                <th>Placa</th>
                <th>Unidad / Vehículo</th>
                <th>Departamento / Ruta</th>
                <th>Área Técnica</th>
                <th>Técnico Asignado</th>
                <th>Estado Operativo</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>Inversión (Admin)</th>}
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.map(orden => (
                <Fragment key={orden.id}>
                  <tr
                    onClick={() => toggleOrden(orden.id)}
                    title="Toca para ver actividades y controles de estado"
                    style={{
                      cursor: 'pointer',
                      background: ordenAbierta === orden.id ? 'rgba(134,153,46,0.07)' : undefined
                    }}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {ordenAbierta === orden.id ? <TbChevronDown style={{ verticalAlign: -2, color: 'var(--color-accent)', marginRight: 4 }} /> : <TbChevronRight style={{ verticalAlign: -2, marginRight: 4 }} />}
                      {formatoOT(orden)}
                    </td>
                    <td className="placa">
                      <span style={{ color: 'var(--color-accent)', marginRight: 4 }}>●</span>
                      {orden.placa || 'S/P'}
                    </td>
                    <td>
                      <strong>{orden.marca}</strong> {orden.modelo} {orden.anio ? `(${orden.anio})` : ''}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="badge badge-en-proceso" style={{ fontSize: 10, alignSelf: 'flex-start', padding: '1px 6px' }}>
                          <TbMapPin style={{ marginRight: 2 }} /> {orden.departamento || 'San Salvador'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {orden.ruta ? orden.ruta.substring(0, 24) + '...' : 'General'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="tech-tag">{orden.areaPrincipal}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {orden.mecanicoAsignado || <span style={{ color: 'var(--color-text-muted)' }}>Sin asignar</span>}
                      {apoyosDeOrden(orden).filter(Boolean).length ? <span style={{ color: 'var(--color-text-muted)' }}> + {apoyosDeOrden(orden).filter(Boolean).join(', ')}</span> : null}
                    </td>
                    <td>
                      <StatusBadge estado={orden.estado} />
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#22c55e' }}>
                        ${(Number(orden.costoTotal) || (Number(orden.costoRepuestos) || 0) + (Number(orden.costoManoObra) || 0)).toFixed(2)}
                      </td>
                    )}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={`btn btn-sm ${ordenAbierta === orden.id ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => toggleOrden(orden.id)}
                          title="Desplegar actividades y controles de la orden"
                        >
                          {ordenAbierta === orden.id ? 'Cerrar' : 'Actividades'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setOrdenCertificado(orden)}
                          title="Ver e imprimir Acta de Taller"
                        >
                          <TbPrinter /> Acta
                        </button>
                        <Link to={`/ordenes/${orden.id}`} className="btn btn-secondary btn-sm">
                          <TbEye /> Detalle
                        </Link>
                      </div>
                    </td>
                  </tr>
                  {ordenAbierta === orden.id && (
                    <tr>
                      <td colSpan={totalColumnas} style={{ padding: 0, background: 'var(--color-bg-secondary)', borderBottom: '2px solid rgba(134,153,46,0.35)' }}>
                        <div style={{ padding: '14px 16px' }} onClick={(e) => e.stopPropagation()}>
                          <OrdenOperativa
                            orden={orden}
                            todasLasOrdenes={ordenes}
                            mecanicos={mecanicos}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* VISTA: Tarjetas — toca la tarjeta para desplegar actividades y controles */
        <div className="order-cards-grid">
          {ordenesFiltradas.map(orden => (
            <div
              key={orden.id}
              className={`order-card estado-${orden.estado}`}
              onClick={() => toggleOrden(orden.id)}
              title="Toca para ver actividades y controles de estado"
            >
              <div className="order-card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="order-card-placa">{orden.placa || 'S/P'}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {formatoOT(orden)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {ordenAbierta === orden.id ? <TbChevronDown style={{ color: 'var(--color-accent)' }} /> : <TbChevronRight />}
                    {ordenAbierta === orden.id ? 'Tocar para cerrar' : 'Toca para ver actividades'}
                  </div>
                  {/* El mecánico sabe por qué le aparece esta unidad (asignada o cola de recepción) */}
                  {isMecanico && (
                    <span style={{
                      display: 'inline-block',
                      marginTop: 6,
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: esColaRecepcion(orden) ? 'rgba(249,115,22,0.14)' : 'rgba(134,153,46,0.14)',
                      color: esColaRecepcion(orden) ? 'var(--color-accent)' : 'var(--color-accent)',
                      border: `1px solid ${esColaRecepcion(orden) ? 'rgba(249,115,22,0.35)' : 'rgba(134,153,46,0.35)'}`
                    }}>
                      {esColaRecepcion(orden) ? 'Cola de recepción' : (orden.mecanicoAsignado === currentUser.nombre ? 'Asignada a mí' : 'Apoyo asignado')}
                    </span>
                  )}
                </div>
                <StatusBadge estado={orden.estado} />
              </div>
              <div className="order-card-body">
                <div className="order-card-info">
                  <TbTruck className="icon" />
                  <span>{orden.marca} {orden.modelo} {orden.anio && `(${orden.anio})`}</span>
                </div>
                <div className="order-card-info">
                  <TbTools className="icon" />
                  <span>{orden.areaPrincipal} • {orden.tipoTrabajo}</span>
                </div>
                <div className="order-card-info">
                  <TbClock className="icon" />
                  <span>Técnico: {orden.mecanicoAsignado || 'Sin asignar'}{apoyosDeOrden(orden).filter(Boolean).length ? ` + ${apoyosDeOrden(orden).filter(Boolean).join(', ')}` : ''}</span>
                </div>
              </div>

              {/* Panel operativo desplegado: actividades con estados, cronómetro y cierre */}
              {ordenAbierta === orden.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ borderTop: '1px dashed var(--color-border)', marginTop: 10, paddingTop: 10 }}
                >
                  <OrdenOperativa
                    orden={orden}
                    todasLasOrdenes={ordenes}
                    mecanicos={mecanicos}
                  />
                </div>
              )}

              <div className="order-card-footer">
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {formatFecha(orden.fechaIngreso)}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOrdenCertificado(orden);
                    }}
                    title="Ver e imprimir Acta de Taller"
                  >
                    <TbPrinter /> Acta
                  </button>
                  <Link to={`/ordenes/${orden.id}`} className="btn btn-secondary btn-sm" onClick={(e) => e.stopPropagation()}>
                    Abrir Ficha <TbArrowUpRight />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Modal Acta de Taller e Inspección de Entrega */}
      <InspectionCertificateModal
        isOpen={Boolean(ordenCertificado)}
        orden={ordenCertificado}
        onClose={() => setOrdenCertificado(null)}
      />
    </div>
  );
}
