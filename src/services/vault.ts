import {
  type CipherGCM,
  type CipherGCMTypes,
  type DecipherGCM,
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export type VaultRecord = {
  version: 1;
  algorithm: 'AES-256-GCM';
  keyId: string;
  hardwareBacked: boolean;
  iv: string;
  authTag: string;
  ciphertext: string;
  createdAt: string;
};

export type VaultKeyProvider = {
  id: string;
  hardwareBacked: boolean;
  getKeyMaterial(): Promise<Buffer | Uint8Array | string>;
};

export type VaultStore = {
  get(name: string): Promise<VaultRecord | undefined>;
  set?(name: string, record: VaultRecord): Promise<void>;
};

type VaultOptions = {
  store: VaultStore;
  keyProvider: VaultKeyProvider;
  allowSoftwareProvider?: boolean;
};

const VAULT_VERSION = 1;
const ALGORITHM = 'AES-256-GCM';
const CIPHER_ALGORITHM: CipherGCMTypes = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const SECRET_NAME_PATTERN = /^[a-zA-Z0-9_.:-]{1,128}$/;

export class MemoryVaultStore implements VaultStore {
  private readonly records = new Map<string, VaultRecord>();

  async get(name: string): Promise<VaultRecord | undefined> {
    const record = this.records.get(assertSecretName(name));
    return record ? cloneRecord(record) : undefined;
  }

  async set(name: string, record: VaultRecord): Promise<void> {
    this.records.set(assertSecretName(name), cloneRecord(record));
  }
}

export class EnvVaultStore implements VaultStore {
  constructor(private readonly env: Record<string, string | undefined> = process.env) {}

  async get(name: string): Promise<VaultRecord | undefined> {
    const envName = getVaultEnvName(name);
    const rawRecord = this.env[envName];

    if (!rawRecord) {
      return undefined;
    }

    return parseVaultRecord(rawRecord, envName);
  }
}

export class Vault {
  private readonly encryptedRecordCache = new Map<string, VaultRecord>();

  constructor(private readonly options: VaultOptions) {
    if (!options.keyProvider.hardwareBacked && !options.allowSoftwareProvider) {
      throw new Error('Vault key provider must be hardware-backed');
    }
  }

  async putSecret(name: string, secret: string | Buffer | Uint8Array): Promise<VaultRecord> {
    const normalizedName = assertSecretName(name);

    if (!this.options.store.set) {
      throw new Error('Vault store is read-only');
    }

    const secretBytes = toBuffer(secret);
    const iv = randomBytes(IV_LENGTH_BYTES);
    const key = await this.getCipherKey();

    try {
      const cipher = createCipheriv(CIPHER_ALGORITHM, key, iv) as CipherGCM;
      cipher.setAAD(getAdditionalAuthenticatedData(normalizedName, this.options.keyProvider.id));

      const ciphertext = Buffer.concat([cipher.update(secretBytes), cipher.final()]);
      const record: VaultRecord = {
        version: VAULT_VERSION,
        algorithm: ALGORITHM,
        keyId: this.options.keyProvider.id,
        hardwareBacked: this.options.keyProvider.hardwareBacked,
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
        ciphertext: ciphertext.toString('base64'),
        createdAt: new Date().toISOString(),
      };

      await this.options.store.set(normalizedName, record);
      this.encryptedRecordCache.set(normalizedName, cloneRecord(record));
      return cloneRecord(record);
    } finally {
      secretBytes.fill(0);
      key.fill(0);
    }
  }

  async hasSecret(name: string): Promise<boolean> {
    return Boolean(await this.getRecord(name));
  }

  async getMetadata(name: string): Promise<Omit<VaultRecord, 'ciphertext' | 'authTag'> | undefined> {
    const record = await this.getRecord(name);

    if (!record) {
      return undefined;
    }

    const { ciphertext: _ciphertext, authTag: _authTag, ...metadata } = record;
    return metadata;
  }

  async withSecret<T>(
    name: string,
    callback: (secret: Buffer) => T | Promise<T>,
  ): Promise<T> {
    const normalizedName = assertSecretName(name);
    const record = await this.getRecord(normalizedName);

    if (!record) {
      throw new Error(`Vault secret "${normalizedName}" was not found`);
    }

    if (!safeEqual(record.keyId, this.options.keyProvider.id)) {
      throw new Error(`Vault secret "${normalizedName}" was encrypted with a different key provider`);
    }

    const key = await this.getCipherKey();
    const plaintext = decryptRecord(record, normalizedName, key);

    try {
      return await callback(plaintext);
    } finally {
      plaintext.fill(0);
      key.fill(0);
    }
  }

  private async getRecord(name: string): Promise<VaultRecord | undefined> {
    const normalizedName = assertSecretName(name);
    const cached = this.encryptedRecordCache.get(normalizedName);

    if (cached) {
      return cloneRecord(cached);
    }

    const record = await this.options.store.get(normalizedName);

    if (record) {
      this.encryptedRecordCache.set(normalizedName, cloneRecord(record));
      return cloneRecord(record);
    }

    return undefined;
  }

  private async getCipherKey(): Promise<Buffer> {
    const material = toBuffer(await this.options.keyProvider.getKeyMaterial());
    try {
      return material.length === KEY_LENGTH_BYTES
        ? Buffer.from(material)
        : createHash('sha256').update(material).digest();
    } finally {
      material.fill(0);
    }
  }
}

export function getVaultEnvName(name: string): string {
  return `RELAYER_VAULT_${assertSecretName(name).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
}

export function createHardwareBackedProvider(
  id: string,
  getKeyMaterial: VaultKeyProvider['getKeyMaterial'],
): VaultKeyProvider {
  return {
    id,
    hardwareBacked: true,
    getKeyMaterial,
  };
}

export function createSoftwareProviderForTests(
  keyMaterial: Buffer | Uint8Array | string,
): VaultKeyProvider {
  return {
    id: 'test-software-provider',
    hardwareBacked: false,
    async getKeyMaterial() {
      return toBuffer(keyMaterial);
    },
  };
}

function decryptRecord(record: VaultRecord, name: string, key: Buffer): Buffer {
  if (record.version !== VAULT_VERSION || record.algorithm !== ALGORITHM) {
    throw new Error('Unsupported vault record format');
  }

  const decipher = createDecipheriv(
    CIPHER_ALGORITHM,
    key,
    Buffer.from(record.iv, 'base64'),
  ) as DecipherGCM;
  decipher.setAAD(getAdditionalAuthenticatedData(name, record.keyId));
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, 'base64')),
    decipher.final(),
  ]);
}

function parseVaultRecord(rawRecord: string, envName: string): VaultRecord {
  try {
    return JSON.parse(rawRecord) as VaultRecord;
  } catch {
    throw new Error(`${envName} does not contain a valid vault record`);
  }
}

function assertSecretName(name: string): string {
  const normalizedName = name.trim();

  if (!SECRET_NAME_PATTERN.test(normalizedName)) {
    throw new Error('Vault secret name contains unsupported characters');
  }

  return normalizedName;
}

function getAdditionalAuthenticatedData(name: string, keyId: string): Buffer {
  return Buffer.from(`vero-vault:${name}:${keyId}`, 'utf8');
}

function cloneRecord(record: VaultRecord): VaultRecord {
  return { ...record };
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function toBuffer(value: Buffer | Uint8Array | string): Buffer {
  if (Buffer.isBuffer(value)) {
    return Buffer.from(value);
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  return Buffer.from(value, 'utf8');
}
