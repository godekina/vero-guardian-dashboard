
import * as StellarSdk from '@stellar/stellar-sdk';

export interface NetworkConfig {
  horizonUrl: string;
  sorobanRpcUrl: string;
  networkPassphrase: string;
}

export const DEFAULT_HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
export const DEFAULT_SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';
export const DEFAULT_NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

/** Stellar data entry key used to store the consensus threshold on-chain. */
export const CONSENSUS_THRESHOLD_KEY = 'consensus_threshold';

export const defaultNetworkConfig: NetworkConfig = {
  horizonUrl: DEFAULT_HORIZON_URL,
  sorobanRpcUrl: DEFAULT_SOROBAN_RPC_URL,
  networkPassphrase: DEFAULT_NETWORK_PASSPHRASE,
};

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
