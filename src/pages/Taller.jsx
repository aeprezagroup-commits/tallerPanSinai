import { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { TbTools, TbMapPin, TbChevronRight, TbChevronDown, TbEye } from '../icons';
import { escucharOrdenes, formatoOT } from '../firebase/ordenesService';
import { useAuth } from '../context/AuthContext';
import { obtenerMecanicosActivos } from '../services/usuariosService';
import { visiblesParaTaller, esColaRecepcion, apoyosDeOrden } from '../services/permisosService';
import StatusBadge from '../components/StatusBadge';
import OrdenOperativa from '../components/OrdenOperativa';
import BotonVolver from '../components/BotonVolver';

export default function Taller() {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mecanicos, setMecanicos] = useState(obtenerMecanicosActivos());
  const [mecanicoFiltro, setMecanicoFiltro] = useState('Todos');
  const [estadoFiltro, setEstadoFiltro] = useState('activos');
  // Vista "fila" (tabla) por defecto: más fácil de visualizar en dispositivos
  const [vista, setVista] = useState('fila');
  const [ordenAbierta, setOrdenAbierta] = useState(null);

  const { isMecanico, isAdmin, currentUser } = useAuth();

  const toggleOrden = (id) => setOrdenAbierta((prev) => (prev === id ? null : id));

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

  // Visibilidad por rol: el mecánico ve su cola de recepción + sus órdenes asignadas
  const ordenesVisibles = visiblesParaTaller(ordenes, currentUser);

  const ordenesFiltradas = ordenesVisibles.filter((o) => {
    if (estadoFiltro === 'activos' && o.estado === 'entregado') return false;
    if (estadoFiltro !== 'todos' && estadoFiltro !== 'activos' && o.estado !== estadoFiltro) return false;
    if (mecanicoFiltro !== 'Todos') {
      const esAsignado = o.mecanicoAsignado === mecanicoFiltro || apoyosDeOrden(o).includes(mecanicoFiltro);
      const tieneActividad = (o.actividades || []).some(a => a.mecanicoAsignado === mecanicoFiltro);
      if (!esAsignado && !tieneActividad) return false;
    }
    return true;
  });

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
          <BotonVolver a="/ordenes" etiqueta="Volver a Órdenes" />
          <h1>Área de Reparación</h1>
          <p>Supervisión en vivo y tiempos por mecánico.</p>
        </div>
        <div className="btn-group">
          {/* Toggle vista: fila (tabla) o cuadrícula de tarjetas */}
          <div className="btn-group" style={{ marginRight: 12 }}>
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
          <Link to="/nueva-orden" className="btn btn-primary">
            + Ingreso de Unidad
          </Link>
        </div>
      </div>

      {/* Barra de Filtros Operativos */}
      <div className="filters-bar" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--color-bg-card)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
        {!isMecanico && (
          <div className="form-group" style={{ flex: '1 1 240px', minWidth: 200, marginBottom: 0 }}>
            <label className="form-label">Mecánico Responsable</label>
            <select
              className="form-select"
              value={mecanicoFiltro}
              onChange={(e) => setMecanicoFiltro(e.target.value)}
            >
              <option value="Todos">Todos los Mecánicos Activos</option>
              {mecanicos.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group" style={{ flex: '1 1 240px', minWidth: 200, marginBottom: 0 }}>
          <label className="form-label">Estado Operativo</label>
          <select
            className="form-select"
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
          >
            <option value="activos">Vehículos Activos en Taller</option>
            <option value="ingresado">Recién Ingresados / Diagnóstico</option>
            <option value="en_proceso">Trabajo en Proceso Activo</option>
            <option value="esperando_repuestos">Esperando Repuestos</option>
            <option value="pausado">Trabajo Pausado</option>
            <option value="finalizado">Reparación Finalizada</option>
            <option value="listo_entrega">Listo para Entrega</option>
            <option value="todos">Ver Todo el Registro Histórico</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-info" style={{ padding: '8px 12px', fontSize: 13, height: 42, display: 'inline-flex', alignItems: 'center' }}>
            {ordenesFiltradas.length} {ordenesFiltradas.length === 1 ? 'unidad mostrada' : 'unidades mostradas'}
          </span>
        </div>
      </div>

      {ordenesFiltradas.length === 0 ? (
        <div className="empty-state">
          <TbTools className="empty-state-icon" />
          <h3>No hay vehículos con los filtros seleccionados</h3>
          <p>No se registran unidades asignadas en el área de reparación con este criterio.</p>
        </div>
      ) : vista === 'fila' ? (
        /* VISTA Fila (tabla) — toca la fila para desplegar el detalle operativo completo */
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Puesto / OT</th>
                <th>Placa</th>
                <th>Unidad / Vehículo</th>
                <th>Departamento / Ruta</th>
                <th>Área Técnica</th>
                <th>Responsable / Apoyos</th>
                <th>Estado Operativo</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>Inversión (Admin)</th>}
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.map((orden, index) => {
                const apoyos = apoyosDeOrden(orden).filter(Boolean);
                return (
                  <Fragment key={orden.id}>
                    <tr
                      onClick={() => toggleOrden(orden.id)}
                      title="Toca para ver asignación, actividades y cronómetro"
                      style={{
                        cursor: 'pointer',
                        background: ordenAbierta === orden.id ? 'rgba(134,153,46,0.07)' : undefined
                      }}
                    >
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {ordenAbierta === orden.id
                          ? <TbChevronDown style={{ verticalAlign: -2, color: 'var(--color-accent)', marginRight: 4 }} />
                          : <TbChevronRight style={{ verticalAlign: -2, marginRight: 4 }} />}
                        <span style={{ fontWeight: 800, color: 'var(--color-text-secondary)' }}>P{index + 1}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}> · {formatoOT(orden)}</span>
                      </td>
                      <td className="placa">
                        <span style={{ color: 'var(--color-accent)', marginRight: 4 }}>●</span>
                        {orden.placa || 'S/P'}
                      </td>
                      <td>
                        <strong>{orden.marca}</strong> {orden.modelo} {orden.anio ? `(${orden.anio})` : ''}
                        {orden.kilometraje ? (
                          <div style={{ fontSize: 11, color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
                            {orden.kilometraje.toLocaleString()} km
                          </div>
                        ) : null}
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
                        {esColaRecepcion(orden) ? (
                          <span style={{ color: 'var(--color-accent)', fontWeight: 700, fontSize: 12 }}>Pendiente de asignación</span>
                        ) : (
                          <>
                            {orden.mecanicoAsignado || <span style={{ color: 'var(--color-text-muted)' }}>Sin asignar</span>}
                            {apoyos.length ? <span style={{ color: 'var(--color-text-muted)' }}> + {apoyos.join(', ')}</span> : null}
                          </>
                        )}
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
                            title="Desplegar asignación, actividades y controles"
                          >
                            {ordenAbierta === orden.id ? 'Cerrar' : 'Detalle'}
                          </button>
                          <Link to={`/ordenes/${orden.id}`} className="btn btn-secondary btn-sm">
                            <TbEye /> Ficha
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {ordenAbierta === orden.id && (
                      <tr>
                        <td colSpan={8 + (isAdmin ? 1 : 0)} style={{ padding: 0, background: 'var(--color-bg-secondary)', borderBottom: '2px solid rgba(134,153,46,0.35)' }}>
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
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* VISTA: Cuadrícula de tarjetas — el detalle operativo se ve completo en cada tarjeta */
        <div className="order-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(360px, 100%), 1fr))', gap: 20 }}>
          {ordenesFiltradas.map((orden, index) => (
            <div key={orden.id} className={`order-card estado-${orden.estado}`} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="order-card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="order-card-placa">{orden.placa}</span>
                    <span className="tech-tag" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-secondary)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                      PUESTO {index + 1} &bull; ÁREA DE REPARACIÓN
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                    {orden.marca} {orden.modelo} {orden.anio ? `(${orden.anio})` : ''}
                    {orden.kilometraje ? <span style={{ marginLeft: 6, color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>&bull; {orden.kilometraje.toLocaleString()} km</span> : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <span className="badge badge-en-proceso" style={{ fontSize: 10, padding: '2px 6px' }}>
                      <TbMapPin style={{ marginRight: 2 }} /> {orden.departamento || 'San Salvador'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {orden.ruta ? orden.ruta.substring(0, 26) + '...' : 'Ruta general'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <StatusBadge estado={orden.estado} />
                  {/* El mecánico sabe por qué ve esta unidad en su lista */}
                  {isMecanico && (
                    <span style={{
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
              </div>

              {/* Panel operativo completo: asignación, actividades, cronómetro y cierre */}
              <div className="order-card-body" style={{ flex: 1 }}>
                <OrdenOperativa
                  orden={orden}
                  todasLasOrdenes={ordenes}
                  mecanicos={mecanicos}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
