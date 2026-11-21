# @lux/vault-sdk

Cryptographic core of the lux client-intelligence platform. The vault-sdk defines and protects the Vault: client-owned, end-to-end encrypted profile records covering identity, taste, collection, interactions, and consent. Brand systems store sealed Vault records as opaque ciphertext and can never read them.

- Zero runtime dependencies — only the Web Crypto API (`globalThis.crypto`), available in Node.js 20+ and all modern browsers.
- TypeScript-first, strict mode, ESM only.

## Security model

The Vault is zero-knowledge for everyone except the client:

- **Client-held master key.** A 256-bit AES-GCM key generated on the client device is the only key that can unlock the Vault. Neither lux nor any brand system ever receives it. Losing it means losing the data — that is the point.
- **Per-record data keys (envelope encryption).** Every `sealRecord` call generates a fresh 256-bit AES-GCM data-encryption key (DEK) for that single record. The record is encrypted with the DEK, and the DEK is wrapped with the master key under its own nonce. Sealed records share no cryptographic material, so compromise of one envelope cannot cascade, and master-key rotation only requires re-wrapping DEKs.
- **AAD binding.** The envelope id (a random UUID) and the record kind are authenticated as additional authenticated data over the record ciphertext. Re-labeling an envelope, swapping it for another, or replaying it under a different id or kind fails authentication and throws a `VaultError` with code `TAMPER`.
- **Integrity failures are explicit.** Any modification of the ciphertext, wrapped key, envelope id, or kind — or use of the wrong master key — surfaces as `VaultError` code `TAMPER`; structurally invalid input surfaces as `VaultError` code `FORMAT`.

The full threat model, including trust boundaries and residual risks, lives in [`docs/THREAT-MODEL.md`](../../docs/THREAT-MODEL.md).

## Installation

Inside the lux monorepo:

```sh
pnpm add @lux/vault-sdk
```

## Usage

```ts
import {
  generateMasterKey,
  exportMasterKey,
  importMasterKey,
  sealRecord,
  openRecord,
  type VaultRecord,
  type Envelope,
} from '@lux/vault-sdk';

// 1. On the client device: create the master key and back it up in secure storage.
const masterKey = await generateMasterKey();
const backup = await exportMasterKey(masterKey);
// `backup` is base64 of the raw key bytes. Hand it ONLY to the client's
// secure storage (OS keychain, secure enclave, printed recovery phrase...).
// It must never be sent to lux or to a brand.
const restored = await importMasterKey(backup);

// 2. Seal a record; the result is an opaque Envelope the brand can store.
const record: VaultRecord = {
  kind: 'collection.item',
  id: 'item-1',
  updatedAt: new Date().toISOString(),
  data: {
    id: 'item-1',
    category: 'watches',
    brand: 'A. Lange & Söhne',
    description: 'Platinum Datograph perpetual',
    acquiredAt: '2025-11-02',
  },
};

const envelope: Envelope = await sealRecord(masterKey, record);
await brandBackend.put(`vault/${envelope.id}`, JSON.stringify(envelope));

// 3. Later, on the client device, open it back.
const stored = JSON.parse(await brandBackend.get(`vault/${envelope.id}`)) as Envelope;
const opened: VaultRecord = await openRecord(masterKey, stored);
console.log(opened.data.brand); // "A. Lange & Söhne"
```

An `Envelope` is a plain JSON object (`v`, `id`, `kind`, `updatedAt`, `alg`, `iv`, `wrappedDek`, `dekIv`, `ciphertext`); binary fields are base64 strings. `kind` and `updatedAt` are visible to storage systems for indexing, everything else is ciphertext.

## API

| Export | Description |
| --- | --- |
| `generateMasterKey()` | Generates a 256-bit AES-GCM master key (`VaultCryptoKey`, extractable for client-side backup). |
| `exportMasterKey(key)` | Returns the raw key bytes as base64 for the client's secure storage only. |
| `importMasterKey(base64)` | Restores a master key from its base64 export. |
| `sealRecord(masterKey, record)` | Envelope-encrypts a `VaultRecord`: fresh per-record DEK, AAD-bound AES-GCM. |
| `openRecord(masterKey, envelope)` | Verifies, decrypts, and parses an `Envelope` back into a `VaultRecord`. |
| `VaultRecord`, `ClientProfile`, `TasteGraph`, `CollectionItem`, `Interaction`, `ConsentRecord`, `Envelope`, `VaultCryptoKey`, `VaultError` | Types and the typed error class (`code: 'TAMPER' \| 'FORMAT'`). `VaultCryptoKey` is an alias of the platform's Web Crypto `CryptoKey`, valid in both browsers and Node.js. |

## Development

```sh
pnpm build      # tsc -p tsconfig.json (emits dist/)
pnpm typecheck  # tsc --noEmit
pnpm test       # vitest run
```

## License

Apache-2.0. See the repository [LICENSE](../../LICENSE). Every source file carries an `SPDX-License-Identifier: Apache-2.0` header.
