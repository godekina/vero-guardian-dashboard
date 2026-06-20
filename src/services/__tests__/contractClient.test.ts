/**
 * contractClient unit tests.
 *
 * The Horizon Server singleton in contractClient.ts is created at module-load
 * time, so we mock @stellar/stellar-sdk to return a stable server object whose
 * methods we can reconfigure between tests.
 */

jest.mock('@stellar/stellar-sdk', () => {
  const original = jest.requireActual('@stellar/stellar-sdk');
  const server = {
    loadAccount: jest.fn(),
    submitTransaction: jest.fn(),
  };

  // Store the server reference on the mock constructor so tests can access it
  const ServerMock = jest.fn(() => server);
  (ServerMock as any).__mockServer = server;

  // Chainable TransactionBuilder mock
  const txMock = {
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({ toXDR: jest.fn().mockReturnValue('xdr') }),
  };
  const TransactionBuilder = jest.fn(() => txMock);
  (TransactionBuilder as any).fromXDR = jest.fn(() => ({}));

  return {
    ...original,
    Horizon: { Server: ServerMock },
    TransactionBuilder,
  };
});

jest.mock('@stellar/freighter-api', () => ({
  signTransaction: jest.fn(),
}));

import { castVote } from '@/services/contractClient';
import { signTransaction } from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';

// Access the mock server instance stored on the Server mock constructor
const mockServer = (StellarSdk.Horizon.Server as any).__mockServer as {
  loadAccount: jest.Mock;
  submitTransaction: jest.Mock;
};

const freighterSignTx = signTransaction as jest.MockedFunction<typeof signTransaction>;

// ---------------------------------------------------------------------------
// castVote
// ---------------------------------------------------------------------------

describe('castVote', () => {
  const PUBLIC_KEY = 'GABC1234';
  const TX_HASH = 'abc123hash';

  beforeEach(() => {
    mockServer.loadAccount.mockResolvedValue({
      accountId: () => PUBLIC_KEY,
      sequenceNumber: () => '1',
      incrementSequenceNumber: jest.fn(),
      sequence: '1',
      id: PUBLIC_KEY,
    });
    mockServer.submitTransaction.mockResolvedValue({ hash: TX_HASH });
    freighterSignTx.mockResolvedValue({ signedTxXdr: 'signedXDR', signerAddress: PUBLIC_KEY } as any);
  });

  afterEach(() => {
    mockServer.loadAccount.mockReset();
    mockServer.submitTransaction.mockReset();
    freighterSignTx.mockReset();
  });

  it('returns transaction hash on success', async () => {
    const hash = await castVote(42, PUBLIC_KEY);
    expect(hash).toBe(TX_HASH);
    expect(freighterSignTx).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        address: PUBLIC_KEY,
        networkPassphrase: expect.any(String),
      })
    );
    expect(mockServer.submitTransaction).toHaveBeenCalled();
  });

  it('propagates Horizon submission errors', async () => {
    mockServer.submitTransaction.mockRejectedValue(new Error('Horizon error'));
    await expect(castVote(42, PUBLIC_KEY)).rejects.toThrow('Horizon error');
  });

  it('propagates Freighter signing errors', async () => {
    freighterSignTx.mockResolvedValue({ error: { message: 'User rejected' } } as any);
    await expect(castVote(42, PUBLIC_KEY)).rejects.toThrow('User rejected');
  });
});
