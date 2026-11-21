// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { GeminiApiKeyProvider } from './gemini-api-key.js';
import { MockProvider } from './mock-provider.js';
import { resolveProvider } from './index.js';
import { VertexGeminiProvider } from './vertex.js';

describe('resolveProvider', () => {
  it('prefers the API-key provider when GEMINI_API_KEY is set', () => {
    const provider = resolveProvider({ GEMINI_API_KEY: 'key', GOOGLE_PROJECT: 'proj' });
    expect(provider).toBeInstanceOf(GeminiApiKeyProvider);
  });

  it('selects the Vertex provider from GOOGLE_PROJECT or GOOGLE_PROJECT_ID', () => {
    expect(resolveProvider({ GOOGLE_PROJECT: 'proj' })).toBeInstanceOf(VertexGeminiProvider);
    expect(
      resolveProvider({ GOOGLE_PROJECT_ID: 'proj', GOOGLE_APPLICATION_CREDENTIALS: '/svc/account.json' }),
    ).toBeInstanceOf(VertexGeminiProvider);
  });

  it('falls back to the deterministic mock provider', () => {
    expect(resolveProvider({})).toBeInstanceOf(MockProvider);
    expect(resolveProvider({ GOOGLE_APPLICATION_CREDENTIALS: '/svc/account.json' })).toBeInstanceOf(MockProvider);
  });
});
