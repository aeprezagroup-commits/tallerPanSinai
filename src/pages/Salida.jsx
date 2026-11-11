import BotonVolver from '../components/BotonVolver';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TbCircleCheck,
  TbPrinter,
  TbCheck,
  TbCircle,
  TbCamera,
  TbUpload,
  TbAlertCircle,
} from '../icons';
import { escucharOrdenes, cerrarOrden, marcarListoParaEntrega } from '../firebase/ordenesService';
import { obtenerFotosBase, guardarFotosBase } from '../services/fotosVehiculoService';
import { useToast } from '../components/ToastContext';
import { useAuth } from '../context/AuthContext';
import { filtrarOrdenesPorUsuario, apoyosDeOrden } from '../services/permisosService';
import StatusBadge from '../components/StatusBadge';
import InspectionCertificateModal from '../components/InspectionCertificateModal';
import IconoMascara from '../components/IconoMascara';

const LADOS_FICHA = [
  { key: 'frontal', num: 1, label: 'Frontal', vacio: 'Sin foto frontal' },
  { key: 'lateralIzquierdo', num: 2, label: 'Lateral Izq.', vacio: 'Sin foto lateral izq.' },
  { key: 'lateralDerecho', num: 3, label: 'Lateral Der.', vacio: 'Sin foto lateral der.' },
  { key: 'trasera', num: 4, label: 'Trasera', vacio: 'Sin foto trasera' }
];

