// SPDX-License-Identifier: Apache-2.0
// Fictional demonstration scenarios. Every string is deliberately short:
// the demo is meant to be felt in seconds, not read.
import { randomUUID } from 'node:crypto';
import { MockProvider, type MockScript } from '@luxe/model-gateway';
import type { Store } from './store.js';
import type { ClientRequest, Draft, RequestStep } from './types.js';

export interface BurstScenario {
  clientPhone: string;
  inbound: string;
  reason: string;
  intent: string;
  match: string;
  reply: string;
}

/** The three demonstration moments, in triage order. */
export const BURST_SCENARIOS: readonly BurstScenario[] = [
  {
    clientPhone: '+41 79 555 01 01',
    inbound: 'Vol retardé — nous arrivons vers minuit.',
    reason: 'Itinéraire modifié — arrivée 00:10',
    intent: 'Vol retardé, arrivée 00:10 — table décalée, suite conservée.',
    match: '00:10',
    reply:
      'Avec plaisir — salon privé samedi, après le théâtre.\nMenu sans fruits de mer pour deux. Votre suite reste prête, quelle que soit l’heure.',
  },
  {
    clientPhone: '+81 90 5555 01 02',
    inbound: 'Friday, quiet table for two. Guest is vegetarian.',
    reason: 'Friday table — guest vegetarian',
    intent: 'Friday, quiet table for two, guest vegetarian.',
    match: 'vegetarian',
    reply:
      'かしこまりました。金曜日、静かな個室をご用意いたします。\nお連れ様のベジタリアン対応も承りました。',
  },
  {
    clientPhone: '+39 335 555 01 03',
    inbound: 'Regatta Saturday: berth, dinner for 8, two cars.',
    reason: 'Regatta Saturday — 4 vendors, 1 reply',
    intent: 'Regatta Saturday: berth, dinner 8 (two vegetarian), two cars dockside.',
    match: 'dockside',
    reply:
      'With pleasure — berth Saturday, dinner for eight (two vegetarian), two cars dockside 08:30.\nOne confirmation from me by morning.',
  },
];

/** Scenario scripts for the deterministic demo provider. */
export function demoMockScripts(): MockScript[] {
  return BURST_SCENARIOS.map((scenario) => ({
    match: scenario.match,
    reply: scenario.reply,
  }));
}

/** The demo provider: scripted where a scenario matches, terse elsewhere. */
export function buildDemoProvider(): MockProvider {
  return new MockProvider('DRAFT: With pleasure — I will confirm the details shortly.', demoMockScripts());
}

/** The cascade the burst opens: one delayed flight, four houses, one word from the guest. */
export function cascadeRequest(clientId: string): ClientRequest {
  const step = (partner: string, action: string, extra: Partial<RequestStep> = {}): RequestStep => ({
    id: randomUUID(),
    partner,
    action,
    state: 'awaiting-your-hand',
    ...extra,
  });
  return {
    id: randomUUID(),
    clientId,
    title: 'Paris, tonight',
    why: 'Vol retardé — she lands at 00:10 instead of 21:20.',
    createdAt: new Date().toISOString(),
    steps: [
      step('the house', 'Hold the corner suite past midnight — away from the street'),
      step('the house', 'Move the table to 22:30, salon privé', {
        channel: 'whatsapp',
        draft:
          'Avec plaisir — salon privé samedi, après le théâtre.\nMenu sans fruits de mer pour deux. Votre suite reste prête, quelle que soit l’heure.',
      }),
      step('transport', 'Re-time the car to the 00:25 arrival'),
      step('the theatre', 'Re-note the will-call for the late curtain'),
    ],
  };
}

/**
 * Simulates the night desk: inbound messages arrive together, a draft is
 * prepared for each in the client's own language, and the arrival cascade
 * opens as a coordinated request. Nothing is sent — approval still gates
 * every reply and every step.
 */
export async function runDemoBurst(store: Store): Promise<{ drafts: Draft[]; requests: ClientRequest[] }> {
  const clients = await store.listClients();
  const drafts: Draft[] = [];
  const requests: ClientRequest[] = [];

  for (const scenario of BURST_SCENARIOS) {
    const client = clients.find(
      (candidate) => candidate.phone?.replace(/[^0-9]/g, '') === scenario.clientPhone.replace(/[^0-9]/g, ''),
    );
    if (client === undefined) continue;

    await store.addInteraction({
      clientId: client.id,
      at: new Date().toISOString(),
      channel: 'whatsapp',
      direction: 'inbound',
      summary: scenario.inbound,
    });

    drafts.push(
      await store.saveDraft({
        id: randomUUID(),
        clientId: client.id,
        channel: 'whatsapp',
        intentHint: scenario.reason,
        text: scenario.reply,
        status: 'pending_approval',
        createdAt: new Date().toISOString(),
      }),
    );

    // The delayed-flight scenario opens the four-house cascade.
    if (scenario.match === '00:10') {
      requests.push(await store.saveRequest(cascadeRequest(client.id)));
    }
  }

  return { drafts, requests };
}
