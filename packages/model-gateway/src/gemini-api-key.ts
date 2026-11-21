// SPDX-License-Identifier: Apache-2.0
import { buildGeminiRequestBody, extractGeminiText } from './gemini-protocol.js';
import { ProviderError } from './provider-error.js';
import type { CompletionRequest, CompletionResult, ModelProvider } from './types.js';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Gemini provider using a Google AI Studio API key. The key is sent in the
 * x-goog-api-key header and never appears in the URL or request body.
 */
export class GeminiApiKeyProvider implements ModelProvider {
  readonly id = 'gemini-api-key';

  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(apiKey: string, model: string = 'gemini-2.0-flash', fetchImpl: typeof fetch = globalThis.fetch) {
    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const url = `${API_ROOT}/${this.model}:generateContent`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(buildGeminiRequestBody(req)),
      });
    } catch (err) {
      throw new ProviderError(`gemini api request failed: ${errorMessage(err)}`);
    }
    if (!response.ok) {
      throw new ProviderError(`gemini api responded with status ${response.status}`);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ProviderError('gemini api returned a non-JSON response');
    }
    return { text: extractGeminiText(payload), providerId: this.id };
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
