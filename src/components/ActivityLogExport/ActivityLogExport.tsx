"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Download, X, Play, StopCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { readEncryptedAuditLogs, exportAuditLogs } from '@/utils/logger';
import { addActivityLogListener, removeActivityLogListener } from '@/hooks/useActivityStream';

export default function ActivityLogExport(): JSX.Element {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string>('idle');
  const writableRef = useRef<any>(null);
  const positionRef = useRef<number>(0);
  const lastExportedHashRef = useRef<string | null>(null);

  useEffect(() => {
    // listen for new persisted audit records and append them immediately
    const handler = () => {
      try {
        const records = readEncryptedAuditLogs();
        if (!records || records.length === 0) return;

        let startIndex = 0;
        if (lastExportedHashRef.current) {
          const idx = records.findIndex((r) => r.hash === lastExportedHashRef.current);
          startIndex = idx >= 0 ? idx + 1 : 0;
        }

        const newRecords = records.slice(startIndex);
        if (newRecords.length === 0) return;
        void appendRecordsToFile(newRecords);
        lastExportedHashRef.current = newRecords.at(-1)?.hash ?? lastExportedHashRef.current;
      } catch (e) {
        // ignore
      }
    };

    addActivityLogListener(handler);

    return () => {
      removeActivityLogListener(handler);
      stopStreaming();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openFileForAppend(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof (window as any).showSaveFilePicker !== 'function') {
      return false;
    }

    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `vero-audit-log-${new Date().toISOString().slice(0, 10)}.ndjson`,
        types: [
          {
            description: 'Audit log (NDJSON)',
            accept: { 'application/x-ndjson': ['.ndjson', '.jsonl'] },
          },
        ],
      });

      const writable = await handle.createWritable();
      writableRef.current = writable;
      positionRef.current = 0;
      lastExportedHashRef.current = null;
      return true;
    } catch (error) {
      console.error('ActivityLogExport: file open cancelled or failed', error);
      return false;
    }
  }

  async function appendRecordsToFile(records: any[]) {
    if (!records || records.length === 0) return;
    const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
    const data = new Blob([lines], { type: 'application/x-ndjson' });

    if (writableRef.current) {
      try {
        const writer = writableRef.current;
        await writer.write({ type: 'write', position: positionRef.current, data });
        positionRef.current += data.size;
      } catch (error) {
        console.error('ActivityLogExport: failed to write to file', error);
        setStatus('write_error');
        stopStreaming();
      }
    }
  }


  async function startStreaming() {
    setStatus('opening');
    const opened = await openFileForAppend();
    if (!opened) {
      setStatus('file_api_unavailable');
      return;
    }

    setRunning(true);
    setStatus('streaming');
  }

  async function stopStreaming() {
    setRunning(false);

    if (writableRef.current) {
      try {
        await writableRef.current.close();
      } catch (error) {
        console.error('ActivityLogExport: failed to close writable', error);
      }
      writableRef.current = null;
      positionRef.current = 0;
      lastExportedHashRef.current = null;
    }

    setStatus('stopped');
  }

  async function handleExportNow() {
    setStatus('exporting');
    try {
      const result = await exportAuditLogs();
      if (result.saved) {
        setStatus('exported');
      } else {
        setStatus('export_ready');
      }
    } catch (error) {
      console.error('ActivityLogExport: export failed', error);
      setStatus('error');
    }
  }

  return (
    <div className="flex gap-2 items-center">
      <button
        type="button"
        onClick={() => (running ? stopStreaming() : startStreaming())}
        className="inline-flex items-center gap-2 px-3 py-2 bg-sky-600 text-white rounded hover:bg-sky-700"
      >
        {running ? <StopCircle size={16} /> : <Play size={16} />} 
        {running ? t('activityLog.stopStreaming', { defaultValue: 'Stop Live Export' }) : t('activityLog.startStreaming', { defaultValue: 'Start Live Export' })}
      </button>

      <button
        type="button"
        onClick={handleExportNow}
        className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
      >
        <Download size={16} />
        {t('activityLog.exportNow', { defaultValue: 'Export Now' })}
      </button>

      <span className="text-sm text-slate-600">{t(`activityLog.status.${status}`, { defaultValue: status })}</span>
    </div>
  );
}
