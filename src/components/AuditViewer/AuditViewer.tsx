import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPRMetadata } from '@/services/githubClient';
import { generateAuditPDF, type AuditData } from '@/utils/report';
import { Download } from 'lucide-react';

interface AuditViewerProps {
  /**
   * The PR hash (SHA) obtained from on‑chain task metadata.
   */
  prHash: string;
}

interface PRData {
  hash: string;
  title: string;
  author: string;
  url: string;
}

export const AuditViewer: React.FC<AuditViewerProps> = ({ prHash }) => {
  const { t } = useTranslation();
  const [prData, setPrData] = useState<PRData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchPRMetadata(prHash);
        setPrData(data);
      } catch (e: any) {
        setError(e.message ?? t('audit.failedLoad'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [prHash, t]);

  if (loading) {
    return <div className="text-gray-500">{t('audit.loading')}</div>;
  }

  if (error) {
    return <div className="text-red-600">{t('audit.error', { message: error })}</div>;
  }

  if (!prData) {
    return <div className="text-gray-500">{t('audit.unavailable')}</div>;
  }

  const isMatch = prData.hash.toLowerCase() === prHash.toLowerCase();
  const badgeColor = isMatch ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  const badgeLabel = isMatch ? t('audit.match') : t('audit.mismatch');

  const handleDownload = () => {
    const auditData: AuditData = {
      hash: prData.hash,
      title: prData.title,
      author: prData.author,
      url: prData.url,
      isMatch,
      generatedAt: new Date(),
    };
    generateAuditPDF(auditData);
  };

  return (
    <div className="border rounded p-4 shadow-sm bg-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium">{t('audit.heading')}</h3>
        <span className={`px-2 py-1 rounded ${badgeColor} text-sm font-semibold`}>{badgeLabel}</span>
      </div>
      <p className="text-sm font-semibold mb-1">
        <a href={prData.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          {prData.title}
        </a>
      </p>
      <p className="text-xs text-gray-600">{t('audit.author', { author: prData.author })}</p>
      <p className="text-xs text-gray-600 mt-1">{t('audit.hash', { hash: prData.hash })}</p>
      <div className="mt-4">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <Download size={16} />
          {t('audit.downloadReport')}
        </button>
      </div>
    </div>
  );
};

export default AuditViewer;
