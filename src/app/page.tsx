'use client';

import type { ReactElement } from 'react';
import { Activity, ArrowRight, CheckCircle2, Code2, Shield, Trophy } from 'lucide-react';
import ConnectButton from '@/components/ConnectButton';
import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalStateSearch from '@/components/GlobalStateSearch';
import { AccessControl } from '@/components/Guard';
import NetworkStatus from '@/components/NetworkStatus';
import PRFeed from '@/components/PRFeed';
import TaskCard from '@/components/TaskCard';
import ThemeToggle from '@/components/ThemeToggle';
import { useRole } from '@/context/RoleContext';
import { useWallet } from '@/context/WalletContext';
import type { UserRole } from '@/services/roleClient';

function getRoleLabel(role: UserRole, isLoading: boolean): string {
  if (isLoading) {
    return 'Checking…';
  }

  switch (role) {
    case 'admin':
      return 'Admin';
    case 'guardian':
      return 'Guardian';
    default:
      return 'Unauthorized';
  }
}

function getRoleHelperText(
  role: UserRole,
  isConnected: boolean,
  isLoading: boolean,
): string {
  if (isLoading) {
    return 'Checking on-chain role';
  }

  if (!isConnected) {
    return 'Connect wallet';
  }

  if (role === 'unauthorized') {
    return 'No dashboard permissions';
  }

  return 'On-chain access';
}

function getWelcomeTitle(
  isConnected: boolean,
  isRoleLoading: boolean,
  roleLabel: string,
): string {
  if (!isConnected) {
    return 'Welcome to Vero Guardian!';
  }

  if (isRoleLoading) {
    return 'Checking dashboard access…';
  }

  return `Welcome back, ${roleLabel}!`;
}

function getWelcomeDescription(role: UserRole, isRoleLoading: boolean): string {
  if (isRoleLoading) {
    return 'Checking your on-chain role before enabling dashboard actions.';
  }

  switch (role) {
    case 'admin':
      return 'Manage guardian tasks, monitor validation activity, and keep the network secure.';
    case 'guardian':
      return 'Review and validate pull requests to maintain network security and earn rewards.';
    default:
      return 'Connect an authorized wallet to review and validate pull requests.';
  }
}

export default function Home(): ReactElement {
  const { isConnected, reputation } = useWallet();
  const { role, isLoading: isRoleLoading } = useRole();
  const roleLabel = getRoleLabel(role, isRoleLoading);
  const roleHelperText = getRoleHelperText(role, isConnected, isRoleLoading);
  const welcomeTitle = getWelcomeTitle(isConnected, isRoleLoading, roleLabel);
  const welcomeDescription = getWelcomeDescription(role, isRoleLoading);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/30">
                <Shield className="w-6 h-6 text-white" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Vero Guardian</h1>
                <p className="text-xs text-slate-600 dark:text-slate-400">Decentralized Validation Network</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome / Stats */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-white to-slate-100 dark:from-slate-900 dark:to-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  {welcomeTitle}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 max-w-xl">
                  {welcomeDescription}
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-1">
                    <Trophy className="w-4 h-4" aria-hidden="true" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Reputation</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{isConnected ? reputation : '---'}</p>
                </div>
                <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-1">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Validations</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{isConnected ? 12 : '---'}</p>
                </div>
                <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 mb-1">
                    <Shield className="w-4 h-4" aria-hidden="true" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Role</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white" aria-live="polite">{roleLabel}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{roleHelperText}</p>
                </div>
                <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 mb-1">
                    <Activity className="w-4 h-4" aria-hidden="true" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Active</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{isConnected ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - PR Feed */}
          <div className="lg:col-span-2">
            <ErrorBoundary>
              <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg">
                <PRFeed />
              </div>
            </ErrorBoundary>
          </div>

          {/* Right Column - Admin Management & Quick Actions */}
          <div className="space-y-6">
            <ErrorBoundary>
              <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg">
                <GlobalStateSearch />
              </div>
            </ErrorBoundary>

            <AccessControl roles={['admin']}>
              {/* Admin Management */}
              <ErrorBoundary>
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg">
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-3">
                    Admin Management
                  </p>
                  <TaskCard />
                </div>
              </ErrorBoundary>
            </AccessControl>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Code2 className="w-5 h-5 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                Quick Actions
              </h3>
              <div className="space-y-3">
                <button 
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 transition-colors group focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="View Network Status"
                >
                  <span className="font-medium">View Network Status</span>
                  <ArrowRight className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-colors" aria-hidden="true" />
                </button>
                <button 
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 transition-colors group focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Stake VERO Tokens"
                >
                  <span className="font-medium">Stake VERO Tokens</span>
                  <ArrowRight className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-colors" aria-hidden="true" />
                </button>
                <button 
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 transition-colors group focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="View Rewards History"
                >
                  <span className="font-medium">Rewards History</span>
                  <ArrowRight className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-colors" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 mt-12 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-6">
            <NetworkStatus />
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-600 dark:text-slate-500">© 2026 Vero Guardian. All rights reserved.</p>
              <nav className="flex items-center gap-6" aria-label="Footer Navigation">
                <a href="#" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors focus:outline-none focus:underline">Documentation</a>
                <a href="#" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors focus:outline-none focus:underline">Discord</a>
                <a href="#" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors focus:outline-none focus:underline">GitHub</a>
              </nav>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
