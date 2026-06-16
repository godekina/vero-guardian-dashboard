'use client';

import { useState } from 'react';
import { castVote } from '@/lib/stellar-interact';
import { useWallet } from '@/context/WalletContext';
import { useToast } from '@/components/Toast';

export interface PR {
  id: number;
  title: string;
  author: string;
  url: string;
}

export default function VoteCard({ pr }: { pr: PR }) {
  const { publicKey } = useWallet();
  const { showToast } = useToast();
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleVote() {
    if (!publicKey) {
      showToast('Please connect your wallet first', 'warning');
      return;
    }
    setLoading(true);
    try {
      await castVote(pr.id, publicKey);
      setVoted(true);
      showToast(`Vote cast for PR #${pr.id}`, 'success');
    } catch (error) {
      showToast('Failed to cast vote', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleVote}
      disabled={voted || loading}
      aria-label={voted ? `Voted for PR #${pr.id}` : loading ? `Casting vote for PR #${pr.id}` : `Vote for PR #${pr.id}`}
      className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        voted
          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 cursor-default'
          : loading
          ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 cursor-wait'
          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900'
      }`}
    >
      {voted ? '✓ Voted' : loading ? 'Voting…' : 'Vote'}
    </button>
  );
}
