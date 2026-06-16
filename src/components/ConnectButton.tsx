'use client';

import { useWallet } from '@/context/WalletContext';
import { Wallet, LogOut, Loader2 } from 'lucide-react';

export default function ConnectButton() {
  const { publicKey, isConnected, connect, disconnect, isLoading } = useWallet();

  function truncateAddress(address: string) {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }

  if (isLoading) {
    return (
      <button 
        disabled 
        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 cursor-not-allowed"
        aria-label="Connecting wallet..."
      >
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        <span>Loading...</span>
      </button>
    );
  }

  if (isConnected && publicKey) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <Wallet className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm font-mono">{truncateAddress(publicKey)}</span>
        </div>
        <button
          onClick={disconnect}
          aria-label="Disconnect wallet"
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
    >
      <Wallet className="w-4 h-4" aria-hidden="true" />
      <span>Connect Wallet</span>
    </button>
  );
}
