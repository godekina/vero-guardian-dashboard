'use client';

import type { ReactElement } from 'react';
import { memo, useMemo, useState } from 'react';
import { Medal, ShieldCheck, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  type AuditContributorInput,
  type RankedAuditContributor,
  rankAuditContributors,
} from './score';

type LeaderboardWindow = 'all' | 'recent';

const MOCK_AUDIT_ACTIVITY: AuditContributorInput[] = [
  {
    contributorId: 'guardian-ade',
    displayName: 'Ade Martins',
    walletAddress: 'GAD3MARTINS7K3R7KZK5F9HZM9R1N2P4Q6S8T0V2W4X6Y8Z0A2B4C6',
    auditsCompleted: 11,
    validationsSubmitted: 34,
    criticalFindings: 4,
    highFindings: 8,
    mediumFindings: 13,
    acceptedFindings: 21,
    disputedFindings: 1,
    lastAuditAt: '2026-06-14T10:20:00.000Z',
  },
  {
    contributorId: 'guardian-nova',
    displayName: 'Nova Chen',
    walletAddress: 'GN0VACHEN7K3R7KZK5F9HZM9R1N2P4Q6S8T0V2W4X6Y8Z0A2',
    auditsCompleted: 9,
    validationsSubmitted: 42,
    criticalFindings: 2,
    highFindings: 11,
    mediumFindings: 16,
    acceptedFindings: 18,
    disputedFindings: 0,
    lastAuditAt: '2026-06-16T15:45:00.000Z',
  },
  {
    contributorId: 'guardian-sol',
    displayName: 'Sol Rivera',
    walletAddress: 'GS0LRIVERA7K3R7KZK5F9HZM9R1N2P4Q6S8T0V2W4X6Y8Z0A',
    auditsCompleted: 7,
    validationsSubmitted: 26,
    criticalFindings: 5,
    highFindings: 5,
    mediumFindings: 10,
    acceptedFindings: 16,
    disputedFindings: 2,
    lastAuditAt: '2026-05-18T08:10:00.000Z',
  },
  {
    contributorId: 'guardian-mira',
    displayName: 'Mira Okafor',
    walletAddress: 'GM1RAOKAFOR7K3R7KZK5F9HZM9R1N2P4Q6S8T0V2W4X6Y8Z0',
    auditsCompleted: 5,
    validationsSubmitted: 18,
    criticalFindings: 1,
    highFindings: 6,
    mediumFindings: 12,
    acceptedFindings: 11,
    disputedFindings: 0,
    lastAuditAt: '2026-06-11T12:00:00.000Z',
  },
];

const DATE_FORMATTER = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
});

function filterActivityByWindow(
  contributors: AuditContributorInput[],
  leaderboardWindow: LeaderboardWindow,
): AuditContributorInput[] {
  if (leaderboardWindow === 'all') {
    return contributors;
  }

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return contributors.filter((contributor) => {
    if (!contributor.lastAuditAt) {
      return false;
    }

    return Date.parse(contributor.lastAuditAt) >= cutoff;
  });
}

function formatWallet(walletAddress: string | undefined, t: (key: string) => string): string {
  if (!walletAddress) {
    return t('leaderboard.noWallet');
  }

  if (walletAddress.length <= 12) {
    return walletAddress;
  }

  return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
}

function formatDate(value: string | undefined, t: (key: string) => string): string {
  if (!value) {
    return t('leaderboard.noActivity');
  }

  return DATE_FORMATTER.format(new Date(value));
}

function getRankClassName(rank: number): string {
  switch (rank) {
    case 1:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
    case 2:
      return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100';
    case 3:
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200';
    default:
      return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300';
  }
}

function LeaderboardRow({ contributor, t }: { contributor: RankedAuditContributor; t: (key: string) => string }): ReactElement {
  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${getRankClassName(contributor.rank)}`}
          aria-label={t('leaderboard.rankAria', { rank: contributor.rank })}
        >
          {contributor.rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900 dark:text-white">
                {contributor.displayName}
              </p>
              <p className="truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                {formatWallet(contributor.walletAddress, t)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                {contributor.score}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('leaderboard.score')}</p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">{t('leaderboard.audits')}</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-200">
                {contributor.auditsCompleted}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">{t('leaderboard.findings')}</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-200">
                {contributor.criticalFindings + contributor.highFindings + contributor.mediumFindings}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">{t('leaderboard.latest')}</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-200">
                {formatDate(contributor.lastAuditAt, t)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </li>
  );
}

function Leaderboard(): ReactElement {
  const { t } = useTranslation();
  const [leaderboardWindow, setLeaderboardWindow] = useState<LeaderboardWindow>('all');
  const rankedContributors = useMemo(
    () => rankAuditContributors(filterActivityByWindow(MOCK_AUDIT_ACTIVITY, leaderboardWindow)),
    [leaderboardWindow],
  );
  const topContributor = rankedContributors[0];
  const totalAudits = useMemo(
    () =>
      rankedContributors.reduce(
        (total, contributor) => total + contributor.auditsCompleted,
        0,
      ),
    [rankedContributors],
  );

  return (
    <section aria-labelledby="audit-leaderboard-title">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <Medal className="h-5 w-5" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-wider">{t('leaderboard.auditActivity')}</p>
          </div>
          <h2 id="audit-leaderboard-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('leaderboard.title')}
          </h2>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setLeaderboardWindow('all')}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              leaderboardWindow === 'all'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
            aria-pressed={leaderboardWindow === 'all'}
          >
            {t('leaderboard.all')}
          </button>
          <button
            type="button"
            onClick={() => setLeaderboardWindow('recent')}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              leaderboardWindow === 'recent'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
            aria-pressed={leaderboardWindow === 'recent'}
          >
            {t('leaderboard.recent30d')}
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/80">
          <div className="mb-1 flex items-center gap-2 text-sky-700 dark:text-sky-400">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-wider">{t('leaderboard.audits')}</p>
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white">{totalAudits}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/80">
          <div className="mb-1 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-wider">{t('leaderboard.leader')}</p>
          </div>
          <p className="truncate font-semibold text-slate-900 dark:text-white">
            {topContributor?.displayName ?? t('leaderboard.noActivity')}
          </p>
        </div>
      </div>

      <ol className="space-y-3">
        {rankedContributors.map((contributor) => (
          <LeaderboardRow key={contributor.contributorId} contributor={contributor} t={t} />
        ))}
      </ol>
    </section>
  );
}

export default memo(Leaderboard);
