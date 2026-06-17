function getVaultEnvName(name) {
  return `RELAYER_VAULT_${assertSecretName(name).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
}

function getVaultSecretStatus(name, env = process.env) {
  const normalizedName = assertSecretName(name);
  const rawSecretPresent = Boolean(env[normalizedName]);
  const encryptedRecordPresent = Boolean(
    env[getVaultEnvName(normalizedName)] ||
      env.RELAYER_VAULT_STORE ||
      env.RELAYER_VAULT_FILE,
  );
  const providerName = String(env.RELAYER_VAULT_KEY_PROVIDER || '').toLowerCase();
  const hardwareBacked =
    env.RELAYER_VAULT_HARDWARE_BACKED === 'true' ||
    Boolean(providerName && providerName !== 'software' && providerName !== 'env');

  return {
    configured: encryptedRecordPresent,
    hardwareBacked,
    rawSecretPresent,
    warning: rawSecretPresent
      ? `${normalizedName} is a raw environment secret and will be ignored; use ${getVaultEnvName(normalizedName)}`
      : undefined,
  };
}

function assertSecretName(name) {
  const normalizedName = String(name).trim();

  if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(normalizedName)) {
    throw new Error('Vault secret name contains unsupported characters');
  }

  return normalizedName;
}

module.exports = {
  getVaultEnvName,
  getVaultSecretStatus,
};
