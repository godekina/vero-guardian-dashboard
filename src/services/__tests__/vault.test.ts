import {
  EnvVaultStore,
  MemoryVaultStore,
  Vault,
  createHardwareBackedProvider,
  createSoftwareProviderForTests,
  getVaultEnvName,
} from '@/services/vault';

const { getVaultSecretStatus } = require('@/services/vault-node') as {
  getVaultSecretStatus: (
    name: string,
    env?: Record<string, string | undefined>,
  ) => {
    configured: boolean;
    hardwareBacked: boolean;
    rawSecretPresent: boolean;
    warning?: string;
  };
};

const RELAYER_SECRET_NAME = 'STELLAR_SECRET_KEY';
const RELAYER_SECRET = 'SRELAYERSECRETKEY';
const HARDWARE_KEY = Buffer.from('0123456789abcdef0123456789abcdef');

function createTestHardwareProvider() {
  return createHardwareBackedProvider('windows-dpapi-test-provider', async () => HARDWARE_KEY);
}

describe('Vault', () => {
  it('stores encrypted records and retrieves keys through an ephemeral callback', async () => {
    const store = new MemoryVaultStore();
    const vault = new Vault({
      store,
      keyProvider: createTestHardwareProvider(),
    });

    const record = await vault.putSecret(RELAYER_SECRET_NAME, RELAYER_SECRET);
    let callbackBuffer: Buffer | undefined;

    const retrieved = await vault.withSecret(RELAYER_SECRET_NAME, (secret) => {
      callbackBuffer = secret;
      return secret.toString('utf8');
    });

    expect(retrieved).toBe(RELAYER_SECRET);
    expect(JSON.stringify(record)).not.toContain(RELAYER_SECRET);
    expect(record.hardwareBacked).toBe(true);
    expect(callbackBuffer?.every((byte) => byte === 0)).toBe(true);
  });

  it('rejects software key providers unless explicitly allowed for tests', () => {
    expect(
      () =>
        new Vault({
          store: new MemoryVaultStore(),
          keyProvider: createSoftwareProviderForTests('software-only'),
        }),
    ).toThrow('Vault key provider must be hardware-backed');
  });

  it('can read encrypted records from env without storing the raw key in env', async () => {
    const provider = createTestHardwareProvider();
    const writer = new Vault({
      store: new MemoryVaultStore(),
      keyProvider: provider,
    });
    const record = await writer.putSecret('GITHUB_TOKEN', 'ghp_encrypted_only');

    const envStore = new EnvVaultStore({
      [getVaultEnvName('GITHUB_TOKEN')]: JSON.stringify(record),
    });
    const reader = new Vault({
      store: envStore,
      keyProvider: provider,
    });

    await expect(
      reader.withSecret('GITHUB_TOKEN', (secret) => secret.toString('utf8')),
    ).resolves.toBe('ghp_encrypted_only');
  });

  it('reports relayer vault status without accepting raw env secrets', () => {
    const status = getVaultSecretStatus(RELAYER_SECRET_NAME, {
      STELLAR_SECRET_KEY: RELAYER_SECRET,
      [getVaultEnvName(RELAYER_SECRET_NAME)]: '{"ciphertext":"redacted"}',
      RELAYER_VAULT_HARDWARE_BACKED: 'true',
    });

    expect(status).toEqual({
      configured: true,
      hardwareBacked: true,
      rawSecretPresent: true,
      warning: expect.stringContaining('raw environment secret'),
    });
  });
});
