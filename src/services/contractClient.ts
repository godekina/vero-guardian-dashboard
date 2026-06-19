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
