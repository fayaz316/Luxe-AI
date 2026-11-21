// SPDX-License-Identifier: Apache-2.0

import type { VaultRecord } from './schema.js';

/**
 * The platform's Web Crypto API, resolved structurally from `globalThis.crypto`
 * so the types hold under both @types/node and the DOM lib without importing
 * environment-specific type definitions.
 */
type WebCryptoApi = typeof globalThis.crypto;

/** A Web Crypto key; identical to the platform's `CryptoKey`. */
export type VaultCryptoKey = Parameters<WebCryptoApi['subtle']['encrypt']>[1];

/** Envelope format version emitted by this module. */
const ENVELOPE_VERSION = 1;

/** AES-GCM key size in bits for the master key and every data-encryption key. */
const KEY_LENGTH_BITS = 256;

/** Expected DEK size in bytes (AES-256). */
const DEK_LENGTH_BYTES = 32;

/** GCM nonce size in bytes (96 bits, the NIST-recommended length). */
const IV_LENGTH_BYTES = 12;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const BASE64_INDEX: ReadonlyMap<string, number> = new Map<string, number>(
  Array.from(BASE64_ALPHABET, (character, index) => [character, index] as const),
);

const RECORD_KINDS: ReadonlySet<VaultRecord['kind']> = new Set<VaultRecord['kind']>([
  'client.profile',
  'taste.graph',
  'collection.item',
  'interaction',
  'consent',
]);

/** Failure classification for envelope operations. */
export type VaultErrorCode =
  /** An integrity check failed: the envelope or its key material was modified. */
  | 'TAMPER'
  /** The envelope is structurally invalid and cannot be interpreted. */
  | 'FORMAT';

/**
 * Error thrown by all vault-sdk operations on failure. The `code` property
 * distinguishes integrity failures (`TAMPER`) from malformed input (`FORMAT`).
 */
export class VaultError extends Error {
  readonly code: VaultErrorCode;

  constructor(code: VaultErrorCode, message: string) {
    super(message);
    this.name = 'VaultError';
    this.code = code;
  }
}

/**
 * Opaque encrypted record as stored by brand systems. All binary fields are
 * base64-encoded. Envelopes are JSON-serializable and reveal only the format
 * version, envelope id, record kind, and last-updated timestamp; every other
 * field is ciphertext.
 */
export interface Envelope {
  /** Envelope format version. */
  v: 1;
  /** Random envelope identifier (UUID); bound into the record's AAD. */
  id: string;
  /** Record kind; bound into the record's AAD. */
  kind: VaultRecord['kind'];
  /** Last-updated timestamp copied from the sealed record. */
  updatedAt: string;
  alg: 'A256GCM';
  /** Base64 GCM nonce for the record ciphertext. */
  iv: string;
  /** Base64 DEK wrapped with the client's master key. */
  wrappedDek: string;
  /** Base64 GCM nonce used while wrapping the DEK. */
  dekIv: string;
  /** Base64 record ciphertext, including the appended 128-bit GCM tag. */
  ciphertext: string;
}

function webcrypto(): WebCryptoApi {
  const implementation = (globalThis as { crypto?: WebCryptoApi }).crypto;
  if (implementation === undefined) {
    throw new VaultError(
      'FORMAT',
      'The Web Crypto API (globalThis.crypto) is not available in this environment; Node.js 20+ or a modern browser is required.',
    );
  }
  return implementation;
}

function randomBytes(length: number): Uint8Array {
  return webcrypto().getRandomValues(new Uint8Array(length));
}

function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const byte0 = bytes[offset]!;
    const byte1 = offset + 1 < bytes.length ? bytes[offset + 1]! : 0;
    const byte2 = offset + 2 < bytes.length ? bytes[offset + 2]! : 0;
    output += BASE64_ALPHABET.charAt(byte0 >> 2);
    output += BASE64_ALPHABET.charAt(((byte0 & 0x03) << 4) | (byte1 >> 4));
    output +=
      offset + 1 < bytes.length ? BASE64_ALPHABET.charAt(((byte1 & 0x0f) << 2) | (byte2 >> 6)) : '=';
    output += offset + 2 < bytes.length ? BASE64_ALPHABET.charAt(byte2 & 0x3f) : '=';
  }
  return output;
}

