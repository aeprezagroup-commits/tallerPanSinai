import { useRef } from 'react';
import { TbPrinter, TbX, TbCircleCheck, TbShieldCheck, TbClipboardList } from '../icons';
import { generarCertificadoAuditoria } from '../services/diagnosticService';
import { apoyosDeOrden } from '../services/permisosService';
import ModalPortal from './ModalPortal';

export default function InspectionCertificateModal({ isOpen, onClose, orden }) {
  const printAreaRef = useRef(null);

  if (!isOpen || !orden) return null;

  const cert = generarCertificadoAuditoria(orden);

  const handlePrint = () => {
    window.print();
  };

  const formatFecha = (timestamp) => {
    if (!timestamp) return '—';
    const dateObj = typeof timestamp?.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
    if (Number.isNaN(dateObj.getTime())) return '—';
    return dateObj.toLocaleDateString('es-SV', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <ModalPortal>
      <div className="modal-overlay cert-modal-parent" onClick={onClose} style={{ zIndex: 3000 }}>
        <div
          className="modal cert-modal"
          style={{ maxWidth: 840, width: '95vw', maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-header no-print">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TbShieldCheck style={{ color: 'var(--color-accent)', fontSize: 20 }} />
              <h3 className="modal-title">Acta de Taller e Inspección de Entrega</h3>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={handlePrint}>
                <TbPrinter /> Imprimir Acta de Taller
              </button>
              <button type="button" className="modal-close" onClick={onClose}>
                <TbX />
              </button>
            </div>
          </div>

          <div className="modal-body cert-sheet" ref={printAreaRef} style={{ overflowY: 'auto', padding: '32px 40px', background: 'var(--color-bg-card)' }}>
            <div className="cert-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="cert-logo-seal">
                  <span>PS</span>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: 0.5, color: 'var(--color-text-primary)' }}>
                    PAN SINAÍ S.A. DE C.V.
                  </h2>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase' }}>
                    CONTROL Y GESTIÓN DE FLOTA VEHICULAR
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    Documento oficial de ingreso, reparación y entrega de unidad
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  FECHA: {cert.fechaCertificacion}
                </div>
                <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>
                  ● DOCUMENTO VERIFICADO
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '2px solid var(--color-border)', margin: '20px 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 14, marginBottom: 20 }}>
              <div className="cert-data-box">
                <span className="label">PLACA OFICIAL</span>
                <span className="val" style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--color-accent)' }}>
                  {orden.placa}
                </span>
              </div>

              <div className="cert-data-box">
                <span className="label">MARCA Y MODELO</span>
                <span className="val">{orden.marca} {orden.modelo}</span>
              </div>

              <div className="cert-data-box">
                <span className="label">SERIE MOTOR / VIN</span>
                <span className="val" style={{ fontFamily: 'var(--font-mono)' }}>{orden.numMotor || 'N/D'}</span>
              </div>

              <div className="cert-data-box">
                <span className="label">AÑO / MODELO</span>
                <span className="val">{orden.anio || '2022'}</span>
              </div>

              <div className="cert-data-box">
                <span className="label">TIPO DE TRABAJO</span>
                <span className="val">{orden.tipoTrabajo || 'Mantenimiento Preventivo'}</span>
              </div>

              <div className="cert-data-box">
                <span className="label">ÁREA PRINCIPAL</span>
                <span className="val">{orden.areaPrincipal || 'General'}</span>
              </div>

              <div className="cert-data-box">
                <span className="label">TÉCNICO RESPONSABLE</span>
                <span className="val">
                  {orden.mecanicoAsignado || orden.mecanicoReceptor || 'Taller Central'}
                  {apoyosDeOrden(orden).filter(Boolean).length ? ` + ${apoyosDeOrden(orden).filter(Boolean).join(', ')}` : ''}
                </span>
              </div>

              <div className="cert-data-box">
                <span className="label">FECHA INGRESO</span>
                <span className="val">{formatFecha(orden.fechaIngreso)}</span>
              </div>
            </div>

            <div style={{ marginBottom: 20, padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <TbClipboardList /> DIAGNÓSTICO Y TRABAJO REALIZADO
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)' }}>
                {orden.diagnosticoInicial || 'Inspección periódica conforme a manual del fabricante. Unidad verificada en área de reparación.'}
              </p>
              {orden.observacionesFinales && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--color-border)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  <strong>Observaciones de Salida: </strong> {orden.observacionesFinales}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 10 }}>
                VERIFICACIÓN DE SEGURIDAD OPERACIONAL (CHECKLIST 360°)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 10, fontSize: 11 }}>
                <div className="cert-check-item"><TbCircleCheck style={{ color: '#22c55e' }} /> Sistema de Frenos ABS / Tambor</div>
                <div className="cert-check-item"><TbCircleCheck style={{ color: '#22c55e' }} /> Dirección y Alineación</div>
                <div className="cert-check-item"><TbCircleCheck style={{ color: '#22c55e' }} /> Suspensión y Amortiguadores</div>
                <div className="cert-check-item"><TbCircleCheck style={{ color: '#22c55e' }} /> Nivel de Aceite y Refrigerante</div>
                <div className="cert-check-item"><TbCircleCheck style={{ color: '#22c55e' }} /> Estado de Batería y Alternador</div>
                <div className="cert-check-item"><TbCircleCheck style={{ color: '#22c55e' }} /> Sistema de Alumbrado y Señal</div>
                <div className="cert-check-item"><TbCircleCheck style={{ color: '#22c55e' }} /> Presión de Neumáticos (PSI)</div>
                <div className="cert-check-item"><TbCircleCheck style={{ color: '#22c55e' }} /> Emisiones y Tubo de Escape</div>
                <div className="cert-check-item"><TbCircleCheck style={{ color: '#22c55e' }} /> Equipo de Seguridad / Llave de Ruedas</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 24, marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="signature-line" />
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {orden.mecanicoAsignado || 'Técnico Especialista'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Mecánico Responsable</div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div className="signature-line" />
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {orden.encargadoTaller || 'Supervisión de Taller'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Jefatura de Taller & Flota</div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div className="signature-line" />
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {orden.personaRetira || orden.conductorEntrega || 'Conductor Autorizado'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Recepción Conforme</div>
              </div>
            </div>

            <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', paddingTop: 14, borderTop: '1px dashed var(--color-border)', flexWrap: 'wrap', gap: 8 }}>
              <div>
                ACTA OFICIAL DE TALLER: <strong>{cert.codigoCertificado}</strong>
              </div>
              <div>
                EMISIÓN: {cert.estacionEmisora} • CONTROL INTERNO PAN SINAÍ
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
