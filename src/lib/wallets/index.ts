// src/lib/wallets/index.ts

import type { StellarWalletProvider, WalletProviderId, WalletProviderInfo } from './types';
import { freighterProvider } from './freighter';
import { rabetProvider } from './rabet';

/**
 * Registry of supported Stellar wallet providers. Order determines the order
 * they appear in the wallet picker; Freighter stays first as the default.
 */
export const walletProviders: StellarWalletProvider[] = [freighterProvider, rabetProvider];

/** The provider used when `connect()` is called without an explicit choice. */
export const DEFAULT_WALLET_PROVIDER_ID: WalletProviderId = 'freighter';

export function isWalletProviderId(value: unknown): value is WalletProviderId {
  return typeof value === 'string' && walletProviders.some((provider) => provider.id === value);
}

export function getWalletProvider(id: WalletProviderId): StellarWalletProvider {
  const provider = walletProviders.find((candidate) => candidate.id === id);
  if (!provider) {
    throw new Error(`Unknown wallet provider: ${id}`);
  }
  return provider;
}

/** Snapshot the registry with current availability for rendering the picker. */
export function listWalletProviders(): WalletProviderInfo[] {
  return walletProviders.map((provider) => ({
    id: provider.id,
    name: provider.name,
    isAvailable: provider.isAvailable(),
  }));
}

export type { StellarWalletProvider, WalletProviderId, WalletProviderInfo } from './types';
export {
  freighterClient,
  freighterProvider,
  isFreighterAvailable,
  readCurrentFreighterPublicKey,
  requestFreighterPublicKey,
} from './freighter';
export type { FreighterWalletWatcher } from './freighter';
export { isRabetAvailable, rabetProvider } from './rabet';
