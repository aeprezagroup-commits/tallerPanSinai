import { useState, useEffect, useMemo } from 'react';
import { buscarVehiculoCatalogo } from '../services/vehiculosService';
import { escucharOrdenes } from '../firebase/ordenesService';
import StatusBadge from '../components/StatusBadge';
import {
  TbSearch, TbTruck, TbTools, TbArrowRight, TbCircleCheck, TbCheck,
  TbUser, TbMapPin, TbAlertCircle, TbFileText, TbX
} from '../icons';
import { Link } from 'react-router-dom';
import IconoMascara from '../components/IconoMascara';

const ETAPAS = [
  { id: 'ingresado', label: 'Recepción', desc: 'Ingreso al taller e inspección inicial' },
  { id: 'diagnostico', label: 'Diagnóstico', desc: 'Evaluación técnica y repuestos' },
  { id: 'en_proceso', label: 'Reparación', desc: 'Trabajo activo en fosa / bahía' },
  { id: 'inspeccion', label: 'Control Calidad', desc: 'Prueba de ruta y verificación' },
  { id: 'finalizado', label: 'Listo p/ Entrega', desc: 'Listo para despacho o retirado' },
];

export default function VehicleStatus() {
  const [query, setQuery] = useState('');
  // Vista fila (tabla) o cuadrícula (tarjetas) de las unidades en el taller
  const [vistaUnidades, setVistaUnidades] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 900) ? 'cards' : 'fila');
  const [ordenes, setOrdenes] = useState([]);

  // Escuchar órdenes en tiempo real
  useEffect(() => {
    const unsubscribe = escucharOrdenes((data) => {
      setOrdenes(data);
    });
    return () => unsubscribe();
  }, []);

  const { vehiculo, ordenActual, error } = useMemo(() => {
    const limpia = query.trim().toUpperCase();
    if (!limpia) return { vehiculo: null, ordenActual: null, error: '' };
    const v = buscarVehiculoCatalogo(limpia);
    const ord = ordenes.find(
      (o) => o.placa?.toUpperCase() === limpia && o.estado !== 'entregado'
    ) || ordenes.find((o) => o.placa?.toUpperCase() === limpia);

    if (!v && !ord) {
      return {
        vehiculo: null,
        ordenActual: null,
        error: `No se encontraron registros para la placa ${limpia}. Verifica que la placa esté escrita correctamente.`
      };
    }
    return {
      vehiculo: v || { placa: limpia, marca: 'Vehículo Registrado', modelo: 'En Flota Pan Sinaí' },
      ordenActual: ord || null,
      error: ''
    };
  }, [query, ordenes]);

  const handleSearch = (e) => {
    e.preventDefault();
  };

  const getEtapaIndex = (estado) => {
    switch (estado) {
      case 'ingresado': return 0;
      case 'diagnostico': return 1;
      case 'en_proceso':
      case 'pausado': return 2;
      case 'inspeccion':
      case 'salida': return 3;
      case 'finalizado':
      case 'entregado': return 4;
      default: return 0;
    }
  };

  const etapaActualIndex = ordenActual ? getEtapaIndex(ordenActual.estado) : -1;

  return (
    <div className="vehicle-status-page animate-fade-in" style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* Banner de Bienvenida del Módulo */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-accent-light), rgba(134, 153, 46, 0.03))',
        border: '1px solid var(--color-border-active)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 18px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'var(--color-accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
            boxShadow: '0 2px 8px var(--color-accent-glow)'
          }}>
            <TbSearch />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>Consulta de Estado de Unidades</h1>
              <span style={{ fontSize: 10, background: 'var(--color-accent)', color: '#fff', padding: '1px 7px', borderRadius: 10, fontWeight: 800 }}>
                USO INTERNO
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
              Estado de la unidad en tiempo real.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/inicio" className="btn btn-sm btn-secondary" style={{ fontSize: 11.5 }}>
            Ir al Inicio
          </Link>
        </div>
      </div>

      {/* Buscador de Placa */}
      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={handleSearch}>
          <label className="form-label" style={{ marginBottom: 6 }}>
            Ingresa el número de placa o escanea el QR de la unidad:
          </label>
          {/* La consulta se recalcula con cada placa; Limpiar restablece la
              consulta y, con ella, el vehículo, la OT y el aviso de error. */}
          <div className="consulta-placa-bar">
            <div className="campo-placa">
              <input
                type="text"
                className="form-input"
                placeholder="Número de placa de la unidad..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                  paddingLeft: 38
                }}
                required
              />
              <TbTruck style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 16 }} />
            </div>

            <button type="submit" className="btn btn-primary" style={{ padding: '0 20px' }}>
              <TbSearch /> Consultar Estado
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setQuery('')}
              disabled={!query.trim()}
              style={{ padding: '0 20px' }}
            >
              <TbX /> Limpiar
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444',
          padding: 12,
          borderRadius: 'var(--radius-sm)',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13
        }}>
          <TbAlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Estado vacío: sin búsqueda activa */}
      {!query.trim() && !vehiculo && !error && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 10, padding: '40px 20px', textAlign: 'center',
          color: 'var(--color-text-muted)'
        }}>
          <TbTruck size={48} style={{ opacity: 0.3 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
            Ingresa el número de placa
          </div>
          <div style={{ fontSize: 12.5, maxWidth: 360, lineHeight: 1.6 }}>
            haz clic en <strong>Consultar Estado</strong> para ver su ficha técnica, historial y estado actual.
          </div>
        </div>
      )}

      {/* Resultados de la Unidad */}
      {vehiculo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Ficha principal con Placa y Estado */}
          <div className="card" style={{
            background: 'linear-gradient(135deg, var(--color-bg-card), var(--color-bg-secondary))',
            border: '1px solid var(--color-border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Matrícula estilo placa salvadoreña */}
                <div style={{
                  background: '#0d1321',
                  border: '2px solid var(--color-accent)',
                  borderRadius: 6,
                  padding: '6px 14px',
                  textAlign: 'center',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.4)'
                }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase' }}>EL SALVADOR</div>
                  <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#fff', letterSpacing: 1.5 }}>
                    {vehiculo.placa}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--color-accent)', fontWeight: 700 }}>CENTROAMÉRICA</div>
                </div>

                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    {vehiculo.marca} {vehiculo.modelo}
                  </h2>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {vehiculo.tipo || 'Unidad de Flota Pan Sinaí'} • Año: {vehiculo.anio || '2022'} • Motor: {vehiculo.numMotor || 'N/D'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Conductor asignado: <strong>{vehiculo.conductorHabitual || 'Equipo de Ruta'}</strong>
                  </div>
                </div>
              </div>

              {/* Estado actual con badge prominente */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>ESTADO EN EL TALLER:</div>
                {ordenActual ? (
                  <StatusBadge estado={ordenActual.estado} />
                ) : (
                  <span className="badge badge-finalizado" style={{ fontSize: 12, padding: '6px 12px' }}>
                    <TbCircleCheck style={{ marginRight: 4 }} /> UNIDAD OPERATIVA / EN RUTA
                  </span>
                )}
              </div>
            </div>

            {/* Stepper visual de etapas */}
            {ordenActual && (
              <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
                  CICLO DE SERVICIO EN TALLER:
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, position: 'relative' }}>
                  {ETAPAS.map((etapa, idx) => {
                    const isCompleted = idx < etapaActualIndex;
                    const isCurrent = idx === etapaActualIndex;
                    return (
                      <div
                        key={etapa.id}
                        style={{
                          textAlign: 'center',
                          padding: '10px 6px',
                          background: isCurrent ? 'rgba(134,153,46,0.12)' : isCompleted ? 'rgba(34,197,94,0.08)' : 'var(--color-bg-input)',
                          border: `1px solid ${isCurrent ? 'var(--color-accent)' : isCompleted ? '#22c55e' : 'var(--color-border)'}`,
                          borderRadius: 'var(--radius-sm)',
                          transition: 'all 150ms'
                        }}
                      >
                        <div style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: isCurrent ? 'var(--color-accent)' : isCompleted ? '#22c55e' : 'var(--color-border)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontWeight: 800,
                          margin: '0 auto 6px'
                        }}>
                          {isCompleted ? <TbCheck size={11} /> : idx + 1}
                        </div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: isCurrent ? 'var(--color-accent)' : isCompleted ? '#22c55e' : 'var(--color-text-secondary)' }}>
                          {etapa.label}
                        </div>
                        <div style={{ fontSize: 9.5, color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.2 }}>
                          {etapa.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Información detallada de la orden en curso */}
          {ordenActual ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 16 }}>
              {/* Tarjeta de Trabajo */}
              <div className="card">
                <div className="form-section-title" style={{ marginTop: 0 }}>
                  <IconoMascara className="icon" src="/iconos/taller.png" size={16} /> Detalle del Servicio Activo
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Número de Orden:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{ordenActual.id}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Mecánico Responsable:</span>
                    <strong style={{ color: 'var(--color-accent)' }}>{ordenActual.mecanicoAsignado || 'En asignación de bahía'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Prioridad:</span>
                    <span style={{ fontWeight: 700, color: ordenActual.prioridad === 'alta' ? '#ef4444' : '#eab308' }}>
                      {ordenActual.prioridad?.toUpperCase() || 'NORMAL'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Fecha de Ingreso:</span>
                    <span>{ordenActual.fechaIngreso ? new Date(ordenActual.fechaIngreso).toLocaleString() : 'Hoy'}</span>
                  </div>

                  <div style={{ marginTop: 6, padding: 10, background: 'var(--color-bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                      MOTIVO / FALLA REPORTADA:
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-primary)' }}>
                      {ordenActual.motivoIngreso || ordenActual.fallaReportada || 'Mantenimiento preventivo general de rutina y revisión de frenos.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ubicación y Acceso a la Orden de Trabajo */}
              <div className="card">
                <div className="form-section-title" style={{ marginTop: 0 }}>
                  <IconoMascara className="icon" src="/iconos/ubicacion-taller.png" size={16} /> Ubicación en Taller
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{
                    padding: 12,
                    background: 'var(--color-bg-input)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    lineHeight: 1.5
                  }}>
                    <TbMapPin style={{ marginRight: 5, verticalAlign: -2, color: 'var(--color-accent)' }} /> <strong>Ubicación:</strong> Complejo Logístico Pan Sinaí, Bahía de Mantenimiento No. 3.
                  </div>

                  {/* Cualquier rol con acceso puede abrir la orden desde aquí */}
                  {ordenActual.id && (
                    <Link
                      to={`/ordenes/${ordenActual.id}`}
                      className="btn btn-primary"
                      style={{ width: '100%', marginTop: 4, gap: 8 }}
                    >
                      <TbFileText /> Abrir Orden en Módulo Taller <TbArrowRight />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <TbCircleCheck size={36} style={{ color: '#22c55e', margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Unidad al 100% de Disponibilidad</h3>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', maxWidth: 450, margin: '6px auto 14px' }}>
                Este vehículo no tiene ninguna orden abierta ni reportes pendientes en el taller. Se encuentra apto para circular en su ruta habitual.
              </p>
              <Link to="/nueva-orden" className="btn btn-primary btn-sm">
                <TbTools /> Ingresar al Taller (Nueva Orden)
              </Link>
            </div>
          )}

        </div>
      )}

      {/* Unidades en el taller — vista fila o cuadrícula */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="form-section-title" style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span><IconoMascara className="icon" src="/iconos/taller-reparacion.png" size={16} /> Unidades en el Taller ({ordenes.filter(o => o.estado !== 'entregado').length})</span>
          <div className="btn-group">
            <button
              type="button"
              className={`btn btn-sm ${vistaUnidades === 'fila' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setVistaUnidades('fila')}
            >
              Vista Fila
            </button>
            <button
              type="button"
              className={`btn btn-sm ${vistaUnidades === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setVistaUnidades('cards')}
            >
              Vista Cuadrícula
            </button>
          </div>
        </div>

        {ordenes.filter(o => o.estado !== 'entregado').length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            No hay unidades activas en el taller en este momento.
          </p>
        ) : vistaUnidades === 'fila' ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Vehículo</th>
                  <th>Estado</th>
                  <th>Mecánico</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.filter(o => o.estado !== 'entregado').map(o => (
                  <tr
                    key={o.id}
                    onClick={() => { setQuery(o.placa || ''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    title="Toca para consultar el estado de esta unidad"
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="placa" style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--color-accent)', marginRight: 4 }}>●</span>
                      {o.placa || 'S/P'}
                    </td>
                    <td>{o.marca} {o.modelo}</td>
                    <td><StatusBadge estado={o.estado} /></td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{o.mecanicoAsignado || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="order-cards-grid">
            {ordenes.filter(o => o.estado !== 'entregado').map(o => (
              <div
                key={o.id}
                className={`order-card estado-${o.estado}`}
                onClick={() => { setQuery(o.placa || ''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                title="Toca para consultar el estado de esta unidad"
                style={{ cursor: 'pointer' }}
              >
                <div className="order-card-header">
                  <div>
                    <span className="order-card-placa">{o.placa || 'S/P'}</span>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                      {o.marca} {o.modelo}
                    </div>
                  </div>
                  <StatusBadge estado={o.estado} />
                </div>
                <div className="order-card-body">
                  <div className="order-card-info">
                    <TbUser className="icon" />
                    <span>{o.mecanicoAsignado || 'Sin asignar'}</span>
                  </div>
                  <div className="order-card-info">
                    <TbTools className="icon" />
                    <span>{o.areaPrincipal || 'General'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pie con selector de áreas para cambiar de vista */}
      <div style={{
        marginTop: 24,
        padding: '12px 16px',
        background: 'var(--color-bg-card)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10
      }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Accesos rápidos a otros módulos de trabajo:
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/taller" className="btn btn-sm btn-secondary" style={{ color: 'var(--color-accent)' }}>
            <TbTools /> Taller
          </Link>
          <Link to="/ordenes" className="btn btn-sm btn-secondary" style={{ color: '#eab308' }}>
            <TbFileText /> Órdenes de Trabajo
          </Link>
        </div>
      </div>

    </div>
  );
}

