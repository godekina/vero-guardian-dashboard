'use client';

import type { ReactElement } from 'react';
import { useState } from 'react';
import { castVote } from '@/services/contractClient';
import { getStellarExplorerTxUrl } from '@/lib/stellar-expert';
import { useToast } from '@/components/Toast';
import { useRole } from '@/context/RoleContext';

interface VoteButtonProps {
  prId: number;
  publicKey: string | null;
}

const VOTE_BUTTON_BASE_CLASSNAME =
  'px-4 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900';

type VoteButtonState =
  | 'voted'
  | 'signing'
  | 'checking-access'
  | 'missing-wallet'
  | 'unauthorized'
  | 'ready';

function getVoteButtonState(
  voted: boolean,
  loading: boolean,
  isRoleLoading: boolean,
  hasPublicKey: boolean,
  canVote: boolean,
): VoteButtonState {
  if (voted) {
    return 'voted';
  }

  if (loading) {
    return 'signing';
  }

  if (isRoleLoading) {
    return 'checking-access';
  }

  if (!hasPublicKey) {
    return 'missing-wallet';
  }

  if (!canVote) {
    return 'unauthorized';
  }

  return 'ready';
}

function getVoteAriaLabel(prId: number, state: VoteButtonState): string {
  switch (state) {
    case 'voted':
      return `Voted for PR #${prId}`;
    case 'signing':
      return `Casting vote for PR #${prId}`;
    case 'checking-access':
      return `Checking vote access for PR #${prId}`;
    case 'missing-wallet':
      return `Connect wallet to vote for PR #${prId}`;
    case 'unauthorized':
      return `Not authorized to vote for PR #${prId}`;
    default:
      return `Vote for PR #${prId}`;
  }
}

function getVoteButtonClassName(state: VoteButtonState): string {
  switch (state) {
    case 'voted':
      return `${VOTE_BUTTON_BASE_CLASSNAME} bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 cursor-default`;
    case 'signing':
    case 'checking-access':
      return `${VOTE_BUTTON_BASE_CLASSNAME} bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 cursor-wait`;
    case 'missing-wallet':
    case 'unauthorized':
      return `${VOTE_BUTTON_BASE_CLASSNAME} bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed`;
    default:
      return `${VOTE_BUTTON_BASE_CLASSNAME} bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20`;
  }
}

function getVoteButtonText(state: VoteButtonState): string {
  switch (state) {
    case 'voted':
      return '✓ Voted';
    case 'signing':
      return 'Signing…';
    case 'checking-access':
      return 'Checking…';
    case 'unauthorized':
      return 'Unauthorized';
    default:
      return 'Vote';
  }
}

export default function VoteButton({ prId, publicKey }: VoteButtonProps): ReactElement {
  const { showToast } = useToast();
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { canVote, isLoading: isRoleLoading } = useRole();
  const hasPublicKey = Boolean(publicKey);
  const voteButtonState = getVoteButtonState(
    voted,
    loading,
    isRoleLoading,
    hasPublicKey,
    canVote,
  );
  const isDisabled = voteButtonState !== 'ready';

  async function handleVote(): Promise<void> {
    if (voted || loading) {
      return;
    }

    if (!publicKey) {
      showToast('Connect your wallet first', 'warning');
      return;
    }

    if (isRoleLoading || !canVote) {
      showToast('Not an authorized Guardian', 'error');
      return;
    }

    setLoading(true);
    try {
      const hash = await castVote(prId, publicKey);
      setVoted(true);
      const explorerUrl = getStellarExplorerTxUrl(hash);
showToast(`Vote recorded — <a href="${explorerUrl}" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">tx ${hash.slice(0, 8)}…</a>`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Vote failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleVote}
      disabled={isDisabled}
      aria-label={getVoteAriaLabel(prId, voteButtonState)}
      className={getVoteButtonClassName(voteButtonState)}
    >
      {getVoteButtonText(voteButtonState)}
    </button>
  );
}