function base64ToBytes(encoded: string, fieldName: string): Uint8Array {
  const withoutPadding = encoded.replace(/=+$/, '');
  if (withoutPadding.length % 4 === 1) {
    throw new VaultError('FORMAT', `Envelope field '${fieldName}' is not valid base64.`);
  }
  const bytes: number[] = [];
  let accumulator = 0;
  let accumulatorBits = 0;
  for (const character of withoutPadding) {
    const sextet = BASE64_INDEX.get(character);
    if (sextet === undefined) {
      throw new VaultError('FORMAT', `Envelope field '${fieldName}' is not valid base64.`);
    }
    accumulator = (accumulator << 6) | sextet;
    accumulatorBits += 6;
    if (accumulatorBits >= 8) {
      accumulatorBits -= 8;
      bytes.push((accumulator >> accumulatorBits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

/** Additional authenticated data binding a record to its envelope id and kind. */
function recordAad(envelopeId: string, kind: VaultRecord['kind']): Uint8Array {
  return textEncoder.encode(`${envelopeId}:${kind}`);
}

async function generateAesKey(): Promise<VaultCryptoKey> {
  return webcrypto().subtle.generateKey(
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    true,
    ['encrypt', 'decrypt'],
  );
}

async function importAesKey(raw: Uint8Array | ArrayBuffer): Promise<VaultCryptoKey> {
  try {
    return await webcrypto().subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, [
      'encrypt',
      'decrypt',
    ]);
  } catch {
    throw new VaultError('FORMAT', 'Key material is not a valid AES-256 key.');
  }
}

function assertWellFormedEnvelope(envelope: Envelope): void {
  if (envelope.v !== ENVELOPE_VERSION) {
    throw new VaultError('FORMAT', `Unsupported envelope version: ${String(envelope.v)}.`);
  }
  if (envelope.alg !== 'A256GCM') {
    throw new VaultError('FORMAT', `Unsupported envelope algorithm: ${String(envelope.alg)}.`);
  }
  if (!RECORD_KINDS.has(envelope.kind)) {
    throw new VaultError('FORMAT', `Unknown record kind: ${String(envelope.kind)}.`);
  }
  const stringFields = ['id', 'updatedAt', 'iv', 'wrappedDek', 'dekIv', 'ciphertext'] as const;
  for (const field of stringFields) {
    const value = envelope[field];
    if (typeof value !== 'string' || value.length === 0) {
      throw new VaultError('FORMAT', `Envelope field '${field}' must be a non-empty string.`);
    }
  }
}

function isVaultRecordLike(value: unknown): value is VaultRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record['kind'] === 'string' &&
    typeof record['id'] === 'string' &&
    typeof record['updatedAt'] === 'string' &&
    'data' in record
  );
}

/**
 * Generates a new 256-bit AES-GCM master key. The key is generated on the
 * client device and must never leave it except through the client's own
 * secure-storage backup path (see {@link exportMasterKey}).
 */
export async function generateMasterKey(): Promise<VaultCryptoKey> {
  return generateAesKey();
}

/**
 * Exports a master key as the base64 encoding of its raw 32 bytes.
 *
 * The returned string grants full access to every envelope sealed under the
 * key. It must only be handled by the client device's secure storage (OS
 * keychain, secure enclave, or an equivalent user-controlled mechanism) and
 * must never be transmitted to lux or to any brand's systems.
 */
export async function exportMasterKey(key: VaultCryptoKey): Promise<string> {
  const raw = await webcrypto().subtle.exportKey('raw', key);
  return bytesToBase64(new Uint8Array(raw));
}

/**
 * Restores a master key previously exported with {@link exportMasterKey}.
 * Throws {@link VaultError} with code `FORMAT` if the input is not a valid
 * base64-encoded 256-bit key.
 */
export async function importMasterKey(base64: string): Promise<VaultCryptoKey> {
  const raw = base64ToBytes(base64, 'masterKey');
  if (raw.byteLength !== DEK_LENGTH_BYTES) {
    throw new VaultError('FORMAT', 'Master key must be exactly 256 bits of base64-encoded data.');
  }
  return importAesKey(raw);
}

/**
 * Seals a record into an opaque envelope using envelope encryption.
 *
 * A fresh 256-bit AES-GCM data-encryption key (DEK) is generated for this
 * record only; the JSON-serialized record is encrypted with the DEK using
 * additionalData = UTF-8 of `${envelopeId}:${kind}`, and the raw DEK is then
 * wrapped with the master key under a separate nonce. The envelope id is a
 * random UUID stored in `envelope.id` so {@link openRecord} can recompute the
 * additionalData.
 */
export async function sealRecord(masterKey: VaultCryptoKey, record: VaultRecord): Promise<Envelope> {
  const envelopeId = webcrypto().randomUUID();
  const dek = await generateAesKey();
  const rawDek = new Uint8Array(await webcrypto().subtle.exportKey('raw', dek));

  const iv = randomBytes(IV_LENGTH_BYTES);
  const plaintext = textEncoder.encode(JSON.stringify(record));
  const ciphertext = await webcrypto().subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: recordAad(envelopeId, record.kind) },
    dek,
    plaintext,
  );

  const dekIv = randomBytes(IV_LENGTH_BYTES);
  const wrappedDek = await webcrypto().subtle.encrypt({ name: 'AES-GCM', iv: dekIv }, masterKey, rawDek);

  return {
    v: ENVELOPE_VERSION,
    id: envelopeId,
    kind: record.kind,
    updatedAt: record.updatedAt,
    alg: 'A256GCM',
    iv: bytesToBase64(iv),
    wrappedDek: bytesToBase64(new Uint8Array(wrappedDek)),
    dekIv: bytesToBase64(dekIv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Opens an envelope back into its record: unwraps the DEK with the master
 * key, decrypts the ciphertext with the recomputed additionalData, and parses
 * the JSON payload.
 *
 * Throws {@link VaultError} with code `TAMPER` when any integrity check fails
 * (modified ciphertext, wrapped key, envelope id, or kind, or a mismatched
 * master key) and code `FORMAT` when the envelope is structurally invalid.
 */
export async function openRecord(masterKey: VaultCryptoKey, envelope: Envelope): Promise<VaultRecord> {
  assertWellFormedEnvelope(envelope);

  const iv = base64ToBytes(envelope.iv, 'iv');
  const dekIv = base64ToBytes(envelope.dekIv, 'dekIv');
  const wrappedDek = base64ToBytes(envelope.wrappedDek, 'wrappedDek');
  const ciphertext = base64ToBytes(envelope.ciphertext, 'ciphertext');

  let rawDek: ArrayBuffer;
  try {
    rawDek = await webcrypto().subtle.decrypt({ name: 'AES-GCM', iv: dekIv }, masterKey, wrappedDek);
  } catch {
    throw new VaultError('TAMPER', 'Failed to unwrap the data-encryption key.');
  }
  if (rawDek.byteLength !== DEK_LENGTH_BYTES) {
    throw new VaultError('FORMAT', 'Unwrapped data-encryption key is not 256 bits.');
  }
  const dek = await importAesKey(rawDek);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await webcrypto().subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: recordAad(envelope.id, envelope.kind) },
      dek,
      ciphertext,
    );
  } catch {
    throw new VaultError(
      'TAMPER',
      'Failed to decrypt the record: the ciphertext, envelope id, or kind does not match its authentication tag.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textDecoder.decode(plaintext));
  } catch {
    throw new VaultError('FORMAT', 'Decrypted payload is not valid JSON.');
  }

  if (!isVaultRecordLike(parsed) || parsed.kind !== envelope.kind) {
    throw new VaultError('FORMAT', 'Decrypted payload is not a record matching the envelope kind.');
  }
  return parsed;
}
