import { useState } from 'react';
import { TbCircleCheck, TbX, TbAlertTriangle } from '../icons';
import ModalPortal from './ModalPortal';

export default function FinalizacionOrdenModal(props) {
  if (!props.isOpen) return null;
  return <FinalizacionModalContent key={props.orden?.id || 'finalizar'} {...props} />;
}

function FinalizacionModalContent({ onClose, orden, onConfirmar, guardando = false, incompleta = false }) {
  const [justificacionCierre, setJustificacionCierre] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (incompleta && !justificacionCierre.trim()) {
      setError('La OT tiene actividades pendientes: es obligatorio indicar la justificación del cierre excepcional.');
      return;
    }

    onConfirmar({
      trabajoRealizado: orden?.trabajoRealizado || 'Actividades de mantenimiento completadas según fases técnicas de la orden.',
      valeBodega: orden?.valeBodega || '',
      detalleRepuestos: orden?.detalleRepuestos || '',
      repuestos: orden?.repuestos || [],
      justificacionCierre: incompleta ? justificacionCierre.trim() : ''
    });
  };

  return (
    <ModalPortal>
      <div className="modal-backdrop" onClick={guardando ? undefined : onClose}>
        <div className="modal-content" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22c55e', fontSize: 16, fontWeight: 800, margin: 0 }}>
              <TbCircleCheck /> Finalización de Orden de Trabajo
            </h3>
            <button type="button" className="modal-close" onClick={onClose} disabled={guardando} aria-label="Cerrar">
              <TbX />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ padding: 20 }}>
              <div style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: 16
              }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                  Unidad a finalizar
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 2 }}>
                  {orden?.placa} — <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>{orden?.marca} {orden?.modelo}</span>
                </div>
              </div>

              {incompleta ? (
                <div style={{
                  border: '1px solid rgba(237, 168, 60, 0.45)',
                  background: 'rgba(237, 168, 60, 0.1)',
                  borderRadius: 'var(--radius-md)',
                  padding: 14,
                  marginBottom: 14
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-gold-dark)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TbAlertTriangle /> OT CON ACTIVIDADES PENDIENTES — Cierre excepcional
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10, lineHeight: 1.4 }}>
                    Aún quedan actividades sin marcar como completadas en esta orden. Para registrar la finalización es obligatorio justificar el motivo técnico del cierre.
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Justificación del cierre *</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      value={justificacionCierre}
                      onChange={(e) => { setJustificacionCierre(e.target.value); setError(''); }}
                      placeholder="Escriba aquí el motivo por el cual se cierra con tareas pendientes..."
                      autoFocus
                    />
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: 14,
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10
                }}>
                  <TbCircleCheck size={22} style={{ color: '#22c55e', flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                    Todas las actividades y fases técnicas han sido marcadas como cumplidas. Al confirmar, la orden pasará al estado <strong>FINALIZADO</strong> lista para control de salida.
                  </div>
                </div>
              )}

              {error && (
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#ef4444',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  marginBottom: 6
                }}>
                  {error}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-success" disabled={guardando}>
                {guardando ? 'Finalizando...' : (<><TbCircleCheck /> Confirmar y Finalizar</>)}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
