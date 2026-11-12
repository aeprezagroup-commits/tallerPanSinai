import { useEffect, useRef, useState, useCallback } from 'react';
import { TbX, TbAlertCircle } from '../icons';
import ModalPortal from './ModalPortal';
import IconoMascara from './IconoMascara';

/**
 * Modal con la cámara en vivo del dispositivo (getUserMedia) para TOMAR la foto
 * en lugar de sólo subir un archivo. Devuelve un File JPEG a `onFoto` y cierra.
 * Si no hay cámara o se deniega el permiso, muestra un aviso para usar "Subir".
 */
export default function CameraModal({ isOpen, onClose, onFoto, titulo = 'Tomar foto' }) {
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // El <video> se monta con retardo (ModalPortal), así que el stream se adjunta
  // también cuando el nodo aparece, no sólo cuando el stream resuelve.
  const asignarVideo = useCallback(node => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return undefined;
    }
    setError('');
    let vivo = true;
    (async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('sin-camara');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
        if (!vivo) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        if (vivo) {
          setError('No se pudo activar la cámara (permiso denegado o dispositivo sin cámara). ' +
            'Use "Subir" para elegir una foto del equipo.');
        }
      }
    })();
    return () => {
      vivo = false;
      stopCamera();
    };
  }, [isOpen, stopCamera]);

  if (!isOpen) return null;

  const capturar = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    const ancho = video.videoWidth;
    const alto = video.videoHeight;
    if (!ancho || !alto) return;
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, ancho, alto);
    canvas.toBlob(blob => {
      if (!blob) return;
      const archivo = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopCamera();
      onFoto(archivo);
      onClose();
    }, 'image/jpeg', 0.9);
  };

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconoMascara src="/iconos/camara-fotografica.png" size={20} estilo={{ color: 'var(--color-accent)' }} />
              <h3 className="modal-title">{titulo}</h3>
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
              <TbX />
            </button>
          </div>

          <div className="modal-body" style={{ padding: '16px 20px 20px' }}>
            {error ? (
              <div style={{
                padding: 10,
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                display: 'flex',
                gap: 8,
                alignItems: 'center'
              }}>
                <TbAlertCircle style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            ) : (
              <>
                <div style={{
                  width: '100%',
                  aspectRatio: '4 / 3',
                  background: '#000',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  border: '2px solid var(--color-border)'
                }}>
                  <video
                    ref={asignarVideo}
                    playsInline
                    muted
                    autoPlay
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, textAlign: 'center' }}>
                  Coloque el vehículo dentro del encuadre y presione "Tomar foto".
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={capturar}
                    style={{ gap: 8, padding: '10px 22px' }}
                  >
                    <IconoMascara src="/iconos/camara-fotografica.png" size={16} /> Tomar foto
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onClose}
                    style={{ padding: '10px 22px' }}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
