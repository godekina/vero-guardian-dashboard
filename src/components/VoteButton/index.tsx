'use client';

import type { ReactElement } from 'react';
import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { castVote } from '@/services/contractClient';
import { getStellarExplorerTxUrl } from '@/lib/stellar-expert';
import { useToast } from '@/components/Toast';
import { useRole } from '@/context/RoleContext';
import { useNetwork } from '@/context/NetworkContext';
import { useChainState } from '@/hooks/useChainState';
import { appendAuditEvent } from '@/utils/logger';

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

function getVoteAriaLabel(prId: number, state: VoteButtonState, t: TFunction): string {
  switch (state) {
    case 'voted':
      return t('vote.aria.voted', { prId });
    case 'signing':
      return t('vote.aria.signing', { prId });
    case 'checking-access':
      return t('vote.aria.checkingAccess', { prId });
    case 'missing-wallet':
      return t('vote.aria.missingWallet', { prId });
    case 'unauthorized':
      return t('vote.aria.unauthorized', { prId });
    default:
      return t('vote.aria.ready', { prId });
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

function getVoteButtonText(state: VoteButtonState, t: TFunction): string {
  switch (state) {
    case 'voted':
      return `✓ ${t('vote.voted')}`;
    case 'signing':
      return t('vote.signing');
    case 'checking-access':
      return t('vote.checking');
    case 'unauthorized':
      return t('vote.unauthorized');
    default:
      return t('vote.vote');
  }
}

export default function VoteButton({ prId, publicKey }: VoteButtonProps): ReactElement {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { canVote, isLoading: isRoleLoading } = useRole();
  const { networkConfig } = useNetwork();
  const { forceSync } = useChainState({
    cacheKeys: publicKey
      ? ['dashboard', 'prs', 'transactions', `account:${publicKey}`, `reputation:${publicKey}`]
      : ['dashboard', 'prs', 'transactions'],
  });
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
      showToast(t('vote.toast.connectWallet'), 'warning');
      return;
    }

    if (isRoleLoading || !canVote) {
      showToast(t('vote.toast.notGuardian'), 'error');
      return;
    }

    setLoading(true);
    try {
      const hash = await castVote(
        prId,
        publicKey,
        networkConfig.horizonUrl,
        networkConfig.networkPassphrase
      );
      setVoted(true);
      void appendAuditEvent({
        id: `vote-${prId}-${hash}`,
        type: 'guardian.vote',
        actor: publicKey,
        action: 'vote_submitted',
        resource: 'pull_request',
        resourceId: prId,
        status: 'success',
        metadata: {
          transactionHash: hash,
        },
      }).catch((error) => {
        console.error('Unable to append vote audit log', error);
      });
      const explorerUrl = getStellarExplorerTxUrl(hash);
      showToast(`${t('vote.toast.recorded')} — <a href="${explorerUrl}" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">tx ${hash.slice(0, 8)}…</a>`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('vote.toast.failed');
      void appendAuditEvent({
        type: 'guardian.vote',
        actor: publicKey,
        action: 'vote_failed',
        resource: 'pull_request',
        resourceId: prId,
        status: 'failure',
        metadata: {
          error: message,
        },
      }).catch((error) => {
        console.error('Unable to append failed vote audit log', error);
      });
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleVote}
      disabled={isDisabled}
      aria-label={getVoteAriaLabel(prId, voteButtonState, t)}
      className={getVoteButtonClassName(voteButtonState)}
    >
      {getVoteButtonText(voteButtonState, t)}
    </button>
  );
}
