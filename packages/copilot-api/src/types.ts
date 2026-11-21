// SPDX-License-Identifier: Apache-2.0

export type InteractionChannel = 'whatsapp' | 'email' | 'phone' | 'in-person';

export type InteractionDirection = 'inbound' | 'outbound';

export type DraftStatus = 'pending_approval' | 'approved' | 'rejected';

/** Brand-side record of a client of the property. */
export interface ClientTaste {
  preferredBrands: string[];
  sizes: Record<string, string>;
  interests: string[];
}

export interface Client {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  language: string;
  timezone?: string;
  notes?: string;
  taste: ClientTaste;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** A single logged touchpoint with a client. */
export interface Interaction {
  id: string;
  clientId: string;
  /** ISO 8601 timestamp. */
  at: string;
  channel: InteractionChannel;
  direction: InteractionDirection;
  summary: string;
  advisorId?: string;
}

/**
 * A drafted client communication. Drafts are created with status
 * `pending_approval` and only ever leave that state through the explicit
 * approve/reject endpoints.
 */
export interface Draft {
  id: string;
  clientId: string;
  channel: InteractionChannel;
  intentHint?: string;
  text: string;
  status: DraftStatus;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** ISO 8601 timestamp; set when the advisor approves the draft. */
  approvedAt?: string;
}
