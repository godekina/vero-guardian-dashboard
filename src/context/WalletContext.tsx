'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_WALLET_PROVIDER_ID,
  freighterClient,
  getWalletProvider,
  isFreighterAvailable,
  isWalletProviderId,
  listWalletProviders,
  readCurrentFreighterPublicKey,
  type WalletProviderId,
  type WalletProviderInfo,
} from '@/lib/wallets';

const STORAGE_KEY = 'vero_wallet_publicKey';
const PROVIDER_STORAGE_KEY = 'vero_wallet_provider';
const FREIGHTER_EVENT = 'freighter-account-change';

interface WalletContextType {
  publicKey: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  reputation: number;
  /** The provider used for the current connection, if any. */
  activeProvider: WalletProviderId | null;
  /** Detected Stellar wallet providers and their availability. */
  availableProviders: WalletProviderInfo[];
  /** Connect with a specific provider; defaults to Freighter when omitted. */
  connect: (providerId?: WalletProviderId) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reputation, setReputation] = useState(0);
  const [activeProvider, setActiveProvider] = useState<WalletProviderId | null>(null);
  const [availableProviders, setAvailableProviders] = useState<WalletProviderInfo[]>([]);

  // Detect installed wallet extensions once on the client.
  useEffect(() => {
    setAvailableProviders(listWalletProviders());
  }, []);

  const applyVerifiedPublicKey = useCallback(
    (nextPublicKey: string, providerId: WalletProviderId = DEFAULT_WALLET_PROVIDER_ID) => {
      localStorage.setItem(STORAGE_KEY, nextPublicKey);
      localStorage.setItem(PROVIDER_STORAGE_KEY, providerId);
      setPublicKey(nextPublicKey);
      setActiveProvider(providerId);
      setReputation(0);
      setError(null);
    },
    []
  );

  const clearWalletState = useCallback((nextError: string | null = null) => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PROVIDER_STORAGE_KEY);
    setPublicKey(null);
    setActiveProvider(null);
    setReputation(0);
    setError(nextError);
  }, []);

  const refreshVerifiedWallet = useCallback(async (showLoading: boolean) => {
    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const currentPublicKey = await readCurrentFreighterPublicKey();
      if (currentPublicKey) {
        applyVerifiedPublicKey(currentPublicKey);
      } else {
        clearWalletState();
      }
    } catch (restoreError) {
      console.error('Failed to verify wallet connection:', restoreError);
      clearWalletState(getErrorMessage(restoreError, 'Failed to verify wallet connection'));
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [applyVerifiedPublicKey, clearWalletState]);

  useEffect(() => {
    let isMounted = true;

    const initializeWallet = async () => {
      setIsLoading(true);

      try {
        const storedPublicKey = localStorage.getItem(STORAGE_KEY);
        const storedProvider = localStorage.getItem(PROVIDER_STORAGE_KEY);

        // Only Freighter supports silent session restore; other providers
        // require an explicit reconnect after a reload.
        if (storedProvider && storedProvider !== DEFAULT_WALLET_PROVIDER_ID) {
          clearWalletState();
          return;
        }

        const currentPublicKey = await readCurrentFreighterPublicKey();
        if (!isMounted) {
          return;
        }

        if (!currentPublicKey) {
          clearWalletState();
          return;
        }

        if (!storedPublicKey || storedPublicKey === currentPublicKey) {
          applyVerifiedPublicKey(currentPublicKey);
          return;
        }

        clearWalletState();
      } catch (restoreError) {
        if (!isMounted) {
          return;
        }

        console.error('Failed to initialize wallet:', restoreError);
        clearWalletState(getErrorMessage(restoreError, 'Failed to initialize wallet'));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void initializeWallet();

    return () => {
      isMounted = false;
    };
  }, [applyVerifiedPublicKey, clearWalletState]);

  useEffect(() => {
    const handleAccountChange = () => {
      void refreshVerifiedWallet(false);
    };

    window.addEventListener(FREIGHTER_EVENT, handleAccountChange);

    const WatchWalletChanges = isFreighterAvailable()
      ? freighterClient.WatchWalletChanges
      : undefined;
    const watcher = typeof WatchWalletChanges === 'function' ? new WatchWalletChanges() : null;
    const watchResult = watcher?.watch(({ address, error: watchError }) => {
      if (watchError || !address) {
        clearWalletState(
          watchError ? getErrorMessage(watchError, 'Freighter wallet changed.') : null
        );
        return;
      }

      applyVerifiedPublicKey(address);
    });

    if (watchResult?.error) {
      console.warn('Unable to watch Freighter wallet changes:', watchResult.error);
    }

    return () => {
      window.removeEventListener(FREIGHTER_EVENT, handleAccountChange);
      watcher?.stop();
    };
  }, [applyVerifiedPublicKey, clearWalletState, refreshVerifiedWallet]);

  const connect = useCallback(
    async (providerArg?: WalletProviderId) => {
      // Guard against being used directly as an event handler (onClick={connect}),
      // which would otherwise pass a DOM event in place of a provider id.
      const providerId = isWalletProviderId(providerArg) ? providerArg : DEFAULT_WALLET_PROVIDER_ID;

      setIsLoading(true);
      setError(null);

      try {
        const provider = getWalletProvider(providerId);
        const nextPublicKey = await provider.connect();
        applyVerifiedPublicKey(nextPublicKey, providerId);
      } catch (connectError) {
        const message = getErrorMessage(connectError, 'Failed to connect wallet');
        console.error('Wallet connection error:', connectError);
        clearWalletState(message);
      } finally {
        setIsLoading(false);
      }
    },
    [applyVerifiedPublicKey, clearWalletState]
  );

  const disconnect = useCallback(() => {
    clearWalletState();
  }, [clearWalletState]);

  const value = useMemo<WalletContextType>(
    () => ({
      publicKey,
      isConnected: publicKey !== null,
      isLoading,
      error,
      reputation,
      activeProvider,
      availableProviders,
      connect,
      disconnect,
    }),
    [activeProvider, availableProviders, connect, disconnect, error, isLoading, publicKey, reputation]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
