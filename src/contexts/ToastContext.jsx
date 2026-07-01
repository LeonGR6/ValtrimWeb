/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import '../styles/toast.css';

const ToastContext = createContext(null);
const DEFAULT_DURATION = 5500;
let toastSequence = 0;

function ToastViewport({ dismissToast, toasts }) {
  return (
    <div className="toast-viewport" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <div
          className={`app-toast app-toast--${toast.tone}`}
          key={toast.id}
          role={toast.tone === 'error' ? 'alert' : 'status'}
        >
          <span className="app-toast__icon" aria-hidden="true">
            {toast.tone === 'success' ? '✓' : toast.tone === 'error' ? '×' : '!'}
          </span>
          <div className="app-toast__content">
            <strong>{toast.title}</strong>
            {toast.message && <p>{toast.message}</p>}
          </div>
          <button
            className="app-toast__close"
            type="button"
            aria-label={`Dismiss ${toast.title} notification`}
            onClick={() => dismissToast(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }

    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(({ duration = DEFAULT_DURATION, message = '', title, tone = 'info' }) => {
    const id = `toast-${Date.now()}-${toastSequence += 1}`;
    const toast = { id, message, title, tone };

    setToasts((currentToasts) => [...currentToasts, toast].slice(-5));

    if (duration > 0) {
      const timer = window.setTimeout(() => {
        timers.current.delete(id);
        setToasts((currentToasts) => currentToasts.filter((currentToast) => currentToast.id !== id));
      }, duration);
      timers.current.set(id, timer);
    }

    return id;
  }, []);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
  }, []);

  const value = useMemo(() => ({ addToast, dismissToast }), [addToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport dismissToast={dismissToast} toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}
