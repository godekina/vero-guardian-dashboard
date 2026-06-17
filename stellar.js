const { getVaultSecretStatus } = require('./src/services/vault-node');

async function registerTaskOnChain(githubId) {
  const keyStatus = getVaultSecretStatus('STELLAR_SECRET_KEY');
  const network = process.env.STELLAR_NETWORK || 'testnet';

  console.log(`[stellar] Registering PR #${githubId} on ${network}`);
  if (keyStatus.warning) {
    console.warn(`[stellar] ${keyStatus.warning}`);
  }
  console.log(`[stellar] Source key loaded: ${formatVaultStatus(keyStatus)}`);

  // Simulate transaction compilation
  const txPayload = {
    operation: 'manageData',
    key: `task_${githubId}`,
    value: 'wave-contribution',
    network,
    fee: 100,
  };

  console.log('[stellar] Transaction compiled:', JSON.stringify(txPayload, null, 2));
  console.log(`[stellar] ✓ Task PR #${githubId} registered — awaiting submission`);

  return { txPayload, status: 'simulated' };
}

function formatVaultStatus(keyStatus) {
  if (!keyStatus.configured) {
    return 'NO (vault entry missing)';
  }

  return keyStatus.hardwareBacked ? 'YES (hardware-backed vault)' : 'YES (encrypted vault)';
}

module.exports = { registerTaskOnChain };
