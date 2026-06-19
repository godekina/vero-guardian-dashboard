'use client';

import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { Wallet, LogOut, Loader2, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { WalletProviderId } from '@/lib/wallets';

export default function ConnectButton() {
  const { t } = useTranslation();
  const { publicKey, isConnected, connect, disconnect, isLoading, availableProviders } = useWallet();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  function truncateAddress(address: string) {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }

  // Close the picker when clicking outside of it.
  useEffect(() => {
    if (!isPickerOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPickerOpen]);

  async function handleSelectProvider(providerId: WalletProviderId) {
    setIsPickerOpen(false);
    await connect(providerId);
  }

  if (isLoading) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 cursor-not-allowed"
        aria-label={t('wallet.connecting')}
      >
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        <span>{t('wallet.loading')}</span>
      </button>
    );
  }

  if (isConnected && publicKey) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 px-2 sm:px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800 shadow-sm">
          <Wallet className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline text-xs sm:text-sm font-mono">{truncateAddress(publicKey)}</span>
        </div>
        <button
          onClick={disconnect}
          aria-label={t('wallet.disconnect')}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          <span className="hidden md:inline text-sm font-medium">{t('wallet.disconnect')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={() => setIsPickerOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isPickerOpen}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
      >
        <Wallet className="w-4 h-4" aria-hidden="true" />
        <span>{t('wallet.connect')}</span>
        <ChevronDown className="w-4 h-4" aria-hidden="true" />
      </button>

      {isPickerOpen && (
        <div
          role="menu"
          aria-label={t('wallet.choose')}
          className="absolute right-0 mt-2 w-60 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2"
        >
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('wallet.choose')}
          </p>
          {availableProviders.length === 0 ? (
            <p className="px-2 py-2 text-sm text-slate-500 dark:text-slate-400">
              {t('wallet.noProviders')}
            </p>
          ) : (
            availableProviders.map((provider) => (
              <button
                key={provider.id}
                role="menuitem"
                disabled={!provider.isAvailable}
                onClick={() => handleSelectProvider(provider.id)}
                aria-label={t('wallet.providerAria', { name: provider.name })}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left text-sm font-medium text-slate-800 dark:text-slate-200 enabled:hover:bg-slate-100 dark:enabled:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                  {provider.name}
                </span>
                {!provider.isAvailable && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {t('wallet.notInstalled')}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
