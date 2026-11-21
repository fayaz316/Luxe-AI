// SPDX-License-Identifier: Apache-2.0
import { MockProvider } from '@luxe/model-gateway';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { MemoryStore } from './store.js';
import { buildServer } from './service.js';
import type { Client, Draft, Interaction } from './types.js';

const MOCK_REPLY = 'DRAFT: SCRIPTED — thank you for your note; we will confirm the table shortly.';

describe('copilot-api', () => {
  let app: FastifyInstance;
  let store: MemoryStore;
  let provider: MockProvider;

  beforeAll(() => {
    store = new MemoryStore();
    provider = new MockProvider(MOCK_REPLY);
    app = buildServer({ store, provider });
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, service: 'copilot-api', version: '0.1.0' });
  });

  it('rejects client creation without displayName', async () => {
    const res = await app.inject({ method: 'POST', url: '/clients', payload: { language: 'en' } });
    expect(res.statusCode).toBe(400);
  });

  it('creates a client and returns it with its interactions', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/clients',
      payload: {
        displayName: 'Amara Laurent',
        language: 'fr',
        phone: '+41 79 555 01 88',
        taste: { preferredBrands: ['Hermès'], sizes: {}, interests: ['contemporary art'] },
      },
    });
    expect(create.statusCode).toBe(201);
    const client = create.json() as Client;
    expect(client.id).toBeTruthy();
    expect(client.createdAt).toBeTruthy();
    expect(client.taste.preferredBrands).toEqual(['Hermès']);

    const get = await app.inject({ method: 'GET', url: `/clients/${client.id}` });
    expect(get.statusCode).toBe(200);
    const body = get.json() as { client: Client; interactions: Interaction[] };
    expect(body.client.id).toBe(client.id);
    expect(body.interactions).toEqual([]);
  });

  it('drafts, edits, and approves: appends an outbound interaction with the final text', async () => {
    const client = await store.createClient({
      displayName: 'Kenji Watanabe',
      language: 'ja',
      taste: { preferredBrands: ['Cartier'], sizes: { footwear: '27 JP' }, interests: ['whisky'] },
    });
    await store.addInteraction({
      clientId: client.id,
      at: '2026-01-05T10:00:00.000Z',
      channel: 'phone',
      direction: 'inbound',
      summary: 'Asked about a private dining room.',
    });
    await store.addInteraction({
      clientId: client.id,
      at: '2026-01-06T18:00:00.000Z',
      channel: 'whatsapp',
      direction: 'inbound',
      summary: 'Could we have a table this Saturday evening?',
    });

    const draftRes = await app.inject({
      method: 'POST',
      url: '/draft',
      payload: { clientId: client.id, channel: 'whatsapp', intentHint: 'Saturday table request' },
    });
    expect(draftRes.statusCode).toBe(201);
    const draft = draftRes.json() as Draft;
    expect(draft.status).toBe('pending_approval');
    expect(draft.text).toBe(MOCK_REPLY);
    expect(draft.channel).toBe('whatsapp');
    // The prompt carried the client context and interaction history.
    expect(provider.lastRequest?.system).toContain('Never promise table allocation');
    expect(provider.lastRequest?.messages[0]?.content).toContain('Kenji Watanabe');
    expect(provider.lastRequest?.messages[0]?.content).toContain('table this Saturday evening');

    const editedText = `Dear Mr. Watanabe, thank you for your note. ${'We would be delighted to look after your table. '.repeat(8)}`;
    const approveRes = await app.inject({
      method: 'POST',
      url: `/drafts/${draft.id}/approve`,
      payload: { text: editedText },
    });
    expect(approveRes.statusCode).toBe(200);
    const approved = approveRes.json() as Draft;
    expect(approved.status).toBe('approved');
    expect(approved.text).toBe(editedText);
    expect(approved.approvedAt).toBeTruthy();

    const get = await app.inject({ method: 'GET', url: `/clients/${client.id}` });
    const { interactions } = get.json() as { client: Client; interactions: Interaction[] };
    expect(interactions).toHaveLength(3);
    const outbound = interactions.at(-1);
    expect(outbound?.direction).toBe('outbound');
    expect(outbound?.channel).toBe('whatsapp');
    expect(outbound?.summary.startsWith('Dear Mr. Watanabe, thank you for your note.')).toBe(true);
    expect(outbound?.summary.length).toBe(280); // truncated for the summary log
  });

  it('approves without edited text, using the drafted body', async () => {
    const client = await store.createClient({
      displayName: 'Sofia Marchetti',
      language: 'it',
      taste: { preferredBrands: [], sizes: {}, interests: [] },
    });
    const draftRes = await app.inject({
      method: 'POST',
      url: '/draft',
      payload: { clientId: client.id, channel: 'email' },
    });
    const draft = draftRes.json() as Draft;
    const approveRes = await app.inject({ method: 'POST', url: `/drafts/${draft.id}/approve`, payload: {} });
    const approved = approveRes.json() as Draft;
    expect(approved.status).toBe('approved');
    expect(approved.text).toBe(MOCK_REPLY);
  });

  it('rejects a pending draft without creating an interaction', async () => {
    const client = await store.createClient({
      displayName: 'Test Client',
      language: 'en',
      taste: { preferredBrands: [], sizes: {}, interests: [] },
    });
    const draftRes = await app.inject({
      method: 'POST',
      url: '/draft',
      payload: { clientId: client.id, channel: 'phone' },
    });
    const draft = draftRes.json() as Draft;
    const rejectRes = await app.inject({ method: 'POST', url: `/drafts/${draft.id}/reject` });
    expect(rejectRes.statusCode).toBe(200);
    expect((rejectRes.json() as Draft).status).toBe('rejected');
    // A rejected draft cannot be approved afterwards (approval-first guard).
    const approveAfter = await app.inject({ method: 'POST', url: `/drafts/${draft.id}/approve` });
    expect(approveAfter.statusCode).toBe(409);

    const get = await app.inject({ method: 'GET', url: `/clients/${client.id}` });
    const { interactions } = get.json() as { interactions: Interaction[] };
    expect(interactions).toHaveLength(0);
  });

  it('lists drafts for a client, newest first', async () => {
    const client = await store.createClient({
      displayName: 'Ordering Client',
      language: 'en',
      taste: { preferredBrands: [], sizes: {}, interests: [] },
    });
    await store.saveDraft({
      id: 'draft-older',
      clientId: client.id,
      channel: 'email',
      text: 'older draft',
      status: 'pending_approval',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await store.saveDraft({
      id: 'draft-newer',
      clientId: client.id,
      channel: 'whatsapp',
      text: 'newer draft',
      status: 'pending_approval',
      createdAt: '2026-02-01T00:00:00.000Z',
    });
    const res = await app.inject({ method: 'GET', url: `/drafts?clientId=${client.id}` });
    expect(res.statusCode).toBe(200);
    const drafts = res.json() as Draft[];
    expect(drafts.map((d) => d.id)).toEqual(['draft-newer', 'draft-older']);

    const missing = await app.inject({ method: 'GET', url: '/drafts' });
    expect(missing.statusCode).toBe(400);
  });

  it('returns 404 when drafting for an unknown client', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/draft',
      payload: { clientId: 'does-not-exist', channel: 'email' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('echoes the WhatsApp verification challenge', async () => {
    const ok = await app.inject({
      method: 'GET',
      url: '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=luxe-dev-verify&hub.challenge=challenge-42',
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toBe('challenge-42');

    const wrongToken = await app.inject({
      method: 'GET',
      url: '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=x',
    });
    expect(wrongToken.statusCode).toBe(403);
  });

  it('records inbound WhatsApp messages from known numbers and always acknowledges', async () => {
    const client = await store.createClient({
      displayName: 'Amara Laurent',
      language: 'fr',
      phone: '+41 79 555 01 01',
      taste: { preferredBrands: [], sizes: {}, interests: [] },
    });
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '1234567890',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '41795550100', phone_number_id: '9876' },
                contacts: [{ profile: { name: 'Amara' }, wa_id: '41795550101' }],
                messages: [
                  {
                    from: '+41 79 555 01 01',
                    id: 'wamid.DEMO',
                    timestamp: '1763640000',
                    type: 'text',
                    text: { body: 'Could we have a table this Saturday evening?' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const res = await app.inject({ method: 'POST', url: '/webhook/whatsapp', payload });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ received: true });

    const get = await app.inject({ method: 'GET', url: `/clients/${client.id}` });
    const { interactions } = get.json() as { interactions: Interaction[] };
    expect(interactions).toHaveLength(1);
    expect(interactions[0]?.direction).toBe('inbound');
    expect(interactions[0]?.channel).toBe('whatsapp');
    expect(interactions[0]?.summary).toBe('Could we have a table this Saturday evening?');
    expect(interactions[0]?.at).toBe('2025-11-20T12:00:00.000Z');

    // Unknown numbers and status updates never create interactions, but are still acknowledged.
    const unknown = await app.inject({
      method: 'POST',
      url: '/webhook/whatsapp',
      payload: {
        entry: [{ changes: [{ value: { messages: [{ from: '+999000111', type: 'text', text: { body: 'hi' } }] } }] }],
      },
    });
    expect(unknown.statusCode).toBe(200);
    expect(unknown.json()).toEqual({ received: true });
    const statuses = await app.inject({
      method: 'POST',
      url: '/webhook/whatsapp',
      payload: { entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'read' }] } }] }] },
    });
    expect(statuses.statusCode).toBe(200);
    const after = await app.inject({ method: 'GET', url: `/clients/${client.id}` });
    expect(((after.json() as { interactions: Interaction[] }).interactions)).toHaveLength(1);
  });
});

