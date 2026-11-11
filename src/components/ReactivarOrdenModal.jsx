import { useState } from 'react';
import { TbRotateClockwise, TbX } from '../icons';
import ModalPortal from './ModalPortal';

/**
 * Reactivar una OT que fue finalizada por error (vuelve a "En Proceso").
 * Solo encargado de taller / administración y con JUSTIFICACIÓN OBLIGATORIA.
 */
export default function ReactivarOrdenModal({ isOpen, onClose, orden, onConfirmar, guardando = false }) {
  const [justificacion, setJustificacion] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCerrar = () => {
    setJustificacion('');
    setError('');
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!justificacion.trim()) {
      setError('Explica el motivo por el cual se reactiva esta orden (obligatorio).');
      return;
    }
    onConfirmar(justificacion.trim());
  };

  return (
    <ModalPortal>
      <div className="modal-backdrop" onClick={guardando ? undefined : handleCerrar}>
      <div className="modal-content" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', fontSize: 16, fontWeight: 800, margin: 0 }}>
            <TbRotateClockwise /> Reactivar Orden de Trabajo
          </h3>
          <button type="button" className="modal-close" onClick={handleCerrar} disabled={guardando} aria-label="Cerrar">
            <TbX />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              Unidad <strong>{orden?.placa}</strong> ({orden?.marca} {orden?.modelo}) — estado actual:{' '}
              <strong>{orden?.estado}</strong>
            </p>

            <div style={{
              border: '1px solid rgba(166, 35, 60, 0.45)',
              background: 'rgba(166, 35, 60, 0.09)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              marginBottom: 14,
              fontSize: 12.5,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.55
            }}>
              La orden volverá al estado <strong>En Proceso</strong> y saldrá de la cola de Entrega de Vehículo.
              Se registrará la reactivación en el historial con tu usuario y justificación.
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Justificación de la reactivación *</label>
              <textarea
                className="form-textarea"
                rows={4}
                value={justificacion}
                onChange={(e) => { setJustificacion(e.target.value); setError(''); }}
                placeholder="Motivo técnico de la reactivación..."
              />
            </div>

            {error && (
              <div style={{
                marginTop: 10,
                padding: '8px 12px',
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12
              }}>
                {error}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleCerrar} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-warning" disabled={guardando}>
              {guardando ? 'Reactivando...' : (<><TbRotateClockwise /> Reactivar OT</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}
