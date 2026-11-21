// SPDX-License-Identifier: Apache-2.0
// Fictional demonstration data.
import type { Store } from './store.js';
import type { Client, Interaction } from './types.js';

function daysAgo(days: number, hourUtc = 12): string {
  const date = new Date();
  date.setUTCHours(hourUtc, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

/**
 * Seeds the in-memory store with the fictional client base of "Maison Verre",
 * a demonstration hotel and dining property: three clients with taste
 * profiles and interaction history. The most recent record is an inbound
 * WhatsApp message asking about a table this weekend, which sets up the
 * draft-approve demo flow. All people, contacts, and events are invented.
 */
export async function seedDemoData(store: Store): Promise<Client[]> {
  const amara = await store.createClient({
    displayName: 'Amara Laurent',
    email: 'amara.laurent@example.test',
    phone: '+41 79 555 01 01',
    language: 'fr',
    timezone: 'Europe/Paris',
    notes: 'Prefers the salon privé; shellfish allergy on file.',
    taste: {
      preferredBrands: ['Hermès', 'Céline', 'Chanel'],
      sizes: { 'ready-to-wear': '34 FR', footwear: '37 EU' },
      interests: ['contemporary art', 'Burgundy wines', 'equestrian sport'],
    },
  });

  const kenji = await store.createClient({
    displayName: 'Kenji Watanabe',
    email: 'k.watanabe@example.test',
    phone: '+81 90 5555 01 02',
    language: 'ja',
    timezone: 'Asia/Tokyo',
    notes: 'Values discretion; prefers written follow-ups in English.',
    taste: {
      preferredBrands: ['Cartier', 'Berluti'],
      sizes: { footwear: '27 JP', shirt: '37 JP' },
      interests: ['single cask whisky', 'contemporary architecture', 'omakase counter dining'],
    },
  });

  const sofia = await store.createClient({
    displayName: 'Sofia Marchetti',
    email: 'sofia.marchetti@example.test',
    phone: '+39 335 555 01 03',
    language: 'it',
    timezone: 'Europe/Rome',
    notes: 'Attends the autumn concert series; likes terrace seating in warm weather.',
    taste: {
      preferredBrands: ['Bottega Veneta', 'Loro Piana'],
      sizes: { footwear: '38 EU', outerwear: '42 IT' },
      interests: ['classical music', 'sailing', 'white truffle season'],
    },
  });

  const interactions: Array<Omit<Interaction, 'id'>> = [
    {
      clientId: amara.id,
      at: daysAgo(21, 10),
      channel: 'phone',
      direction: 'inbound',
      summary: 'Called ahead about suite preferences for the December stay; asked for the corner salon suite.',
    },
    {
      clientId: amara.id,
      at: daysAgo(19, 16),
      channel: 'email',
      direction: 'outbound',
      advisorId: 'advisor-01',
      summary: 'Sent the winter tasting menu preview and salon privé availability for December.',
    },
    {
      clientId: amara.id,
      at: daysAgo(12, 9),
      channel: 'email',
      direction: 'inbound',
      summary: 'Thanked the team and asked whether the cellar dinner could be repeated in spring.',
    },
    {
      clientId: amara.id,
      at: daysAgo(2, 20),
      channel: 'whatsapp',
      direction: 'inbound',
      summary: 'Hello — could we have a quiet table for two this Saturday evening? Happy to arrive after the theatre.',
    },
    {
      clientId: kenji.id,
      at: daysAgo(30, 8),
      channel: 'email',
      direction: 'inbound',
      summary: 'Requested a private dining room for a client dinner in the new year.',
    },
    {
      clientId: kenji.id,
      at: daysAgo(27, 14),
      channel: 'phone',
      direction: 'outbound',
      advisorId: 'advisor-02',
      summary: 'Confirmed the chef\u2019s counter for eight guests and arranged a whisky pairing flight.',
    },
    {
      clientId: kenji.id,
      at: daysAgo(20, 11),
      channel: 'whatsapp',
      direction: 'inbound',
      summary: 'The pairing was exceptional. Please pass our thanks to the chef.',
    },
    {
      clientId: kenji.id,
      at: daysAgo(6, 15),
      channel: 'email',
      direction: 'outbound',
      advisorId: 'advisor-02',
      summary: 'Shared the winter cellar release notes and an invitation to the jeweller\u2019s private viewing.',
    },
    {
      clientId: sofia.id,
      at: daysAgo(15, 22),
      channel: 'in-person',
      direction: 'inbound',
      summary: 'Stopped by after the evening concert; asked about the next private cellar dinner.',
    },
    {
      clientId: sofia.id,
      at: daysAgo(13, 12),
      channel: 'whatsapp',
      direction: 'outbound',
      advisorId: 'advisor-03',
      summary: 'Sent the cellar dinner invitation with arrival details and dress guidance.',
    },
    {
      clientId: sofia.id,
      at: daysAgo(9, 17),
      channel: 'phone',
      direction: 'inbound',
      summary: 'Asked for marina and mooring recommendations ahead of the September regatta week.',
    },
  ];

  for (const interaction of interactions) {
    await store.addInteraction(interaction);
  }

  return [amara, kenji, sofia];
}
