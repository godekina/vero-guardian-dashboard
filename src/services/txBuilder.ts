import * as StellarSdk from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import { z } from 'zod';
import type { SorobanInvocation } from '@/components/BatchTxBuilder/batchTxBuilder';

const DEFAULT_HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
const DEFAULT_NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const DEFAULT_TIMEOUT_SECONDS = 30;

// Zod schemas for validation
const BuildBatchTransactionRequestSchema = z.object({
  sourceAccount: z.string().trim().min(1, 'Source account required').refine(
    (val) => StellarSdk.StrKey.isValidEd25519PublicKey(val),
    'Invalid source account public key'
  ),
  operations: z.array(z.any()).min(1, 'At least one operation required'),
  networkPassphrase: z.string().trim().optional(),
  fee: z.union([z.string(), z.number()]).optional(),
  memo: z.any().optional(),
  timeout: z.number().int().nonnegative().optional(),
  sequence: z.string().trim().optional(),
  refreshSequence: z.boolean().optional(),
});

const SignPreparedBatchTransactionRequestSchema = z.object({
  preparedTransaction: z.object({
    unsignedEnvelopeXdr: z.string().trim().min(1),
    networkPassphrase: z.string().trim().min(1),
    sourceAccount: z.string().trim().min(1),
  }),
  signer: z.function().optional(),
});

const BroadcastSignedBatchTransactionRequestSchema = z.object({
  signedTransaction: z.object({
    signedEnvelopeXdr: z.string().trim().min(1),
    networkPassphrase: z.string().trim().min(1),
    sourceAccount: z.string().trim().min(1),
  }),
});

type HorizonServer = InstanceType<typeof StellarSdk.Horizon.Server>;
type HorizonAccount = Awaited<ReturnType<HorizonServer['loadAccount']>>;
type SubmitTransactionInput = Parameters<HorizonServer['submitTransaction']>[0];

export type StellarOperation = Parameters<StellarSdk.TransactionBuilder['addOperation']>[0];
export type StellarMemo = Parameters<StellarSdk.TransactionBuilder['addMemo']>[0];
export type BuiltTransaction = ReturnType<StellarSdk.TransactionBuilder['build']>;
export type SubmitTransactionResult = Awaited<ReturnType<HorizonServer['submitTransaction']>>;

export type BatchTxBuilderErrorCode =
  | 'EMPTY_OPERATIONS'
  | 'MISSING_SOURCE_ACCOUNT'
  | 'MISSING_NETWORK_PASSPHRASE'
  | 'INVALID_OPERATION'
  | 'INVALID_FEE'
  | 'INVALID_TIMEOUT'
  | 'INVALID_SEQUENCE'
  | 'ACCOUNT_LOAD_FAILED'
  | 'SIGNING_FAILED'
  | 'BROADCAST_FAILED'
  | 'STALE_SEQUENCE'
  | 'SOROBAN_SIMULATION_FAILED'
  | 'SOROBAN_SEND_FAILED'
  | 'MIXED_BATCH_NOT_SUPPORTED';

export class BatchTxBuilderError extends Error {
  readonly code: BatchTxBuilderErrorCode;
  readonly cause?: unknown;

  constructor(code: BatchTxBuilderErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'BatchTxBuilderError';
    this.code = code;
    this.cause = cause;
  }
}

export interface SignTransactionResult {
  signedTxXdr?: string;
  signerAddress?: string;
  error?: {
    message?: string;
  };
}

export type TransactionSigner = (
  transactionXdr: string,
  options: {
    networkPassphrase: string;
    address: string;
  },
) => Promise<SignTransactionResult>;

type StellarAccountState = StellarSdk.Account | HorizonAccount;

export interface StellarTransactionServer {
  loadAccount(sourceAccount: string): Promise<StellarAccountState>;
  submitTransaction(transaction: SubmitTransactionInput): Promise<SubmitTransactionResult>;
}

export interface SorobanRpcServer {
  getAccount(sourceAccount: string): Promise<StellarSdk.Account>;
  simulateTransaction(transaction: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction): Promise<StellarSdk.SorobanRpc.Api.SimulateTransactionResponse>;
  sendTransaction(transaction: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction): Promise<StellarSdk.SorobanRpc.Api.SendTransactionResponse>;
}

