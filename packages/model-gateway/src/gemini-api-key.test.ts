// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { GeminiApiKeyProvider } from './gemini-api-key.js';
import { ProviderError } from './provider-error.js';

interface CapturedCall {
  url: string;
  init: RequestInit;
}

function stubbedFetch(payload: unknown, status = 200): typeof fetch {
  return async (url, init) => {
    captured = { url: String(url), init: init ?? {} };
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
}

let captured: CapturedCall;

describe('GeminiApiKeyProvider', () => {
  it('POSTs to the model endpoint with the API-key header and parses the response', async () => {
    const provider = new GeminiApiKeyProvider(
      'test-api-key',
      'gemini-2.0-flash',
      stubbedFetch({ candidates: [{ content: { parts: [{ text: 'STUB ' }, { text: 'REPLY' }] } }] }),
    );
    const result = await provider.complete({
      system: 'system prompt',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0.5,
      maxTokens: 64,
    });

    expect(result).toEqual({ text: 'STUB REPLY', providerId: 'gemini-api-key' });
    expect(captured.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
    expect(captured.init.method).toBe('POST');
    const headers = new Headers(captured.init.headers);
    expect(headers.get('x-goog-api-key')).toBe('test-api-key');
    expect(headers.get('content-type')).toBe('application/json');
    const body = JSON.parse(String(captured.init.body)) as {
      systemInstruction: unknown;
      contents: Array<{ role: string }>;
    };
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'system prompt' }] });
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'hello' }] }]);
  });

  it('throws ProviderError on HTTP error statuses', async () => {
    const provider = new GeminiApiKeyProvider('k', 'gemini-2.0-flash', stubbedFetch({ error: 'bad' }, 429));
    await expect(
      provider.complete({ system: 's', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrowError(ProviderError);
  });

  it('throws ProviderError when the response carries no usable text', async () => {
    const provider = new GeminiApiKeyProvider('k', 'gemini-2.0-flash', stubbedFetch({ candidates: [] }));
    await expect(
      provider.complete({ system: 's', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrowError(ProviderError);
  });
});
