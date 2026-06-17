import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WalletProvider, useWallet } from '@/context/WalletContext';

jest.mock('@stellar/freighter-api', () => ({
  isConnected: jest.fn().mockResolvedValue({ isConnected: false }),
  getAddress: jest.fn(),
  requestAccess: jest.fn(),
  WatchWalletChanges: jest.fn(),
  getPublicKey: jest.fn(),
}));

const RABET_KEY = 'GRABET3XVCDTUJ76ZAV2HA72KYXY5YOFZ3F5YMQABR6J32F2TQPWQABCD';
const STORAGE_KEY = 'vero_wallet_publicKey';
const PROVIDER_STORAGE_KEY = 'vero_wallet_provider';

type TestWindow = {
  freighter?: unknown;
  rabet?: { connect: jest.Mock };
};
const testWindow = window as unknown as TestWindow;

function Consumer() {
  const { publicKey, activeProvider, availableProviders, error, isLoading, connect } = useWallet();
  return (
    <div>
      <div data-testid="pk">{publicKey || 'none'}</div>
      <div data-testid="provider">{activeProvider || 'none'}</div>
      <div data-testid="available">
        {availableProviders.map((provider) => `${provider.id}:${provider.isAvailable}`).join(',')}
      </div>
      <div data-testid="error">{error || 'none'}</div>
      <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      <button data-testid="connect-rabet" onClick={() => connect('rabet')}>
        rabet
      </button>
    </div>
  );
}

function renderConsumer() {
  return render(
    <WalletProvider>
      <Consumer />
    </WalletProvider>
  );
}

describe('WalletContext multi-provider support', () => {
  beforeEach(() => {
    localStorage.clear();
    testWindow.freighter = undefined;
    testWindow.rabet = undefined;
  });

  it('lists detected providers and their availability', async () => {
    testWindow.rabet = { connect: jest.fn() };
    renderConsumer();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'));
    expect(screen.getByTestId('available')).toHaveTextContent('freighter:false,rabet:true');
  });

  it('connects through Rabet and persists the active provider', async () => {
    testWindow.rabet = { connect: jest.fn().mockResolvedValue({ publicKey: RABET_KEY }) };
    renderConsumer();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByTestId('connect-rabet'));

    await waitFor(() => expect(screen.getByTestId('pk')).toHaveTextContent(RABET_KEY));
    expect(screen.getByTestId('provider')).toHaveTextContent('rabet');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(RABET_KEY);
    expect(localStorage.getItem(PROVIDER_STORAGE_KEY)).toBe('rabet');
  });

  it('surfaces an error when the selected wallet is not installed', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderConsumer();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByTestId('connect-rabet'));

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('Rabet wallet is not installed')
    );
    expect(screen.getByTestId('provider')).toHaveTextContent('none');
    consoleSpy.mockRestore();
  });
});
