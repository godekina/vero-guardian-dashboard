'use client';

import { useMemo, useState } from 'react';
import { Database, KeyRound, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type OnChainSearchTarget = {
  id: string;
  label: string;
  contract: string;
  functionId: string;
  account: string;
  network: string;
  type: 'task' | 'vote' | 'reputation' | 'governance' | 'network';
  tags: string[];
  description: string;
};

export type RankedOnChainSearchTarget = OnChainSearchTarget & {
  score: number;
};

export const DEFAULT_ON_CHAIN_SEARCH_TARGETS: OnChainSearchTarget[] = [
  {
    id: 'task-pr',
    label: 'Registered PR task',
    contract: 'Vero Task Registry',
    functionId: 'task_<prId>',
    account: 'Relayer signer',
    network: 'Stellar Testnet',
    type: 'task',
    tags: ['pull request', 'wave contribution', 'manageData', 'registry'],
    description: 'Tracks merged GitHub pull requests that should be reviewed by guardians.',
  },
  {
    id: 'guardian-vote',
    label: 'Guardian vote record',
    contract: 'Vero Vote Ledger',
    functionId: 'vote_<prId>',
    account: 'Guardian wallet',
    network: 'Stellar Testnet',
    type: 'vote',
    tags: ['approval', 'review', 'freighter', 'manageData'],
    description: 'Stores the guardian approval signal submitted after Freighter signs the vote transaction.',
  },
  {
    id: 'guardian-reputation',
    label: 'Guardian reputation score',
    contract: 'Guardian Reputation',
    functionId: 'vero_reputation',
    account: 'Guardian wallet',
    network: 'Stellar Testnet',
    type: 'reputation',
    tags: ['score', 'trust', 'eligibility', 'horizon account data'],
    description: 'Reads the on-chain trust score displayed in the guardian dashboard header.',
  },
  {
    id: 'guardian-role',
    label: 'Guardian access role',
    contract: 'Role Authority',
    functionId: 'guardian_role',
    account: 'Guardian wallet',
    network: 'Stellar Testnet',
    type: 'governance',
    tags: ['admin', 'guardian', 'access control', 'permissions'],
    description: 'Determines whether the connected wallet can vote, manage tasks, or only view the dashboard.',
  },
  {
    id: 'proposal-state',
    label: 'Governance proposal state',
    contract: 'Multisig Governance',
    functionId: 'proposal_<id>',
    account: 'Governance signer set',
    network: 'Stellar Testnet',
    type: 'governance',
    tags: ['multisig', 'threshold', 'proposal', 'approval'],
    description: 'Finds proposal status and signer approval data for governance-controlled actions.',
  },
  {
    id: 'horizon-account-data',
    label: 'Horizon account data',
    contract: 'Stellar Horizon',
    functionId: '/accounts/{publicKey}/data/{key}',
    account: 'Any tracked public key',
    network: 'Stellar Testnet',
    type: 'network',
    tags: ['rpc', 'horizon', 'account data', 'lookup'],
    description: 'Direct account-data lookup used to verify task, vote, role, and reputation records.',
  },
];

const TYPE_STYLES: Record<OnChainSearchTarget['type'], string> = {
  task: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  vote: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  reputation:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  governance:
    'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
  network:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[_/-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function targetToSearchText(target: OnChainSearchTarget): string {
  return [
    target.label,
    target.contract,
    target.functionId,
    target.account,
    target.network,
    target.type,
    target.description,
    ...target.tags,
  ].join(' ');
}

function tokenScore(needle: string, haystack: string): number {
  if (!needle) {
    return 0;
  }

  if (haystack === needle) {
    return 100;
  }

  if (haystack.startsWith(needle)) {
    return 80;
  }

  if (haystack.includes(needle)) {
    return 60;
  }

  let cursor = 0;
  for (const char of needle) {
    cursor = haystack.indexOf(char, cursor);
    if (cursor === -1) {
      return 0;
    }
    cursor += 1;
  }

  return Math.max(15, 40 - Math.max(0, haystack.length - needle.length));
}

export function searchOnChainTargets(
  query: string,
  targets: OnChainSearchTarget[] = DEFAULT_ON_CHAIN_SEARCH_TARGETS,
  maxResults = 5,
): RankedOnChainSearchTarget[] {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return targets.slice(0, maxResults).map((target) => ({ ...target, score: 0 }));
  }

  const queryTokens = normalizedQuery.split(' ');

  return targets
    .map((target) => {
      const searchText = normalizeSearchText(targetToSearchText(target));
      const searchableTokens = searchText.split(' ');
      const score = queryTokens.reduce((sum, queryToken) => {
        const bestTokenScore = Math.max(...searchableTokens.map((targetToken) => tokenScore(queryToken, targetToken)));
        return sum + bestTokenScore;
      }, 0);

      return { ...target, score };
    })
    .filter((target) => target.score > 0)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, maxResults);
}

const TARGET_TRANSLATION_KEYS: Record<string, { label: string; description: string }> = {
  'task-pr': { label: 'globalStateSearch.targets.taskPr.label', description: 'globalStateSearch.targets.taskPr.description' },
  'guardian-vote': { label: 'globalStateSearch.targets.guardianVote.label', description: 'globalStateSearch.targets.guardianVote.description' },
  'guardian-reputation': { label: 'globalStateSearch.targets.guardianReputation.label', description: 'globalStateSearch.targets.guardianReputation.description' },
  'guardian-role': { label: 'globalStateSearch.targets.guardianRole.label', description: 'globalStateSearch.targets.guardianRole.description' },
  'proposal-state': { label: 'globalStateSearch.targets.proposalState.label', description: 'globalStateSearch.targets.proposalState.description' },
  'horizon-account-data': { label: 'globalStateSearch.targets.horizonData.label', description: 'globalStateSearch.targets.horizonData.description' },
};

function translateTarget(target: OnChainSearchTarget, t: (key: string) => string): OnChainSearchTarget {
  const keys = TARGET_TRANSLATION_KEYS[target.id];
  if (!keys) return target;
  return { ...target, label: t(keys.label), description: t(keys.description) };
}

const TYPE_TRANSLATION_KEYS: Record<string, string> = {
  task: 'globalStateSearch.types.task',
  vote: 'globalStateSearch.types.vote',
  reputation: 'globalStateSearch.types.reputation',
  governance: 'globalStateSearch.types.governance',
  network: 'globalStateSearch.types.network',
};

function translateType(type: string, t: (key: string) => string): string {
  return TYPE_TRANSLATION_KEYS[type] ? t(TYPE_TRANSLATION_KEYS[type]) : type;
}

export default function GlobalStateSearch({
  targets = DEFAULT_ON_CHAIN_SEARCH_TARGETS,
}: {
  targets?: OnChainSearchTarget[];
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const translatedTargets = useMemo(
    () => targets.map((target) => translateTarget(target, t)),
    [targets, t],
  );
  const results = useMemo(() => searchOnChainTargets(query, translatedTargets), [query, translatedTargets]);
  const normalizedQuery = normalizeSearchText(query);

  return (
    <section aria-labelledby="global-state-search-title" className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        <h2 id="global-state-search-title" className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('globalStateSearch.heading')}
        </h2>
      </div>

      <label className="block">
        <span className="sr-only">{t('globalStateSearch.searchSrLabel')}</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('globalStateSearch.placeholder')}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </label>

      <div className="space-y-3" aria-live="polite">
        {results.length > 0 ? (
          results.map((target) => (
            <article
              key={target.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{target.label}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${TYPE_STYLES[target.type]}`}>
                      {translateType(target.type, t)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{target.description}</p>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Database className="h-4 w-4" aria-hidden="true" />
                  {target.network}
                </div>
              </div>

              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{t('globalStateSearch.functionId')}</dt>
                  <dd className="mt-1 flex items-center gap-2 font-mono text-xs text-slate-800 dark:text-slate-200">
                    <KeyRound className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    {target.functionId}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{t('globalStateSearch.contract')}</dt>
                  <dd className="mt-1 text-slate-800 dark:text-slate-200">{target.contract}</dd>
                </div>
              </dl>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
            {normalizedQuery ? t('globalStateSearch.noResultsWithQuery', { query: normalizedQuery }) : t('globalStateSearch.noResults')}
          </p>
        )}
      </div>
    </section>
  );
}
