// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { buildGeminiRequestBody, extractGeminiText } from './gemini-protocol.js';
import { ProviderError } from './provider-error.js';
import type { CompletionRequest } from './types.js';

describe('buildGeminiRequestBody', () => {
  it('maps the system prompt to systemInstruction and conversation to contents', () => {
    const request: CompletionRequest = {
      system: 'You draft client replies.',
      messages: [
        { role: 'user', content: 'first question' },
        { role: 'assistant', content: 'earlier reply' },
        { role: 'user', content: 'follow-up' },
      ],
      temperature: 0.3,
      maxTokens: 128,
    };
    expect(buildGeminiRequestBody(request)).toEqual({
      systemInstruction: { parts: [{ text: 'You draft client replies.' }] },
      contents: [
        { role: 'user', parts: [{ text: 'first question' }] },
        { role: 'model', parts: [{ text: 'earlier reply' }] },
        { role: 'user', parts: [{ text: 'follow-up' }] },
      ],
      generationConfig: { temperature: 0.3, maxOutputTokens: 128 },
    });
  });

  it('omits sampling options that are not provided', () => {
    const body = buildGeminiRequestBody({ system: 's', messages: [{ role: 'user', content: 'hi' }] });
    expect(body.generationConfig).toEqual({});
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }]);
  });
});

describe('extractGeminiText', () => {
  it('joins the text parts of the first candidate, skipping non-text parts', () => {
    const response = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Dear ' }, { inlineData: { mimeType: 'image/png' } }, { text: 'guest' }],
          },
        },
        { content: { parts: [{ text: 'second candidate ignored' }] } },
      ],
    };
    expect(extractGeminiText(response)).toBe('Dear guest');
  });

  it('throws ProviderError when no usable text is present', () => {
    expect(() => extractGeminiText({})).toThrowError(ProviderError);
    expect(() => extractGeminiText({ candidates: [] })).toThrowError(ProviderError);
    expect(() => extractGeminiText({ candidates: [{ content: { parts: [{ text: '   ' }] } }] })).toThrowError(
      ProviderError,
    );
  });
});
