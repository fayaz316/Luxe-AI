# ADR 0002: Client vault ciphertext-only

- Status: Accepted
- Date: 2026-11-21

## Context

A client's luxury profile — preferences, sizing, collection, interaction history — describes purchasing power, taste, and personal life in detail. If stored systems or the platform operator could read vault records, the client's memory would in practice belong to whoever operates the storage. Charter commitment 2 requires that this not be possible, for the platform operator and for brands alike.

## Decision

`packages/vault-sdk` implements envelope encryption that runs entirely client-side. Each record is encrypted with its own data encryption key using AES-GCM, with the record identifier and kind bound as additional authenticated data. The data key is wrapped by the client's master key, which never leaves the client's control. Stored systems receive and hold ciphertext and wrapped keys only; no server-side decryption path exists.

## Consequences

- Key recovery is the client's burden in v0.1; a lost master key is a lost vault.
- The v0.2 client companion must implement zero-data personalization: brands receive answers derived on the client's device, never the records themselves.
- The platform cannot assist in vault data recovery, even at the client's request, because it never holds the keys.