export interface BatchTransactionBuilderOptions {
  horizonUrl?: string;
  server?: StellarTransactionServer;
  sorobanRpcUrl?: string;
  sorobanServer?: SorobanRpcServer;
  signer?: TransactionSigner;
  networkPassphrase?: string;
  fee?: string | number;
  timeout?: number;
}

export interface BuildBatchTransactionRequest {
  sourceAccount: string;
  operations: readonly StellarOperation[];
  networkPassphrase?: string;
  fee?: string | number;
  memo?: StellarMemo;
  timeout?: number;
  /**
   * Current account sequence to build from. The resulting transaction consumes
   * sequence + 1. Use this only when the caller has just verified account state.
   */
  sequence?: string;
  /** Force a fresh Horizon account load even when a successful local sequence is cached. */
  refreshSequence?: boolean;
}

export interface PreparedBatchTransaction {
  transaction: BuiltTransaction;
  unsignedEnvelopeXdr: string;
  sourceAccount: string;
  networkPassphrase: string;
  fee: string;
  operationCount: number;
  sourceSequence: string;
  sequenceNumber: string;
}

export interface SignPreparedBatchTransactionRequest {
  preparedTransaction: PreparedBatchTransaction;
  signer?: TransactionSigner;
}

export interface SignedBatchTransaction {
  signedEnvelopeXdr: string;
  signedTransaction: ReturnType<typeof StellarSdk.TransactionBuilder.fromXDR>;
  sourceAccount: string;
  networkPassphrase: string;
  operationCount: number;
  sequenceNumber: string;
  unsignedEnvelopeXdr: string;
}

export interface BroadcastSignedBatchTransactionRequest {
  signedTransaction: SignedBatchTransaction;
}

export interface BroadcastBatchTransactionResult {
  hash: string;
  response: SubmitTransactionResult;
  sourceAccount: string;
  networkPassphrase: string;
  operationCount: number;
  sequenceNumber: string;
  unsignedEnvelopeXdr: string;
  signedEnvelopeXdr: string;
}

export interface BuildSorobanTransactionRequest {
  sourceAccount: string;
  invocations: readonly SorobanInvocation[];
  classicOperations?: readonly StellarOperation[];
  networkPassphrase?: string;
  fee?: string | number;
  timeout?: number;
  sequence?: string;
}

export interface PreparedSorobanTransaction {
  transaction: StellarSdk.Transaction;
  unsignedEnvelopeXdr: string;
  sourceAccount: string;
  networkPassphrase: string;
  fee: string;
  operationCount: number;
  sourceSequence: string;
  sequenceNumber: string;
  simulation: StellarSdk.SorobanRpc.Api.SimulateTransactionResponse;
  sorobanOperations: number;
}

export interface SorobanTransactionResult {
  hash: string;
  sendResponse: StellarSdk.SorobanRpc.Api.SendTransactionResponse;
  sourceAccount: string;
  networkPassphrase: string;
  operationCount: number;
  sorobanOperations: number;
  unsignedEnvelopeXdr: string;
  signedEnvelopeXdr: string;
}

type SequenceCache = Map<string, string>;
type SequenceLocks = Map<string, Promise<void>>;

const sequenceCache: SequenceCache = new Map();
const sequenceLocks: SequenceLocks = new Map();

function trimRequired(value: string | undefined, code: BatchTxBuilderErrorCode, message: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new BatchTxBuilderError(code, message);
  }

  return trimmed;
}

function assertOperationBatch(operations: readonly StellarOperation[]): StellarOperation[] {
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new BatchTxBuilderError(
      'EMPTY_OPERATIONS',
      'Batch transactions require at least one Stellar operation.',
    );
  }

  return operations.map((operation, index) => {
    if (!isStellarOperation(operation)) {
      throw new BatchTxBuilderError(
        'INVALID_OPERATION',
        `Invalid Stellar operation at index ${index}.`,
      );
    }

    return operation;
  });
}

function isStellarOperation(operation: unknown): operation is StellarOperation {
  if (typeof operation !== 'object' || operation === null) {
    return false;
  }

  const candidate = operation as { body?: unknown };
  return typeof candidate.body === 'function';
}

function normalizeFee(fee: string | number | undefined): string {
  const normalized = fee === undefined ? StellarSdk.BASE_FEE : String(fee).trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new BatchTxBuilderError('INVALID_FEE', 'Transaction fee must be a positive integer.');
  }

  return normalized;
}

function normalizeTimeout(timeout: number | undefined): number {
  const normalized = timeout ?? DEFAULT_TIMEOUT_SECONDS;
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new BatchTxBuilderError('INVALID_TIMEOUT', 'Transaction timeout must be a non-negative number.');
  }

  return normalized;
}