describe('copilot-api with an API key', () => {
  const KEY = 'test-shared-secret';
  let app: FastifyInstance;

  beforeAll(() => {
    app = buildServer({
      store: new MemoryStore(),
      provider: new MockProvider('DRAFT: key-auth test reply'),
      apiKey: KEY,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects requests without a key with 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/clients' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'unauthorized' });
  });

  it('rejects a wrong key with 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/clients', headers: { 'x-api-key': 'wrong' } });
    expect(res.statusCode).toBe(401);
  });

  it('accepts the correct key', async () => {
    const res = await app.inject({ method: 'GET', url: '/clients', headers: { 'x-api-key': KEY } });
    expect(res.statusCode).toBe(200);
  });

  it('keeps the health check reachable without a key', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('keeps the WhatsApp webhook exempt: verification and inbound', async () => {
    const verify = await app.inject({
      method: 'GET',
      url: '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=luxe-dev-verify&hub.challenge=c1',
    });
    expect(verify.statusCode).toBe(200);

    const inbound = await app.inject({
      method: 'POST',
      url: '/webhook/whatsapp',
      payload: { entry: [{ changes: [{ value: { messages: [] } }] }] },
    });
    expect(inbound.statusCode).toBe(200);
  });

  it('enforces the key on the approval endpoints', async () => {
    const unauthenticated = await app.inject({ method: 'POST', url: '/drafts/any/approve', payload: {} });
    expect(unauthenticated.statusCode).toBe(401);
  });
});
