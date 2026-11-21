// SPDX-License-Identifier: Apache-2.0

/**
 * Core identity and contact data for a single client of the Vault.
 */
export interface ClientProfile {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  /** ISO 639-1 language code preferred by the client. */
  language: string;
  /** IANA time zone name, e.g. "Europe/Paris". */
  timezone?: string;
  /** Free-form notes owned by the client, never by a brand. */
  notes?: string;
}

/**
 * Structured expression of a client's tastes used to personalize service.
 */
export interface TasteGraph {
  preferredBrands: string[];
  avoidedBrands?: string[];
  /** Measurement or sizing labels keyed by dimension, e.g. { shoe: "EU 42" }. */
  sizes: Record<string, string>;
  aesthetics: string[];
  interests: string[];
}

/**
 * A single item in a client's collection of possessions or experiences.
 */
export interface CollectionItem {
  id: string;
  /** Open vocabulary: known categories are listed, others are allowed. */
  category: 'fashion' | 'watches' | 'jewelry' | 'art' | 'automotive' | 'hospitality' | string;
  brand?: string;
  description: string;
  /** ISO 8601 date (YYYY-MM-DD) on which the item was acquired. */
  acquiredAt?: string;
  /** Chain of custody entries, oldest first. */
  provenance?: string[];
}

/**
 * A single inbound or outbound touchpoint between a client and an advisor.
 */
export interface Interaction {
  id: string;
  /** ISO 8601 timestamp of the interaction. */
  at: string;
  /** Open vocabulary: known channels are listed, others are allowed. */
  channel: 'whatsapp' | 'email' | 'phone' | 'in-person' | string;
  direction: 'inbound' | 'outbound';
  summary: string;
  /** Identifier of the advisor involved, scoped to the brand's systems. */
  advisorId?: string;
}

/**
 * A consent decision made by the client at a point in time.
 */
export interface ConsentRecord {
  id: string;
  /** ISO 8601 timestamp of the decision. */
  at: string;
  /** Purposes the decision applies to. */
  scope: ('memory' | 'personalization' | 'messaging')[];
  granted: boolean;
}

/**
 * A client-owned record stored in the Vault, discriminated by `kind`.
 * Every variant carries the record id, a last-updated timestamp, and the
 * kind-specific payload under `data`.
 */
export type VaultRecord =
  | { kind: 'client.profile'; id: string; updatedAt: string; data: ClientProfile }
  | { kind: 'taste.graph'; id: string; updatedAt: string; data: TasteGraph }
  | { kind: 'collection.item'; id: string; updatedAt: string; data: CollectionItem }
  | { kind: 'interaction'; id: string; updatedAt: string; data: Interaction }
  | { kind: 'consent'; id: string; updatedAt: string; data: ConsentRecord };

/** Discriminator values used by the {@link VaultRecord} union. */
export type VaultRecordKind = VaultRecord['kind'];
