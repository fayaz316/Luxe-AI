// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import {
  exportMasterKey,
  generateMasterKey,
  importMasterKey,
  openRecord,
  sealRecord,
  VaultError,
  type Envelope,
  type VaultCryptoKey,
} from './crypto.js';
import type { VaultRecord } from './schema.js';

const sampleRecords: VaultRecord[] = [
  {
    kind: 'client.profile',
    id: 'profile-1',
    updatedAt: '2026-01-15T10:00:00.000Z',
    data: {
      id: 'profile-1',
      displayName: 'Amara Rothschild-Miyazaki',
      email: 'amara.rotshchild@example.com',
      phone: '+41 79 555 01 02',
      language: 'fr',
      timezone: 'Europe/Zurich',
      notes: 'Prefers evening appointments; never call before 10am.',
    },
  },
  {
    kind: 'taste.graph',
    id: 'taste-1',
    updatedAt: '2026-01-16T08:30:00.000Z',
    data: {
      preferredBrands: ['Hermès', 'Bottega Veneta'],
      avoidedBrands: ['Fastline'],
      sizes: { readyToWear: 'IT 48', shoe: 'EU 42' },
      aesthetics: ['quiet luxury', 'artisanal'],
      interests: ['contemporary art', 'sailing'],
    },
  },
  {
    kind: 'collection.item',
    id: 'item-1',
    updatedAt: '2026-02-01T12:00:00.000Z',
    data: {
      id: 'item-1',
      category: 'watches',
      brand: 'A. Lange & Söhne',
      description: 'Platinum Datograph perpetual, bought in Geneva',
      acquiredAt: '2025-11-02',
      provenance: ['Geneva boutique', 'Original owner'],
    },
  },
  {
    kind: 'interaction',
    id: 'interaction-1',
    updatedAt: '2026-02-03T09:15:00.000Z',
    data: {
      id: 'interaction-1',
      at: '2026-02-03T09:00:00.000Z',
      channel: 'whatsapp',
      direction: 'inbound',
      summary: 'Asked about a restock of the navy cashmere coat.',
      advisorId: 'advisor-7',
    },
  },
  {
    kind: 'consent',
    id: 'consent-1',
    updatedAt: '2026-01-15T10:00:00.000Z',
    data: {
      id: 'consent-1',
      at: '2026-01-15T10:00:00.000Z',
      scope: ['memory', 'personalization'],
      granted: true,
    },
  },
];

/** Replaces the first character so the string stays valid base64 but decodes to different bytes. */
function flipFirstCharacter(value: string): string {
  const first = value.charAt(0);
  return (first === 'A' ? 'B' : 'A') + value.slice(1);
}

