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
});
