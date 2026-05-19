async function registerTaskOnChain(githubId) {
  const secretKey = process.env.STELLAR_SECRET_KEY || '(not set)';
  const network = process.env.STELLAR_NETWORK || 'testnet';

  console.log(`[stellar] Registering PR #${githubId} on ${network}`);
  console.log(`[stellar] Source key loaded: ${secretKey !== '(not set)' ? 'YES' : 'NO (using env default)'}`);

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

module.exports = { registerTaskOnChain };
