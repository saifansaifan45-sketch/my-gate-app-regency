import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastMessage, ToastContainer } from '../components/ui/Toast';

export interface ToastOptions {
  title: string;
  message?: string;
  type?: 'success' | 'info' | 'error' | 'warning';
  duration?: number;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(({ title, message, type = 'success', duration = 4000 }: ToastOptions) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = {
      id,
      title,
      message,
      type,
      duration,
    };

    setToasts((prev) => [...prev.slice(-2), newToast]); // Keep max 2 toasts on screen
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={hideToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
