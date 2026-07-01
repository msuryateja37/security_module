import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, HelpCircle, AlertCircle } from 'lucide-react';

export type ModalType = 'success' | 'warning' | 'danger' | 'info' | 'confirm';

export interface ModalOptions {
  title?: string;
  message: string;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface ModalContextType {
  showAlert: (message: string, title?: string, type?: ModalType, onConfirm?: () => void) => void;
  showConfirm: (options: ModalOptions) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalConfig, setModalConfig] = useState<ModalOptions | null>(null);

  const showAlert = (message: string, title: string = 'Notification', type: ModalType = 'info', onConfirm?: () => void) => {
    setModalConfig({
      title,
      message,
      type,
      confirmText: 'OK',
      onConfirm
    });
  };

  const showConfirm = (options: ModalOptions) => {
    setModalConfig({
      type: 'confirm',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      ...options
    });
  };

  const handleClose = () => {
    if (modalConfig?.onCancel) {
      modalConfig.onCancel();
    }
    setModalConfig(null);
  };

  const handleConfirm = () => {
    if (modalConfig?.onConfirm) {
      modalConfig.onConfirm();
    }
    setModalConfig(null);
  };

  const getIcon = () => {
    switch (modalConfig?.type) {
      case 'success':
        return <CheckCircle2 size={32} style={{ color: 'var(--color-success)' }} />;
      case 'warning':
        return <AlertTriangle size={32} style={{ color: 'var(--color-warning)' }} />;
      case 'danger':
        return <AlertCircle size={32} style={{ color: 'var(--color-danger)' }} />;
      case 'confirm':
        return <HelpCircle size={32} style={{ color: 'var(--color-primary)' }} />;
      default:
        return <Info size={32} style={{ color: 'var(--color-accent)' }} />;
    }
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {modalConfig && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={handleClose}
        >
          <div 
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              padding: '1.75rem',
              position: 'relative',
              animation: 'modalSlideIn 0.2s ease-out forwards'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={handleClose}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0 }}>
                {getIcon()}
              </div>
              <div style={{ flexGrow: 1 }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {modalConfig.title || (modalConfig.type === 'confirm' ? 'Confirm Action' : 'Notification')}
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {modalConfig.message}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem' }}>
              {(modalConfig.type === 'confirm' || modalConfig.cancelText) && (
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleClose}
                  style={{ padding: '0.5rem 1.25rem' }}
                >
                  {modalConfig.cancelText || 'Cancel'}
                </button>
              )}
              <button 
                type="button"
                className={`btn ${modalConfig.type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleConfirm}
                style={{ padding: '0.5rem 1.25rem' }}
              >
                {modalConfig.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
