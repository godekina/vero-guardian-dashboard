jest.mock('@stellar/freighter-api', () => ({
  requestAccess: jest.fn(),
  getPublicKey: jest.fn(),
  isConnected: jest.fn(),
  getAddress: jest.fn(),
  WatchWalletChanges: jest.fn(),
}));

import * as freighter from '@stellar/freighter-api';
import {
  DEFAULT_WALLET_PROVIDER_ID,
  freighterProvider,
  getWalletProvider,
  isWalletProviderId,
  listWalletProviders,
  rabetProvider,
} from '@/lib/wallets';

const PUBLIC_KEY = 'GDZST3XVCDTUJ76ZAV2HA72KYXY5YOFZ3F5YMQABR6J32F2TQPWQNQ3X';

type TestWindow = {
  freighter?: unknown;
  rabet?: { connect: jest.Mock };
};
const testWindow = window as unknown as TestWindow;
const mockRequestAccess = freighter.requestAccess as unknown as jest.Mock;

beforeEach(() => {
  mockRequestAccess.mockReset();
  testWindow.freighter = undefined;
  testWindow.rabet = undefined;
});

describe('freighterProvider', () => {
  it('reports availability from window.freighter', () => {
    expect(freighterProvider.isAvailable()).toBe(false);
    testWindow.freighter = {};
    expect(freighterProvider.isAvailable()).toBe(true);
  });

  it('throws a not-installed error when Freighter is missing', async () => {
    await expect(freighterProvider.connect()).rejects.toThrow('Freighter wallet is not installed');
  });

  it('returns the granted address via requestAccess', async () => {
    testWindow.freighter = {};
    mockRequestAccess.mockResolvedValue({ address: PUBLIC_KEY });
    await expect(freighterProvider.connect()).resolves.toBe(PUBLIC_KEY);
    expect(mockRequestAccess).toHaveBeenCalled();
  });
});

describe('rabetProvider', () => {
  it('reports availability from window.rabet', () => {
    expect(rabetProvider.isAvailable()).toBe(false);
    testWindow.rabet = { connect: jest.fn() };
    expect(rabetProvider.isAvailable()).toBe(true);
  });

  it('throws a not-installed error when Rabet is missing', async () => {
    await expect(rabetProvider.connect()).rejects.toThrow('Rabet wallet is not installed');
  });

  it('returns the public key from rabet.connect', async () => {
    testWindow.rabet = { connect: jest.fn().mockResolvedValue({ publicKey: PUBLIC_KEY }) };
    await expect(rabetProvider.connect()).resolves.toBe(PUBLIC_KEY);
  });

  it('throws a helpful error when Rabet returns no address', async () => {
    testWindow.rabet = { connect: jest.fn().mockResolvedValue({}) };
    await expect(rabetProvider.connect()).rejects.toThrow('Rabet did not return a wallet address');
  });

  it('surfaces the underlying rejection message', async () => {
    testWindow.rabet = { connect: jest.fn().mockRejectedValue(new Error('User rejected')) };
    await expect(rabetProvider.connect()).rejects.toThrow('User rejected');
  });
});

describe('wallet registry', () => {
  it('exposes Freighter as the default provider', () => {
    expect(DEFAULT_WALLET_PROVIDER_ID).toBe('freighter');
    expect(getWalletProvider('freighter')).toBe(freighterProvider);
    expect(getWalletProvider('rabet')).toBe(rabetProvider);
  });

  it('validates provider ids', () => {
    expect(isWalletProviderId('freighter')).toBe(true);
    expect(isWalletProviderId('rabet')).toBe(true);
    expect(isWalletProviderId('metamask')).toBe(false);
    expect(isWalletProviderId(undefined)).toBe(false);
    expect(isWalletProviderId({})).toBe(false);
  });

  it('lists providers with their current availability', () => {
    testWindow.freighter = {};
    testWindow.rabet = { connect: jest.fn() };
    const list = listWalletProviders();
    expect(list.map((provider) => provider.id)).toEqual(['freighter', 'rabet']);
    expect(list.every((provider) => provider.isAvailable)).toBe(true);
  });
});
