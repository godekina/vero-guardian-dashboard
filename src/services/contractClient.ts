import * as StellarSdk from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import { defaultNetworkConfig, DEFAULT_HORIZON_URL } from './rpc';

/**
 * Build, Freighter-sign, and submit a vote transaction.
 *
 * @param prId GitHub PR number registered by the Vero Relayer
 * @param publicKey Stellar public key from WalletContext
 * @param horizonUrl Optional Horizon URL (defaults to env or testnet)
 * @param networkPassphrase Optional network passphrase (defaults to testnet)
 * @returns Submitted transaction hash
 */
export async function castVote(
  prId: number,
  publicKey: string,
  horizonUrl: string = defaultNetworkConfig.horizonUrl,
  networkPassphrase: string = defaultNetworkConfig.networkPassphrase
): Promise<string> {
  const server = new StellarSdk.Horizon.Server(horizonUrl);
  const account = await server.loadAccount(publicKey);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.manageData({ name: `vote_${prId}`, value: 'approve' })
    )
    .setTimeout(30)
    .build();

  const signed = await signTransaction(tx.toXDR(), {
    networkPassphrase,
    address: publicKey,
  });
  if (signed.error) {
    throw new Error(signed.error.message ?? 'Freighter failed to sign the vote transaction');
  }

  const signedTx = StellarSdk.TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    networkPassphrase
  );

  const result = await server.submitTransaction(signedTx);
  return result.hash;
}

/**
 * Invoke the `halt()` function on the Vero Soroban contract via Freighter.
 *
 * @param publicKey Stellar public key from WalletContext
 * @param contractId Soroban contract ID to halt
 * @param sorobanRpcUrl Optional Soroban RPC URL (defaults to env or testnet)
 * @param networkPassphrase Optional network passphrase (defaults to testnet)
 * @returns Submitted transaction hash
 */
export async function haltContract(
  publicKey: string,
  contractId: string,
  sorobanRpcUrl: string = defaultNetworkConfig.sorobanRpcUrl,
  networkPassphrase: string = defaultNetworkConfig.networkPassphrase
): Promise<string> {
  const server = new StellarSdk.SorobanRpc.Server(sorobanRpcUrl);
  const account = await server.getAccount(publicKey);

  const contract = new StellarSdk.Contract(contractId);

  const rawTx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call("halt"))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(rawTx);
  if (StellarSdk.SorobanRpc.isSimulationError(simulation)) {
    throw new Error(simulation.error);
  }

  const preparedTx = StellarSdk.SorobanRpc.assembleTransaction(rawTx, simulation);

  const signed = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase,
    address: publicKey,
  });
  if (signed.error) {
    throw new Error(signed.error.message ?? 'Freighter failed to sign the halt transaction');
  }

  const signedTx = StellarSdk.TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    networkPassphrase
  );

  const result = await server.sendTransaction(signedTx);
  if (result.error) {
    throw new Error(result.error);
  }

  return result.hash;
}