export default function Salida() {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ordenSeleccionadaId, setOrdenSeleccionadaId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [isCertOpen, setIsCertOpen] = useState(false);
  const [fechaSalidaTexto] = useState(() => new Date().toLocaleString('es-SV'));
  const [vista, setVista] = useState('fila');

  const [personaRetira, setPersonaRetira] = useState('');
  const [observacionesFinales, setObservacionesFinales] = useState('');
  const [recomendaciones, setRecomendaciones] = useState('');

  const [fotosBase, setFotosBase] = useState({});
  const [cargandoFotos, setCargandoFotos] = useState(false);
  const [actualizandoLado, setActualizandoLado] = useState('');
  const fotoInputRef = useRef(null);
  const ladoPendienteRef = useRef('');

  const { addToast, confirm } = useToast();
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = escucharOrdenes((data) => {
      setOrdenes(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const ordenesVisibles = filtrarOrdenesPorUsuario(ordenes, currentUser);

  const ordenesListas = ordenesVisibles.filter(o => o.estado === 'listo_entrega' || o.estado === 'finalizado');
  const otrasEnTaller = ordenesVisibles.filter(o => o.estado !== 'finalizado' && o.estado !== 'listo_entrega' && o.estado !== 'entregado');
  const ordenActual = ordenesVisibles.find(o => o.id === ordenSeleccionadaId);

  useEffect(() => {
    let vivo = true;
    const placa = ordenActual?.placa || '';
    if (!placa) {
      setFotosBase({});
      return () => { vivo = false; };
    }
    setCargandoFotos(true);
    obtenerFotosBase(placa)
      .then((reg) => { if (vivo) setFotosBase(reg || {}); })
      .catch((e) => {
        console.warn('No se pudieron leer las fotos de la base:', e);
        if (vivo) setFotosBase({});
      })
      .finally(() => { if (vivo) setCargandoFotos(false); });
    return () => { vivo = false; };
  }, [ordenActual?.placa]);

  const pedirFotoLado = (lado, desdeCamara = false) => {
    ladoPendienteRef.current = lado;
    const inp = fotoInputRef.current;
    if (!inp) return;
    inp.value = '';
    if (desdeCamara) inp.setAttribute('capture', 'environment');
    else inp.removeAttribute('capture');
    inp.click();
  };

  const handleFotoLado = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const lado = ladoPendienteRef.current;
    if (!file || !lado || !ordenActual?.placa) return;

    setActualizandoLado(lado);
    try {
      const { registro, errores } = await guardarFotosBase(
        ordenActual.placa,
        { [lado]: file },
        currentUser?.nombre || ''
      );
      if (errores.length > 0) {
        addToast(
          `No se pudo actualizar: ${errores.join(', ')}. Se conservó la foto anterior.`,
          'warning',
          7000
        );
      } else {
        setFotosBase((prev) => ({ ...prev, ...(registro || {}) }));
        addToast(`Foto ${lado} actualizada en la base del vehículo.`, 'success');
      }
    } catch (err) {
      console.error(err);
      addToast('Error al actualizar la foto: ' + err.message, 'error');
    } finally {
      setActualizandoLado('');
    }
  };

  const handleCerrarOrden = async (e) => {
    e.preventDefault();

    if (!ordenSeleccionadaId) {
      addToast('Por favor selecciona una orden de trabajo', 'warning');
      return;
    }

    if (!personaRetira.trim()) {
      addToast('Indica el nombre del motorista o conductor que recibe el vehículo', 'warning');
      return;
    }

    const entregadoPor = currentUser?.nombre || 'Recepción de Taller';

    const confirmado = await confirm({
      title: '¿Confirmar entrega y cierre de orden?',
      message: `¿Estás seguro de cerrar la orden de la unidad "${ordenActual?.placa || ''}"? El vehículo quedará registrado como entregado a "${personaRetira.trim()}" por "${entregadoPor}" y la orden se archivará en el Historial.`,
      confirmText: 'Sí, confirmar salida y cerrar orden',
      cancelText: 'Revisar datos',
      danger: false,
      icon: <TbCircleCheck size={28} />
    });
    if (!confirmado) return;

    setGuardando(true);
    try {
      await cerrarOrden(ordenSeleccionadaId, {
        personaRetira: personaRetira.trim(),
        empleadoDespacha: entregadoPor,
        observacionesFinales: observacionesFinales.trim(),
        recomendaciones: recomendaciones.trim()
      });

      addToast(`¡Vehículo ${ordenActual?.placa || ''} entregado y orden cerrada con éxito!`, 'success');
      navigate('/admin/historial');
    } catch (err) {
      console.error(err);
      addToast('Error al cerrar la orden: ' + err.message, 'error');
    } finally {
      setGuardando(false);
    }
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
      <div className="page-header">
        <BotonVolver a="/ordenes" etiqueta="Volver a Órdenes" />
        <h1>Salida y Cierre de Orden</h1>
        <p>Egreso y entrega de la unidad.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 24 }}>
        <div className="card">
          <div className="form-section-title" style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span><IconoMascara className="icon" src="/iconos/salida-taller.png" size={16} /> Unidades Listas para Entrega</span>
            <div className="btn-group">
              <button
                type="button"
                className={`btn btn-sm ${vista === 'fila' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setVista('fila')}
              >
                Vista Fila
              </button>
              <button
                type="button"
                className={`btn btn-sm ${vista === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setVista('cards')}
              >
                Vista Cuadrícula
              </button>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Listos para retiro:
          </p>

          {vista === 'fila' ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Placa</th>
                    <th>Vehículo</th>
                    <th>Mecánico</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenesListas.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)', fontSize: 13 }}>
                        No hay vehículos finalizados. Termina un trabajo en Taller.
                      </td>
                    </tr>
                  ) : (
                    ordenesListas.map(ord => (
                      <tr
                        key={ord.id}
                        onClick={() => setOrdenSeleccionadaId(ord.id)}
                        title="Toca para seleccionar la unidad y abrir el cierre"
                        style={{
                          cursor: 'pointer',
                          background: ordenSeleccionadaId === ord.id ? 'rgba(134,153,46,0.07)' : undefined
                        }}
                      >
                        <td className="placa" style={{ whiteSpace: 'nowrap' }}>
                          <span style={{ color: ordenSeleccionadaId === ord.id ? '#22c55e' : 'var(--color-accent)', marginRight: 4 }}>
                            {ordenSeleccionadaId === ord.id ? <TbCheck size={12} /> : <TbCircle size={8} />}
                          </span>
                          {ord.placa}
                        </td>
                        <td>{ord.marca} {ord.modelo}</td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                          {ord.mecanicoAsignado || 'General'}
                          {apoyosDeOrden(ord).filter(Boolean).length ? ` + ${apoyosDeOrden(ord).filter(Boolean).join(', ')}` : ''}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ordenesListas.map(ord => (
                <div
                  key={ord.id}
                  onClick={() => setOrdenSeleccionadaId(ord.id)}
                  style={{
                    padding: 14,
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${ordenSeleccionadaId === ord.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: ordenSeleccionadaId === ord.id ? 'var(--color-accent-light)' : 'var(--color-bg-input)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 16, fontFamily: 'var(--font-mono)' }}>{ord.placa}</strong>
                    <StatusBadge estado="finalizado" />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    {ord.marca} {ord.modelo} • Mecánico: {ord.mecanicoAsignado || 'General'}{apoyosDeOrden(ord).filter(Boolean).length ? ` + ${apoyosDeOrden(ord).filter(Boolean).join(', ')}` : ''}
                  </div>
                </div>
              ))}

              {ordenesListas.length === 0 && (
                <div className="empty-state" style={{ padding: 24 }}>
                  <TbCircleCheck style={{ fontSize: 36, color: 'var(--color-text-muted)', marginBottom: 8 }} />
                  <h4 style={{ fontSize: 15, color: 'var(--color-text-secondary)' }}>No hay vehículos marcados como "Finalizado"</h4>
                  <p style={{ fontSize: 12 }}>Termina un trabajo en Taller o elige otra unidad activa.</p>
                </div>
              )}
            </div>
          )}

          {otrasEnTaller.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
              <label className="form-label">Otras unidades en taller:</label>
              <select
                className="form-select"
                style={{ marginTop: 8 }}
                value={ordenSeleccionadaId}
                onChange={(e) => setOrdenSeleccionadaId(e.target.value)}
              >
                <option value="">Seleccionar vehículo...</option>
                {otrasEnTaller.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.placa} - {o.marca} {o.modelo} ({o.estado})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="card">
          <form onSubmit={handleCerrarOrden}>
            <div className="form-section-title" style={{ marginTop: 0 }}>
              <IconoMascara className="icon" src="/iconos/registro.png" size={16} /> Datos de Cierre y Retiro
            </div>

            {ordenActual ? (
              <div style={{
                background: 'var(--color-bg-input)',
                padding: 14,
                borderRadius: 'var(--radius-md)',
                marginBottom: 16,
                border: '1px solid var(--color-border)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Vehículo de Flota</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-accent)' }}>
                      {ordenActual.placa} — {ordenActual.marca} {ordenActual.modelo}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {isAdmin && (
                      <>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Gasto de Reparación</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e', fontFamily: 'var(--font-mono)' }}>
                          ${(Number(ordenActual.costoTotal) || (Number(ordenActual.costoRepuestos) || 0) + (Number(ordenActual.costoManoObra) || 0)).toFixed(2)} USD
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {ordenActual.estado === 'finalizado' && (
                  <div style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: 6,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12
                  }}>
                    <div style={{ color: 'var(--color-text-primary)' }}>
                      <strong>Reparación técnica concluida.</strong> La unidad aún no ha sido clasificada como lista para entrega.
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-success"
                      style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
                      onClick={async () => {
                        try {
                          await marcarListoParaEntrega(ordenActual.id, 'Inspección de control de calidad aprobada');
                          addToast('Unidad actualizada a: Listo para Entrega', 'success');
                        } catch (err) {
                          addToast('Error: ' + err.message, 'error');
                        }
                      }}
                    >
                      <TbCircleCheck /> Marcar Listo para Entrega
                    </button>
                  </div>
                )}

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
                  gap: 8,
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid var(--color-border)',
                  fontSize: 12
                }}>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Departamento: </span>
                    <strong>{ordenActual.departamento || 'San Salvador'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Ruta: </span>
                    <strong>{ordenActual.ruta ? ordenActual.ruta.substring(0, 26) + '...' : 'General'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Técnico Mecánico: </span>
                    <strong>{ordenActual.mecanicoAsignado || 'General'}{apoyosDeOrden(ordenActual).filter(Boolean).length ? ` + ${apoyosDeOrden(ordenActual).filter(Boolean).join(', ')}` : ''}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Ingreso: </span>
                    <span>{ordenActual.fechaIngreso?.toDate ? new Date(ordenActual.fechaIngreso.toDate()).toLocaleDateString('es-SV') : '—'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(249,115,22,0.08)',
                padding: 12,
                borderRadius: 'var(--radius-md)',
                marginBottom: 16,
                color: 'var(--color-accent)',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <TbAlertCircle /> Selecciona una unidad a la izquierda para comenzar el cierre.
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Motorista / Conductor que Recibe el Vehículo *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  autoComplete="name"
                  placeholder="Nombre del motorista que retira"
                  value={personaRetira}
                  onChange={(e) => setPersonaRetira(
                    e.target.value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, '')
                  )}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Entregado por</label>
              <input
                type="text"
                className="form-input"
                disabled
                value={currentUser?.nombre || 'Recepción de Taller'}
                style={{ opacity: 0.75, cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Fecha y Hora de Salida</label>
              <input
                type="text"
                className="form-input"
                disabled
                value={fechaSalidaTexto}
                style={{ opacity: 0.7 }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Observaciones Finales Técnicas</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Detalle de trabajos, repuestos o pruebas de ruta..."
                value={observacionesFinales}
                onChange={(e) => setObservacionesFinales(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Recomendaciones Preventivas</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Instrucciones o recomendaciones para el conductor..."
                value={recomendaciones}
                onChange={(e) => setRecomendaciones(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Fotos de Estado al Entregar</label>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                Si algo cambió, reemplace el costado: nunca se acumulan fotos.
              </p>

              <input
                type="file"
                ref={fotoInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFotoLado}
              />

              {!ordenActual ? (
                <div style={{
                  padding: 16,
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--color-text-muted)',
                  border: '1px dashed var(--color-border)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  Selecciona una unidad para ver sus 4 fotos.
                </div>
              ) : cargandoFotos ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                  <div className="spinner" style={{ width: 22, height: 22, borderWidth: 2 }} />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  {LADOS_FICHA.map((lado) => {
                    const foto = fotosBase?.[lado.key];
                    const ocupado = actualizandoLado === lado.key;
                    return (
                      <div
                        key={lado.key}
                        style={{
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          background: 'var(--color-bg-input)'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 8px',
                          fontSize: 11,
                          borderBottom: '1px solid var(--color-border)'
                        }}>
                          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                            <TbCamera size={12} style={{ verticalAlign: -1, marginRight: 3 }} />
                            {lado.num}. {lado.label}
                          </span>
                        </div>
                        {foto ? (
                          <img
                            src={foto}
                            alt={lado.label}
                            style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          <div style={{
                            height: 110,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            fontSize: 12,
                            color: 'var(--color-text-muted)'
                          }}>
                            <TbCamera size={16} /> {lado.vacio}
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 8 }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => pedirFotoLado(lado.key, true)}
                            disabled={ocupado}
                            style={{
                              gridColumn: ocupado ? '1 / -1' : 'auto',
                              justifyContent: 'center', fontSize: 11, padding: '5px 6px'
                            }}
                          >
                            <TbCamera size={12} /> {ocupado ? 'Procesando…' : 'Cámara'}
                          </button>
                          {!ocupado && (
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => pedirFotoLado(lado.key, false)}
                              style={{ justifyContent: 'center', fontSize: 11, padding: '5px 6px' }}
                            >
                              <TbUpload size={12} /> Subir
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {ordenActual && (
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                style={{ width: '100%', marginBottom: 12, gap: 8, borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
                onClick={() => setIsCertOpen(true)}
              >
                <TbPrinter /> Vista Previa Acta de Taller
              </button>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', gap: 10 }}
              disabled={guardando || !ordenSeleccionadaId}
            >
              {guardando ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Procesando Cierre...
                </>
              ) : (
                <>
                  <TbCircleCheck /> Confirmar Salida y Cerrar Orden
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {ordenActual && (
        <InspectionCertificateModal
          isOpen={isCertOpen}
          onClose={() => setIsCertOpen(false)}
          orden={{
            ...ordenActual,
            personaRetira: personaRetira || ordenActual.conductorEntrega,
            observacionesFinales,
            recomendaciones
          }}
        />
      )}
    </div>
  );
}
