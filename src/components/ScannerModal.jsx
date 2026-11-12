import { useState, useRef, useEffect, useCallback } from 'react';
import { normalizarPlaca } from '../utils/placas';
import { TbX, TbCheck, TbAlertCircle, TbHash, TbBarcode } from '../icons';
import ModalPortal from './ModalPortal';
import IconoMascara from './IconoMascara';

export default function ScannerModal({ isOpen, onClose, onScanSuccess }) {
  const [error, setError] = useState('');
  const [placaManual, setPlacaManual] = useState('');
  const [mostrarQR, setMostrarQR] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const manualInputRef = useRef(null);
  const detectorRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (detectorRef.current) {
      clearInterval(detectorRef.current);
      detectorRef.current = null;
    }
  }, []);

  const handleDetection = useCallback((detectedText) => {
    stopCamera();
    const placa = normalizarPlaca(detectedText.replace(/^.*[:/]/, ''));
    onScanSuccess(placa);
    onClose();
  }, [stopCamera, onScanSuccess, onClose]);

  const startCamera = useCallback(async () => {
    setError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La cámara no está disponible en este dispositivo o navegador.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      if ('BarcodeDetector' in window) {
        const barcodeDetector = new window.BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix']
        });

        detectorRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === 4) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                handleDetection(barcodes[0].rawValue);
              }
            } catch {
            }
          }
        }, 300);
      }
    } catch (err) {
      console.warn('No se pudo acceder a la cámara:', err);
      setError('No se pudo activar la cámara (permiso requerido o conexión sin HTTPS). Escriba la placa directamente.');
      setMostrarQR(false);
    }
  }, [handleDetection]);

  useEffect(() => {
    if (isOpen) {
      setMostrarQR(false);
      setError('');
      setPlacaManual('');
      const t = setTimeout(() => manualInputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
    stopCamera();
    return stopCamera;
  }, [isOpen, stopCamera]);

  useEffect(() => {
    if (mostrarQR) {
      startCamera();
    } else {
      stopCamera();
    }
    return stopCamera;
  }, [mostrarQR, startCamera, stopCamera]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (placaManual.trim()) {
      handleDetection(placaManual.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconoMascara src="/iconos/camara-de-video.png" size={20} estilo={{ color: 'var(--color-accent)' }} />
              <h3 className="modal-title">Obtener Placa</h3>
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
              <TbX />
            </button>
          </div>

          <div className="modal-body" style={{ padding: '20px 20px 24px' }}>
            <div style={{
              border: '1.5px solid var(--color-accent)',
              borderRadius: 'var(--radius-lg)',
              padding: 16,
              background: 'rgba(134, 153, 46, 0.08)',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <TbHash style={{ color: 'var(--color-accent)', fontSize: 18 }} />
                <strong style={{ fontSize: 13, letterSpacing: 0.3 }}>1. PLACA DEL VEHICULO</strong>
                <span className="badge badge-finalizado" style={{ fontSize: 9.5, marginLeft: 'auto' }}>
                  PRIORIDAD 1
                </span>
              </div>

              <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  ref={manualInputRef}
                  className="form-input"
                  placeholder="Ej. P123456"
                  aria-label="Número de placa"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  enterKeyHint="go"
                  style={{
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    fontSize: 16,
                    letterSpacing: 1.5,
                    padding: '10px 14px'
                  }}
                  value={placaManual}
                  onChange={e => setPlacaManual(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0 18px', gap: 6, flexShrink: 0, fontWeight: 700 }}
                  disabled={!placaManual.trim()}
                >
                  <TbCheck /> Cargar
                </button>
              </form>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
                Escriba la placa del vehículo para autocompletar la orden.
              </div>
            </div>

            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <button
                type="button"
                className={`btn ${mostrarQR ? 'btn-secondary' : 'btn-outline'}`}
                style={{ width: '100%', gap: 8, padding: '10px 16px', justifyContent: 'center' }}
                onClick={() => setMostrarQR(!mostrarQR)}
              >
                <TbBarcode />
                {mostrarQR ? 'Ocultar Escáner QR' : '2. Escanear QR si está disponible'}
              </button>

              {mostrarQR && (
                <div style={{ marginTop: 12 }}>
                  <div className="scanner-video-frame" style={{
                    position: 'relative',
                    width: '100%',
                    height: 200,
                    background: '#000',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid var(--color-border)'
                  }}>
                    <video
                      ref={videoRef}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      playsInline
                      muted
                    />
                    <div style={{
                      position: 'absolute',
                      width: 140,
                      height: 140,
                      border: '2px dashed var(--color-accent)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 0 0 1000px rgba(0, 0, 0, 0.45)',
                      pointerEvents: 'none'
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
                    Apunte la cámara al código QR impreso en el parabrisas de la unidad.
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div style={{
                marginTop: 12,
                padding: 10,
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                textAlign: 'left',
                display: 'flex',
                gap: 8,
                alignItems: 'center'
              }}>
                <TbAlertCircle style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
