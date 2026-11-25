import { useEffect, useRef, useState } from 'react';
import { TbPrinter, TbX, TbCircleCheck, TbShieldCheck, TbClipboardList } from '../icons';
import { generarCertificadoAuditoria } from '../services/diagnosticService';
import { apoyosDeOrden } from '../services/permisosService';
import { obtenerFotosBase } from '../services/fotosVehiculoService';
import ModalPortal from './ModalPortal';
import { reintentarLogo } from '../utils/logoSinai';

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

function HojaActa({ orden, cert, fotoFrontal, conRef }) {
  const observaciones = orden.observacionesFinales || orden.recomendaciones || 'Sin comentarios técnicos';

  return (
    <div className={`modal-body cert-sheet cert-hoja${conRef ? '' : ' cert-sheet-copia'}`}>
      <div className="cert-header">
        <div className="cert-empresa">
          <div className="cert-logo-empresa">
            <img src="/logo-sinai.png" alt="Pan Sinaí" onError={reintentarLogo} />
          </div>
          <div>
            <h2 className="cert-titulo">
              PAN SINAÍ S.A. DE C.V.
            </h2>
            <div className="cert-subtitulo">
              CONTROL Y GESTIÓN DE FLOTA VEHICULAR
            </div>
            <div className="cert-bajada">
              Documento oficial de ingreso, reparación y entrega de unidad
            </div>
          </div>
        </div>

        <div className="cert-encabezado-derecha">
          {fotoFrontal ? (
            <div className="cert-foto-header">
              <img src={fotoFrontal} alt="Foto frontal del vehículo" />
              <span>FOTO FRONTAL</span>
            </div>
          ) : (
            <div className="cert-foto-header cert-foto-header-vacia">
              <span>Sin foto frontal</span>
            </div>
          )}
          <div className="cert-fecha-emision">
            <div className="cert-fecha">
              FECHA: {cert.fechaCertificacion}
            </div>
            <div className="cert-verificado">
              ● DOCUMENTO VERIFICADO
            </div>
          </div>
        </div>
      </div>

      <hr className="cert-hr" />

      <div className="cert-datos">
        <div className="cert-data-box">
          <span className="label">PLACA</span>
          <span className="val cert-placa">
            {orden.placa}
          </span>
        </div>

        <div className="cert-data-box">
          <span className="label">MARCA Y MODELO</span>
          <span className="val">{orden.marca} {orden.modelo}</span>
        </div>

        <div className="cert-data-box">
          <span className="label">SERIE MOTOR / VIN</span>
          <span className="val cert-mono">{orden.numMotor || 'N/D'}</span>
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

      <div className="cert-diagnostico">
        <div className="cert-diag-titulo">
          <TbClipboardList /> DIAGNÓSTICO Y TRABAJO REALIZADO
        </div>
        <p className="cert-diag-texto">
          {orden.diagnosticoInicial || 'Inspección periódica conforme a manual del fabricante. Unidad verificada en área de reparación.'}
        </p>
        <div className="cert-diag-observaciones">
          <strong>Observaciones de Salida: </strong> {observaciones}
        </div>
      </div>

      <div className="cert-checklist-bloque">
        <div className="cert-checklist-titulo">
          VERIFICACIÓN DE SEGURIDAD OPERACIONAL (CHECKLIST 360°)
        </div>
        <div className="cert-checklist">
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

      <div className="cert-firmas">
        <div className="cert-firma">
          <div className="signature-line" />
          <div className="cert-firma-nombre">
            {orden.mecanicoAsignado || 'Técnico Especialista'}
          </div>
          <div className="cert-firma-rol">Mecánico Responsable</div>
        </div>

        <div className="cert-firma">
          <div className="signature-line" />
          <div className="cert-firma-nombre">
            {orden.encargadoTaller || 'Supervisión de Taller'}
          </div>
          <div className="cert-firma-rol">Jefatura de Taller &amp; Flota</div>
        </div>

        <div className="cert-firma">
          <div className="signature-line" />
          <div className="cert-firma-nombre">
            {orden.personaRetira || orden.conductorEntrega || 'Conductor Autorizado'}
          </div>
          <div className="cert-firma-rol">Recepción Conforme</div>
        </div>
      </div>

      <div className="cert-pie">
        <div>
          ACTA DE TALLER: <strong>{cert.codigoCertificado}</strong>
        </div>
        <div>
          EMISIÓN: {cert.estacionEmisora} • CONTROL INTERNO PAN SINAÍ
        </div>
      </div>
    </div>
  );
}

export default function InspectionCertificateModal({ isOpen, onClose, orden }) {
  const printAreaRef = useRef(null);
  const [fotoFrontal, setFotoFrontal] = useState('');

  const claveFoto = isOpen && orden?.placa ? orden.placa : '';
  const [claveFotoPrevia, setClaveFotoPrevia] = useState(claveFoto);

  if (claveFotoPrevia !== claveFoto) {
    setClaveFotoPrevia(claveFoto);
    if (!claveFoto) setFotoFrontal('');
  }

  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.classList.add('acta-abierta');
    return () => document.body.classList.remove('acta-abierta');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !orden?.placa) return undefined;
    let vivo = true;
    obtenerFotosBase(orden.placa)
      .then((reg) => { if (vivo) setFotoFrontal(reg?.frontal || ''); })
      .catch((e) => {
        console.warn('No se pudo leer la foto frontal:', e);
        if (vivo) setFotoFrontal('');
      });
    return () => { vivo = false; };
  }, [isOpen, orden?.placa]);

  if (!isOpen || !orden) return null;

  const cert = generarCertificadoAuditoria(orden);

  const handlePrint = () => {
    window.print();
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

          <div ref={printAreaRef} className="cert-print-wrap" style={{ overflowY: 'auto' }}>
            <HojaActa orden={orden} cert={cert} fotoFrontal={fotoFrontal} conRef />
            <HojaActa orden={orden} cert={cert} fotoFrontal={fotoFrontal} />
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
