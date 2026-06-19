'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ErrorDetails {
  /** Heading shown at the top of the modal. Defaults to "Something went wrong". */
  title?: string;
  /** Human-readable description of what went wrong. */
  message: ReactNode;
  /** Optional label for an action button (e.g. "Try again"). */
  actionLabel?: string;
  /** Called when the action button is pressed. The modal closes afterwards. */
  onAction?: () => void;
}

interface ErrorContextType {
  /** Open the global error modal with the given details. */
  showError: (error: ErrorDetails) => void;
  /** Close the global error modal. */
  clearError: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [error, setError] = useState<ErrorDetails | null>(null);

  const showError = useCallback((details: ErrorDetails) => {
    setError(details);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Close on Escape for keyboard accessibility.
  useEffect(() => {
    if (!error) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') clearError();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [error, clearError]);

  function handleAction() {
    error?.onAction?.();
    clearError();
  }

  return (
    <ErrorContext.Provider value={{ showError, clearError }}>
      {children}
      {error && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-slate-950/70 animate-in fade-in"
          onClick={clearError}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="error-modal-title"
            aria-describedby="error-modal-message"
            className="relative w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl animate-in zoom-in-95 fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={clearError}
              aria-label={t('errorModal.closeAria')}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-0.5"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 shrink-0 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center border border-red-100 dark:border-red-800">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                </div>
                <div className="flex-1 pt-1">
                  <h2
                    id="error-modal-title"
                    className="text-lg font-semibold text-slate-900 dark:text-white mb-1"
                  >
                    {error.title || t('errorModal.title')}
                  </h2>
                  <div
                    id="error-modal-message"
                    className="text-sm text-slate-600 dark:text-slate-400"
                  >
                    {error.message}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={clearError}
                  className="px-4 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg border border-slate-200 dark:border-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {error.actionLabel ? t('errorModal.cancel') : t('errorModal.dismiss')}
                </button>
                {error.actionLabel && (
                  <button
                    onClick={handleAction}
                    className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {error.actionLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </ErrorContext.Provider>
  );
}

export function useError() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

export type { ErrorDetails };
