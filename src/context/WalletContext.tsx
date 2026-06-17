'use client';

 fix/issue-7-freighter-wallet-connection
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { getPublicKey } from '@stellar/freighter-api';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getAddress, isConnected, requestAccess } from '@stellar/freighter-api';
import { getReputation } from '@/lib/stellar-interact';
 main

interface WalletContextType {
  publicKey: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

fix/issue-7-freighter-wallet-connection
const STORAGE_KEY = 'vero_wallet_publicKey';
const FREIGHTER_EVENT = 'freighter-account-change';

/**
 * WalletProvider component that manages Freighter wallet connection state
 * with localStorage persistence and event listeners.
 */

function getFreighterErrorMessage(error: unknown, fallback: string): string {
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

async function loadReputation(publicKey: string, alertOnFailure: boolean): Promise<number> {
  try {
    return await getReputation(publicKey);
  } catch (error) {
    const message = 'Wallet connected, but Stellar reputation could not be loaded. Refresh the page or try again later.';
    console.error('Failed to load Stellar reputation:', { publicKey, error });
    if (alertOnFailure) {
      alert(message);
    }
    return 0;
  }
}

main
export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize wallet state from localStorage on mount
   */
  useEffect(() => {
    const initializeWallet = async () => {
      try {
 fix/issue-7-freighter-wallet-connection
        setIsLoading(true);
        setError(null);

        // Try to restore from localStorage
        const storedKey = localStorage.getItem(STORAGE_KEY);
        if (storedKey) {
          setPublicKey(storedKey);
        }
      } catch (err) {
        console.error('Failed to initialize wallet:', err);
        setError('Failed to initialize wallet');

        const connection = await isConnected();
        if (connection.error) {
          console.warn('Unable to restore Freighter connection: isConnected returned an error', connection.error);
          return;
        }
        if (!connection.isConnected) {
          return;
        }

        const address = await getAddress();
        if (address.error) {
          console.warn('Unable to restore Freighter connection: getAddress returned an error', address.error);
          return;
        }
        if (!address.address) {
          console.warn('Unable to restore Freighter connection: Freighter reported a connection without an address');
          return;
        }

        setPublicKey(address.address);
        setReputation(await loadReputation(address.address, false));
      } catch (error) {
        console.warn('Unable to restore Freighter connection:', error);
 main
      } finally {
        setIsLoading(false);
      }
    };

    initializeWallet();
  }, []);

  /**
   * Set up Freighter account change listener
   */
  useEffect(() => {
    const handleAccountChange = () => {
      // When account changes, clear the stored key and disconnect
      localStorage.removeItem(STORAGE_KEY);
      setPublicKey(null);
      setError(null);
    };

    window.addEventListener(FREIGHTER_EVENT, handleAccountChange);

    return () => {
      window.removeEventListener(FREIGHTER_EVENT, handleAccountChange);
    };
  }, []);

  /**
   * Connect to Freighter wallet using getPublicKey
   */
  const connect = useCallback(async () => {
    try {
 fix/issue-7-freighter-wallet-connection
      setIsLoading(true);
      setError(null);

      // Check if Freighter is installed
      if (!window.freighter) {
        throw new Error('Freighter wallet is not installed');
      }

      // Get public key from Freighter
      const key = await getPublicKey();
      setPublicKey(key);

      // Persist to localStorage
      localStorage.setItem(STORAGE_KEY, key);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(errorMessage);
      console.error('Wallet connection error:', err);
      throw err;
    } finally {
      setIsLoading(false);

      const access = await requestAccess();
      if (access.error) {
        throw new Error(
          getFreighterErrorMessage(access.error, 'Freighter could not grant wallet access. Open Freighter and try again.')
        );
      }
      if (!access.address) {
        throw new Error('Freighter did not return a wallet address. Unlock Freighter and try again.');
      }

      setPublicKey(access.address);
      setReputation(await loadReputation(access.address, true));
    } catch (error) {
      const message = getFreighterErrorMessage(
        error,
        'Freighter wallet connection failed. Install or unlock Freighter, then try again.'
      );
      console.error('Failed to connect wallet with Freighter:', error);
      alert(message);
  main
    }
  }, []);

  /**
   * Disconnect from wallet and clear stored key
   */
  const disconnect = useCallback(() => {
    setPublicKey(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: WalletContextType = {
    publicKey,
    isConnected: publicKey !== null,
    isLoading,
    error,
    connect,
    disconnect,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

/**
 * Hook to access wallet context
 * @throws {Error} If used outside of WalletProvider
 */
export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
