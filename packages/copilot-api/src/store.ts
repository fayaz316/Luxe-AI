// SPDX-License-Identifier: Apache-2.0
import { randomUUID } from 'node:crypto';
import type { Client, Draft, Interaction } from './types.js';

/** Persistence contract for copilot data; implemented by MemoryStore and FirestoreStore. */
export interface Store {
  listClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(input: Omit<Client, 'id' | 'createdAt'>): Promise<Client>;
  addInteraction(input: Omit<Interaction, 'id'>): Promise<Interaction>;
  listInteractions(clientId: string): Promise<Interaction[]>;
  listDrafts(clientId: string): Promise<Draft[]>;
  saveDraft(draft: Draft): Promise<Draft>;
  getDraft(id: string): Promise<Draft | undefined>;
  updateDraft(draft: Draft): Promise<Draft>;
}

/**
 * In-memory Store used for local development, tests, and demo deployments.
 * All data is lost when the process exits.
 */
export class MemoryStore implements Store {
  private readonly clients = new Map<string, Client>();
  private readonly interactions = new Map<string, Interaction>();
  private readonly drafts = new Map<string, Draft>();

  async listClients(): Promise<Client[]> {
    return [...this.clients.values()];
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async createClient(input: Omit<Client, 'id' | 'createdAt'>): Promise<Client> {
    const client: Client = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    this.clients.set(client.id, client);
    return client;
  }

  async addInteraction(input: Omit<Interaction, 'id'>): Promise<Interaction> {
    const interaction: Interaction = { ...input, id: randomUUID() };
    this.interactions.set(interaction.id, interaction);
    return interaction;
  }

  async listInteractions(clientId: string): Promise<Interaction[]> {
    return [...this.interactions.values()].filter((interaction) => interaction.clientId === clientId);
  }

  async listDrafts(clientId: string): Promise<Draft[]> {
    return [...this.drafts.values()].filter((draft) => draft.clientId === clientId);
  }

  async saveDraft(draft: Draft): Promise<Draft> {
    this.drafts.set(draft.id, draft);
    return draft;
  }

  async getDraft(id: string): Promise<Draft | undefined> {
    return this.drafts.get(id);
  }

  async updateDraft(draft: Draft): Promise<Draft> {
    if (!this.drafts.has(draft.id)) {
      throw new Error(`draft not found: ${draft.id}`);
    }
    this.drafts.set(draft.id, draft);
    return draft;
  }
}

/**
 * Minimal structural subset of the Firestore API this store relies on; any
 * @google-cloud/firestore `Firestore` instance satisfies it.
 */
export interface FirestoreLike {
  collection(name: string): FirestoreCollectionLike;
}

interface FirestoreCollectionLike {
  doc(id?: string): FirestoreDocumentLike;
  get(): Promise<FirestoreQuerySnapshotLike>;
}

interface FirestoreDocumentLike {
  get(): Promise<FirestoreDocumentSnapshotLike>;
  set(data: unknown): Promise<unknown>;
}

interface FirestoreDocumentSnapshotLike {
  readonly exists: boolean;
  data(): unknown;
}

interface FirestoreQuerySnapshotLike {
  readonly docs: readonly FirestoreDocumentSnapshotLike[];
}

/**
 * Production Store backed by Firestore, used when FIRESTORE_PROJECT is set.
 * Deliberately small: plain get/set against the `clients`, `interactions`,
 * and `drafts` collections, with client-side filtering instead of composite
 * queries. Documents are stored whole, keyed by the luxe entity id.
 */
export class FirestoreStore implements Store {
  private readonly firestore: FirestoreLike;

  constructor(firestoreInstance: FirestoreLike) {
    this.firestore = firestoreInstance;
  }

  private collection(name: 'clients' | 'interactions' | 'drafts'): FirestoreCollectionLike {
    return this.firestore.collection(name);
  }

  async listClients(): Promise<Client[]> {
    const snapshot = await this.collection('clients').get();
    return snapshot.docs.map((doc) => doc.data() as Client);
  }

  async getClient(id: string): Promise<Client | undefined> {
    const snapshot = await this.collection('clients').doc(id).get();
    return snapshot.exists ? (snapshot.data() as Client) : undefined;
  }

  async createClient(input: Omit<Client, 'id' | 'createdAt'>): Promise<Client> {
    const client: Client = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    await this.collection('clients').doc(client.id).set(client);
    return client;
  }

  async addInteraction(input: Omit<Interaction, 'id'>): Promise<Interaction> {
    const interaction: Interaction = { ...input, id: randomUUID() };
    await this.collection('interactions').doc(interaction.id).set(interaction);
    return interaction;
  }

  async listInteractions(clientId: string): Promise<Interaction[]> {
    const snapshot = await this.collection('interactions').get();
    return snapshot.docs
      .map((doc) => doc.data() as Interaction)
      .filter((interaction) => interaction.clientId === clientId);
  }

  async listDrafts(clientId: string): Promise<Draft[]> {
    const snapshot = await this.collection('drafts').get();
    return snapshot.docs
      .map((doc) => doc.data() as Draft)
      .filter((draft) => draft.clientId === clientId);
  }

  async saveDraft(draft: Draft): Promise<Draft> {
    await this.collection('drafts').doc(draft.id).set(draft);
    return draft;
  }

  async getDraft(id: string): Promise<Draft | undefined> {
    const snapshot = await this.collection('drafts').doc(id).get();
    return snapshot.exists ? (snapshot.data() as Draft) : undefined;
  }

  async updateDraft(draft: Draft): Promise<Draft> {
    await this.collection('drafts').doc(draft.id).set(draft);
    return draft;
  }
}
