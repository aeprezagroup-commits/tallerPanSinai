import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  TbCircleCheck,
  TbAlertCircle,
  TbAlertTriangle,
  TbInfoCircle,
  TbX,
  TbTrash
} from '../icons';
import ModalPortal from './ModalPortal';

const ToastContext = createContext();

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe ser utilizado dentro de un ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const confirmResolveRef = useRef(null);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4200, title = null) => {
    const id = Date.now() + Math.random();
    const newToast = {
      id,
      message,
      type: ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info',
      duration,
      title
    };

    setToasts(prev => {
      // Máximo 4 notificaciones simultáneas para no saturar la vista
      const slice = prev.length >= 4 ? prev.slice(prev.length - 3) : prev;
      return [...slice, newToast];
    });

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  // Diálogo modal de confirmación profesional con Promise
  const confirm = useCallback(({
    title = '¿Confirmar acción requerida?',
    message = '¿Estás seguro de continuar con esta operación?',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    danger = false,
    icon = null
  }) => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmDialog({
        title,
        message,
        confirmText,
        cancelText,
        danger,
        icon
      });
    });
  }, []);

  const handleConfirmAction = () => {
    if (confirmResolveRef.current) {
      confirmResolveRef.current(true);
      confirmResolveRef.current = null;
    }
    setConfirmDialog(null);
  };

  const handleCancelAction = () => {
    if (confirmResolveRef.current) {
      confirmResolveRef.current(false);
      confirmResolveRef.current = null;
    }
    setConfirmDialog(null);
  };

  // Atajos de teclado en el diálogo de confirmación: Esc para cancelar
  useEffect(() => {
    if (!confirmDialog) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCancelAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialog]);

  const defaultTitles = {
    success: 'Operación Exitosa',
    error: 'Error de Validación / Sistema',
    warning: 'Atención Requerida',
    info: 'Notificación del Sistema'
  };

  const icons = {
    success: <TbCircleCheck size={20} />,
    error: <TbAlertCircle size={20} />,
    warning: <TbAlertTriangle size={20} />,
    info: <TbInfoCircle size={20} />
  };

  return (
    <ToastContext.Provider value={{ addToast, confirm }}>
      {children}

      {/* Contenedor de Toasts con animación profesional.
           Se portalea a <body> (igual que los modales) porque #root tiene
           z-index: 1 y crea su propio stacking context: dentro de #root los
           mensajes nunca podían superar a los modales que viven en body
           (z-index 99999), por lo que al guardar un gasto el aviso quedaba
           oculto detrás del formulario. En body compiten por z-index y con
           1000000 quedan por encima de todas las capas. */}
      {createPortal(
        <aside className="toast-container" aria-live="polite" aria-atomic="true">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`toast-card toast-${toast.type} animate-slide-left`}
              role="status"
            >
              <div className="toast-accent-bar" />
              <div className="toast-icon-wrap">
                {icons[toast.type]}
              </div>
              <div className="toast-body">
                <span className="toast-title">
                  {toast.title || defaultTitles[toast.type]}
                </span>
                <p className="toast-message">{toast.message}</p>
              </div>
              <button
                type="button"
                className="toast-close-btn"
                onClick={() => removeToast(toast.id)}
                aria-label="Cerrar notificación"
              >
                <TbX size={15} />
              </button>
              {toast.duration > 0 && (
                <div className="toast-progress-track">
                  <div
                    className="toast-progress-fill"
                    style={{ animationDuration: `${toast.duration}ms` }}
                  />
                </div>
              )}
            </div>
          ))}
        </aside>,
        document.body
      )}

      {/* Modal de Confirmación Profesional (reemplazo de window.confirm) */}
      {confirmDialog && (
        <ModalPortal>
          <div
            className="confirm-modal-backdrop"
            onClick={handleCancelAction}
            role="presentation"
          >
            <div
              className="confirm-modal-box animate-scale-in"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-modal-title"
            >
              <div className={`confirm-modal-badge ${confirmDialog.danger ? 'is-danger' : 'is-warning'}`}>
                {confirmDialog.icon || (
                  confirmDialog.danger ? <TbTrash size={28} /> : <TbAlertTriangle size={28} />
                )}
              </div>
              <div className="confirm-modal-content">
                <h3 id="confirm-modal-title" className="confirm-modal-title">
                  {confirmDialog.title}
                </h3>
                <p className="confirm-modal-text">
                  {confirmDialog.message}
                </p>
              </div>
              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary confirm-btn-cancel"
                  onClick={handleCancelAction}
                >
                  {confirmDialog.cancelText}
                </button>
                <button
                  type="button"
                  className={`btn ${confirmDialog.danger ? 'btn-danger' : 'btn-primary'} confirm-btn-action`}
                  onClick={handleConfirmAction}
                  autoFocus
                >
                  {confirmDialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </ToastContext.Provider>
  );
}
