// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { DEFAULT_MOCK_REPLY, MockProvider } from './mock-provider.js';
import type { CompletionRequest } from './types.js';

describe('MockProvider', () => {
  it('returns the scripted reply and a stable provider id', async () => {
    const provider = new MockProvider('SCRIPTED REPLY');
    const result = await provider.complete({
      system: 'system prompt',
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(result.text).toBe('SCRIPTED REPLY');
    expect(result.providerId).toBe('mock');
    expect(provider.id).toBe('mock');
  });

  it('falls back to the default reply', async () => {
    const provider = new MockProvider();
    const result = await provider.complete({ system: 's', messages: [] });
    expect(result.text).toBe(DEFAULT_MOCK_REPLY);
    expect(DEFAULT_MOCK_REPLY).toBe('DRAFT: Acknowledged — draft reply.');
  });

  it('records the most recent request for assertions', async () => {
    const provider = new MockProvider();
    const request: CompletionRequest = {
      system: 'system prompt',
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'second' },
      ],
      temperature: 0.4,
      maxTokens: 32,
    };
    await provider.complete(request);
    expect(provider.lastRequest).toEqual(request);
  });

  it('returns the first matching scenario script', async () => {
    const provider = new MockProvider('FALLBACK', [
      { match: 'dockside', reply: 'CHECKLIST REPLY' },
      { match: 'vegetarian', reply: 'COUNTER REPLY' },
    ]);
    const checklist = await provider.complete({
      system: 's',
      messages: [{ role: 'user', content: 'Regatta Saturday: berth, dinner 8, two cars dockside.' }],
    });
    expect(checklist.text).toBe('CHECKLIST REPLY');

    const counter = await provider.complete({
      system: 's',
      messages: [{ role: 'user', content: 'Friday, quiet table, guest vegetarian.' }],
    });
    expect(counter.text).toBe('COUNTER REPLY');
  });

  it('falls back when no scenario script matches', async () => {
    const provider = new MockProvider('FALLBACK', [{ match: /00:10/, reply: 'MATCHED' }]);
    const result = await provider.complete({
      system: 's',
      messages: [{ role: 'user', content: 'unrelated request' }],
    });
    expect(result.text).toBe('FALLBACK');
  });
});
