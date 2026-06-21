'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { Download, FileSpreadsheet, ShieldCheck, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Papa from 'papaparse';
import { readAuditLogEvents, readEncryptedAuditLogs } from '@/utils/logger';

export function sanitizeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  let strValue = '';
  if (typeof value === 'object') {
    if (value instanceof Date) {
      strValue = value.toISOString();
    } else if (typeof (value as any).toString === 'function' && (value as any).toString !== Object.prototype.toString) {
      strValue = (value as any).toString();
    } else {
      strValue = JSON.stringify(value);
    }
  } else {
    strValue = String(value);
  }

  // Prevent CSV formula injection by prepending a single quote
  // if the value starts with any of: =, +, -, @, tab (\t), carriage return (\r)
  if (/^[=\+\-\@\t\r]/.test(strValue)) {
    return `'${strValue}`;
  }
  return strValue;
}

export default function AuditExport(): ReactElement {
  const { t } = useTranslation();
  const [recordCount, setRecordCount] = useState<number>(0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const records = readEncryptedAuditLogs();
      setRecordCount(records.length);
    } catch (err) {
      console.error('Failed to read encrypted audit log count:', err);
    }
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const records = readEncryptedAuditLogs();
      if (records.length === 0) {
        setError(t('auditExport.empty'));
        setIsExporting(false);
        return;
      }

      const events = await readAuditLogEvents(records);
      const csvRows = events.map((event) => ({
        id: sanitizeCSVValue(event.id),
        sequence: sanitizeCSVValue(event.sequence),
        timestamp: sanitizeCSVValue(event.timestamp),
        type: sanitizeCSVValue(event.type),
        actor: sanitizeCSVValue(event.actor),
        action: sanitizeCSVValue(event.action),
        resource: sanitizeCSVValue(event.resource),
        resourceId: sanitizeCSVValue(event.resourceId),
        status: sanitizeCSVValue(event.status),
        metadata: event.metadata ? sanitizeCSVValue(event.metadata) : '',
      }));

      const csvString = Papa.unparse(csvRows);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export audit logs:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(t('auditExport.error', { message }));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('auditExport.heading')}
        </h2>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('auditExport.count', { count: recordCount })}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('auditExport.safetyInfo')}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting || recordCount === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white disabled:text-slate-500 dark:disabled:text-slate-400 text-sm font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
        >
          {isExporting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t('auditExport.exporting')}
            </>
          ) : (
            <>
              <Download className="w-4 h-4" aria-hidden="true" />
              {t('auditExport.exportBtn')}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/55 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