function incrementSequence(sequence: string): string {
  try {
    return (BigInt(sequence) + BigInt(1)).toString();
  } catch (error) {
    throw new BatchTxBuilderError('INVALID_SEQUENCE', 'Stellar account sequence is invalid.', error);
  }
}

function accountSequenceNumber(account: StellarAccountState): string {
  if (typeof account.sequenceNumber === 'function') {
    return account.sequenceNumber();
  }

  throw new BatchTxBuilderError('INVALID_SEQUENCE', 'Loaded Stellar account did not include a sequence number.');
}

function cacheKey(sourceAccount: string, networkPassphrase: string): string {
  return `${networkPassphrase}:${sourceAccount}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function containsBadSequenceCode(value: unknown, depth = 0): boolean {
  if (depth > 6) {
    return false;
  }

  if (typeof value === 'string') {
    return value.includes('tx_bad_seq');
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).some((child) => containsBadSequenceCode(child, depth + 1));
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (isRecord(error) && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

async function withSequenceLock<T>(
  locks: SequenceLocks,
  key: string,
  work: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let releaseCurrent: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => current);

  locks.set(key, queued);
  await previous.catch(() => undefined);

  try {
    return await work();
  } finally {
    releaseCurrent();
    if (locks.get(key) === queued) {
      locks.delete(key);
    }
  }
}

const DEFAULT_SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';

export class BatchTransactionBuilder {
  private readonly server: StellarTransactionServer;
  private readonly sorobanServer: SorobanRpcServer;
  private readonly signer: TransactionSigner;
  private readonly defaultNetworkPassphrase: string;
  private readonly defaultFee?: string | number;
  private readonly defaultTimeout?: number;
  private readonly sequences: SequenceCache;
  private readonly locks: SequenceLocks;

  constructor(options: BatchTransactionBuilderOptions = {}) {
    this.server =
      options.server ?? new StellarSdk.Horizon.Server(options.horizonUrl ?? DEFAULT_HORIZON_URL);
    this.sorobanServer =
      options.sorobanServer ?? new StellarSdk.SorobanRpc.Server(options.sorobanRpcUrl ?? DEFAULT_SOROBAN_RPC_URL);
    this.signer = options.signer ?? signTransaction;
    this.defaultNetworkPassphrase = options.networkPassphrase ?? DEFAULT_NETWORK_PASSPHRASE;
    this.defaultFee = options.fee;
    this.defaultTimeout = options.timeout;
    this.sequences = sequenceCache;
    this.locks = sequenceLocks;
  }

  async buildBatchTransaction(
    request: BuildBatchTransactionRequest,
  ): Promise<PreparedBatchTransaction> {
    // Validate request with Zod first
    try {
      BuildBatchTransactionRequestSchema.parse(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        // Map Zod errors to existing error codes
        if (firstError.path.includes('sourceAccount')) {
          throw new BatchTxBuilderError(
            'MISSING_SOURCE_ACCOUNT',
            firstError.message,
            error,
          );
        }
        if (firstError.path.includes('operations')) {
          throw new BatchTxBuilderError(
            'EMPTY_OPERATIONS',
            firstError.message,
            error,
          );
        }
        if (firstError.path.includes('fee')) {
          throw new BatchTxBuilderError('INVALID_FEE', firstError.message, error);
        }
        if (firstError.path.includes('timeout')) {
          throw new BatchTxBuilderError(
            'INVALID_TIMEOUT',
            firstError.message,
            error,
          );
        }
        throw new BatchTxBuilderError('INVALID_OPERATION', firstError.message, error);
      }
      throw error;
    }
    
    const sourceAccount = trimRequired(
      request.sourceAccount,
      'MISSING_SOURCE_ACCOUNT',
      'Batch transactions require a source account public key.',
    );
    const networkPassphrase = trimRequired(
      request.networkPassphrase ?? this.defaultNetworkPassphrase,
      'MISSING_NETWORK_PASSPHRASE',
      'Batch transactions require a Stellar network passphrase.',
    );
    const operations = assertOperationBatch(request.operations);
    const fee = normalizeFee(request.fee ?? this.defaultFee);
    const timeout = normalizeTimeout(request.timeout ?? this.defaultTimeout);
    const sourceSequence = await this.resolveSourceSequence({
      sourceAccount,
      networkPassphrase,
      sequence: request.sequence,
      refreshSequence: request.refreshSequence,
    });
    const source = new StellarSdk.Account(sourceAccount, sourceSequence);
    const builder = new StellarSdk.TransactionBuilder(source, {
      fee,
      networkPassphrase,
    });

    if (request.memo) {
      builder.addMemo(request.memo);
    }

    operations.forEach((operation, index) => {
      try {
        builder.addOperation(operation);
      } catch (error) {
        throw new BatchTxBuilderError(
          'INVALID_OPERATION',
          `Unable to add Stellar operation at index ${index}.`,
          error,
        );
      }
    });

    const transaction = builder.setTimeout(timeout).build();
    const sequenceNumber = incrementSequence(sourceSequence);

    return {
      transaction,
      unsignedEnvelopeXdr: transaction.toXDR(),
      sourceAccount,
      networkPassphrase,
      fee,
      operationCount: operations.length,
      sourceSequence,
      sequenceNumber,
    };
  }

  async signBatchTransaction({
    preparedTransaction,
    signer,
  }: SignPreparedBatchTransactionRequest): Promise<SignedBatchTransaction> {
    let signed: SignTransactionResult;

    try {
      signed = await (signer ?? this.signer)(preparedTransaction.unsignedEnvelopeXdr, {
        networkPassphrase: preparedTransaction.networkPassphrase,
        address: preparedTransaction.sourceAccount,
      });
    } catch (error) {
      throw new BatchTxBuilderError(
        'SIGNING_FAILED',
        'Wallet signing failed before the transaction was submitted.',
        error,
      );
    }

    if (signed.error) {
      throw new BatchTxBuilderError(
        'SIGNING_FAILED',
        errorMessage(signed.error, 'Wallet rejected the batch transaction signing request.'),
        signed.error,
      );
    }

    if (!signed.signedTxXdr) {
      throw new BatchTxBuilderError(
        'SIGNING_FAILED',
        'Wallet did not return a signed batch transaction.',
      );
    }

    return {
      signedEnvelopeXdr: signed.signedTxXdr,
      signedTransaction: StellarSdk.TransactionBuilder.fromXDR(
        signed.signedTxXdr,
        preparedTransaction.networkPassphrase,
      ),
      sourceAccount: preparedTransaction.sourceAccount,
      networkPassphrase: preparedTransaction.networkPassphrase,
      operationCount: preparedTransaction.operationCount,
      sequenceNumber: preparedTransaction.sequenceNumber,
      unsignedEnvelopeXdr: preparedTransaction.unsignedEnvelopeXdr,
    };
  }

  async broadcastSignedBatchTransaction({
    signedTransaction,
  }: BroadcastSignedBatchTransactionRequest): Promise<BroadcastBatchTransactionResult> {
    const key = cacheKey(signedTransaction.sourceAccount, signedTransaction.networkPassphrase);

    try {
      const response = await this.server.submitTransaction(signedTransaction.signedTransaction);
      this.sequences.set(key, signedTransaction.sequenceNumber);

      return {
        hash: response.hash,
        response,
        sourceAccount: signedTransaction.sourceAccount,
        networkPassphrase: signedTransaction.networkPassphrase,
        operationCount: signedTransaction.operationCount,
        sequenceNumber: signedTransaction.sequenceNumber,
        unsignedEnvelopeXdr: signedTransaction.unsignedEnvelopeXdr,
        signedEnvelopeXdr: signedTransaction.signedEnvelopeXdr,
      };
    } catch (error) {
      if (containsBadSequenceCode(error)) {
        this.sequences.delete(key);
        throw new BatchTxBuilderError(
          'STALE_SEQUENCE',
          'Stellar account sequence is stale. Refresh account state and retry the batch transaction.',
          error,
        );
      }

      throw new BatchTxBuilderError(
        'BROADCAST_FAILED',
        'Unable to submit signed batch transaction to Stellar Horizon.',
        error,
      );
    }
  }

  async buildSorobanTransaction(
    request: BuildSorobanTransactionRequest,
  ): Promise<PreparedSorobanTransaction> {
    const sourceAccount = trimRequired(
      request.sourceAccount,
      'MISSING_SOURCE_ACCOUNT',
      'Soroban transactions require a source account public key.',
    );
    const networkPassphrase = trimRequired(
      request.networkPassphrase ?? this.defaultNetworkPassphrase,
      'MISSING_NETWORK_PASSPHRASE',
      'Soroban transactions require a Stellar network passphrase.',
    );
    const fee = normalizeFee(request.fee ?? this.defaultFee);
    const timeout = normalizeTimeout(request.timeout ?? this.defaultTimeout);

    if (!request.invocations || request.invocations.length === 0) {
      throw new BatchTxBuilderError(
        'EMPTY_OPERATIONS',
        'Soroban transactions require at least one contract invocation.',
      );
    }

    const sourceSequence = await this.resolveSourceSequence({
      sourceAccount,
      networkPassphrase,
      sequence: request.sequence,
      refreshSequence: false,
    });
    const source = new StellarSdk.Account(sourceAccount, sourceSequence);
    const builder = new StellarSdk.TransactionBuilder(source, { fee, networkPassphrase });

    // Add classic operations first (if any)
    if (request.classicOperations) {
      for (const op of request.classicOperations) {
        builder.addOperation(op);
      }
    }

    // Add Soroban invocations as host function operations
    for (const invocation of request.invocations) {
      const contract = new StellarSdk.Contract(invocation.contractId);
      builder.addOperation(contract.call(invocation.method, ...invocation.args));
    }

    const rawTransaction = builder.setTimeout(timeout).build();

    let simulation: StellarSdk.SorobanRpc.Api.SimulateTransactionResponse;
    try {
      simulation = await this.sorobanServer.simulateTransaction(rawTransaction);
    } catch (error) {
      throw new BatchTxBuilderError(
        'SOROBAN_SIMULATION_FAILED',
        'Soroban transaction simulation failed.',
        error,
      );
    }

    if (StellarSdk.SorobanRpc.Api.isSimulationError(simulation)) {
      throw new BatchTxBuilderError(
        'SOROBAN_SIMULATION_FAILED',
        `Soroban simulation error: ${simulation.error}`,
      );
    }

    const assembledTransaction = StellarSdk.SorobanRpc.assembleTransaction(rawTransaction, simulation) as StellarSdk.TransactionBuilder;
    const builtTransaction = assembledTransaction.build();

    const sequenceNumber = incrementSequence(sourceSequence);

    return {
      transaction: builtTransaction,
      unsignedEnvelopeXdr: builtTransaction.toXDR(),
      sourceAccount,
      networkPassphrase,
      fee,
      operationCount: (request.classicOperations?.length ?? 0) + request.invocations.length,
      sourceSequence,
      sequenceNumber,
      simulation,
      sorobanOperations: request.invocations.length,
    };
  }

  async sendSorobanTransaction({
    signedTransaction,
  }: {
    signedTransaction: SignedBatchTransaction;
  }): Promise<SorobanTransactionResult> {
    try {
      const sendResponse = await this.sorobanServer.sendTransaction(
        signedTransaction.signedTransaction,
      );

      return {
        hash: sendResponse.hash,
        sendResponse,
        sourceAccount: signedTransaction.sourceAccount,
        networkPassphrase: signedTransaction.networkPassphrase,
        operationCount: signedTransaction.operationCount,
        sorobanOperations: 0,
        unsignedEnvelopeXdr: signedTransaction.unsignedEnvelopeXdr,
        signedEnvelopeXdr: signedTransaction.signedEnvelopeXdr,
      };
    } catch (error) {
      throw new BatchTxBuilderError(
        'SOROBAN_SEND_FAILED',
        'Unable to send signed Soroban transaction.',
        error,
      );
    }
  }

  async buildSorobanAndSend(
    request: BuildSorobanTransactionRequest,
  ): Promise<SorobanTransactionResult> {
    const sourceAccount = trimRequired(
      request.sourceAccount,
      'MISSING_SOURCE_ACCOUNT',
      'Soroban transactions require a source account public key.',
    );
    const networkPassphrase = trimRequired(
      request.networkPassphrase ?? this.defaultNetworkPassphrase,
      'MISSING_NETWORK_PASSPHRASE',
      'Soroban transactions require a Stellar network passphrase.',
    );

    const preparedTransaction = await this.buildSorobanTransaction({
      ...request,
      sourceAccount,
      networkPassphrase,
    });

    const signedTransaction = await this.signBatchTransaction({ preparedTransaction: {
      transaction: preparedTransaction.transaction,
      unsignedEnvelopeXdr: preparedTransaction.unsignedEnvelopeXdr,
      sourceAccount: preparedTransaction.sourceAccount,
      networkPassphrase: preparedTransaction.networkPassphrase,
      fee: preparedTransaction.fee,
      operationCount: preparedTransaction.operationCount,
      sourceSequence: preparedTransaction.sourceSequence,
      sequenceNumber: preparedTransaction.sequenceNumber,
    } });

    return this.sendSorobanTransaction({ signedTransaction });
  }

  async signAndBroadcastBatchTransaction(
    request: BuildBatchTransactionRequest,
  ): Promise<BroadcastBatchTransactionResult> {
    const sourceAccount = trimRequired(
      request.sourceAccount,
      'MISSING_SOURCE_ACCOUNT',
      'Batch transactions require a source account public key.',
    );
    const networkPassphrase = trimRequired(
      request.networkPassphrase ?? this.defaultNetworkPassphrase,
      'MISSING_NETWORK_PASSPHRASE',
      'Batch transactions require a Stellar network passphrase.',
    );
    const key = cacheKey(sourceAccount, networkPassphrase);

    return withSequenceLock(this.locks, key, async () => {
      const preparedTransaction = await this.buildBatchTransaction({
        ...request,
        sourceAccount,
        networkPassphrase,
      });
      const signedTransaction = await this.signBatchTransaction({ preparedTransaction });

      return this.broadcastSignedBatchTransaction({ signedTransaction });
    });
  }

  clearCachedSequence(sourceAccount: string, networkPassphrase = this.defaultNetworkPassphrase): void {
    this.sequences.delete(cacheKey(sourceAccount, networkPassphrase));
  }

  getCachedSequence(sourceAccount: string, networkPassphrase = this.defaultNetworkPassphrase): string | undefined {
    return this.sequences.get(cacheKey(sourceAccount, networkPassphrase));
  }

  private async resolveSourceSequence({
    sourceAccount,
    networkPassphrase,
    sequence,
    refreshSequence,
  }: {
    sourceAccount: string;
    networkPassphrase: string;
    sequence?: string;
    refreshSequence?: boolean;
  }): Promise<string> {
    if (sequence !== undefined) {
      const trimmedSequence = trimRequired(
        sequence,
        'INVALID_SEQUENCE',
        'Provided Stellar account sequence is empty.',
      );
      incrementSequence(trimmedSequence);
      return trimmedSequence;
    }

    const key = cacheKey(sourceAccount, networkPassphrase);
    const cachedSequence = refreshSequence ? undefined : this.sequences.get(key);
    if (cachedSequence) {
      return cachedSequence;
    }

    try {
      const account = await this.server.loadAccount(sourceAccount);
      return accountSequenceNumber(account);
    } catch (error) {
      throw new BatchTxBuilderError(
        'ACCOUNT_LOAD_FAILED',
        'Unable to load Stellar source account for batch transaction.',
        error,
      );
    }
  }
}

export const defaultBatchTransactionBuilder = new BatchTransactionBuilder();

export function buildBatchTransaction(
  request: BuildBatchTransactionRequest,
): Promise<PreparedBatchTransaction> {
  return defaultBatchTransactionBuilder.buildBatchTransaction(request);
}

export function signBatchTransaction(
  request: SignPreparedBatchTransactionRequest,
): Promise<SignedBatchTransaction> {
  return defaultBatchTransactionBuilder.signBatchTransaction(request);
}

export function broadcastSignedBatchTransaction(
  request: BroadcastSignedBatchTransactionRequest,
): Promise<BroadcastBatchTransactionResult> {
  return defaultBatchTransactionBuilder.broadcastSignedBatchTransaction(request);
}

export function signAndBroadcastBatchTransaction(
  request: BuildBatchTransactionRequest,
): Promise<BroadcastBatchTransactionResult> {
  return defaultBatchTransactionBuilder.signAndBroadcastBatchTransaction(request);
}

export function buildSorobanTransaction(
  request: BuildSorobanTransactionRequest,
): Promise<PreparedSorobanTransaction> {
  return defaultBatchTransactionBuilder.buildSorobanTransaction(request);
}

export function sendSorobanTransaction(request: {
  signedTransaction: SignedBatchTransaction;
}): Promise<SorobanTransactionResult> {
  return defaultBatchTransactionBuilder.sendSorobanTransaction(request);
}

export function buildSorobanAndSend(
  request: BuildSorobanTransactionRequest,
): Promise<SorobanTransactionResult> {
  return defaultBatchTransactionBuilder.buildSorobanAndSend(request);
}