/** Runs openRecord expecting a VaultError and returns it. */
async function openExpectingError(masterKey: VaultCryptoKey, envelope: Envelope): Promise<VaultError> {
  let thrown: unknown;
  try {
    await openRecord(masterKey, envelope);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(VaultError);
  return thrown as VaultError;
}

describe('sealRecord / openRecord', () => {
  it('round-trips a record of every kind', async () => {
    const masterKey = await generateMasterKey();
    for (const record of sampleRecords) {
      const envelope = await sealRecord(masterKey, record);
      expect(envelope.v).toBe(1);
      expect(envelope.alg).toBe('A256GCM');
      expect(envelope.kind).toBe(record.kind);
      expect(envelope.id).toMatch(/^[0-9a-f-]{36}$/);
      const opened = await openRecord(masterKey, envelope);
      expect(opened).toEqual(record);
    }
  });

  it('exposes no plaintext field values on the envelope', async () => {
    const masterKey = await generateMasterKey();
    const envelope = await sealRecord(masterKey, sampleRecords[0]!);
    const serialized = JSON.stringify(envelope);
    const sensitiveValues = [
      'Amara Rothschild-Miyazaki',
      'amara.rotshchild@example.com',
      '+41 79 555 01 02',
      'Europe/Zurich',
      'Prefers evening appointments; never call before 10am.',
    ];
    for (const value of sensitiveValues) {
      expect(serialized.includes(value)).toBe(false);
    }
  });

  it('uses a fresh DEK, nonce, and envelope id for every seal of the same record', async () => {
    const masterKey = await generateMasterKey();
    const record = sampleRecords[2]!;
    const first = await sealRecord(masterKey, record);
    const second = await sealRecord(masterKey, record);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.wrappedDek).not.toBe(second.wrappedDek);
    expect(first.dekIv).not.toBe(second.dekIv);
    expect(first.id).not.toBe(second.id);
  });

  it('throws TAMPER when the ciphertext is flipped or truncated', async () => {
    const masterKey = await generateMasterKey();
    const envelope = await sealRecord(masterKey, sampleRecords[0]!);

    const flipped: Envelope = { ...envelope, ciphertext: flipFirstCharacter(envelope.ciphertext) };
    expect((await openExpectingError(masterKey, flipped)).code).toBe('TAMPER');

    const truncated: Envelope = { ...envelope, ciphertext: envelope.ciphertext.slice(0, -4) };
    expect((await openExpectingError(masterKey, truncated)).code).toBe('TAMPER');
  });

  it('throws TAMPER when the wrapped DEK is modified', async () => {
    const masterKey = await generateMasterKey();
    const envelope = await sealRecord(masterKey, sampleRecords[1]!);
    const corrupted: Envelope = { ...envelope, wrappedDek: flipFirstCharacter(envelope.wrappedDek) };
    expect((await openExpectingError(masterKey, corrupted)).code).toBe('TAMPER');
  });

  it('throws TAMPER when the envelope id or kind is swapped (AAD binding)', async () => {
    const masterKey = await generateMasterKey();
    const envelope = await sealRecord(masterKey, sampleRecords[0]!);

    const withSwappedId: Envelope = { ...envelope, id: crypto.randomUUID() };
    expect((await openExpectingError(masterKey, withSwappedId)).code).toBe('TAMPER');

    const withSwappedKind: Envelope = { ...envelope, kind: 'consent' };
    expect((await openExpectingError(masterKey, withSwappedKind)).code).toBe('TAMPER');
  });

  it('throws TAMPER when the master key does not match', async () => {
    const masterKey = await generateMasterKey();
    const envelope = await sealRecord(masterKey, sampleRecords[3]!);
    const wrongKey = await generateMasterKey();
    expect((await openExpectingError(wrongKey, envelope)).code).toBe('TAMPER');
  });

  it('throws FORMAT for structurally invalid envelopes', async () => {
    const masterKey = await generateMasterKey();
    const envelope = await sealRecord(masterKey, sampleRecords[0]!);

    const badVersion = { ...envelope, v: 2 } as unknown as Envelope;
    expect((await openExpectingError(masterKey, badVersion)).code).toBe('FORMAT');

    const badAlgorithm = { ...envelope, alg: 'A128GCM' } as unknown as Envelope;
    expect((await openExpectingError(masterKey, badAlgorithm)).code).toBe('FORMAT');

    const badBase64: Envelope = { ...envelope, iv: 'not*base64!' };
    expect((await openExpectingError(masterKey, badBase64)).code).toBe('FORMAT');

    const missingField = { ...envelope } as Partial<Envelope>;
    delete missingField['ciphertext'];
    expect((await openExpectingError(masterKey, missingField as Envelope)).code).toBe('FORMAT');
  });
});

describe('master key export / import', () => {
  it('round-trips an exported master key and opens envelopes sealed before export', async () => {
    const masterKey = await generateMasterKey();
    const record = sampleRecords[3]!;
    const envelope = await sealRecord(masterKey, record);

    const exported = await exportMasterKey(masterKey);
    expect(exported).toMatch(/^[A-Za-z0-9+/]{43}=$/);

    const reimported = await importMasterKey(exported);
    const opened = await openRecord(reimported, envelope);
    expect(opened).toEqual(record);
  });

  it('throws FORMAT for malformed master key material', async () => {
    await expect(importMasterKey('not-a-key')).rejects.toBeInstanceOf(VaultError);
    await expect(importMasterKey('AAAA')).rejects.toMatchObject({ code: 'FORMAT' });
  });
});
