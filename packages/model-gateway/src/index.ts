// SPDX-License-Identifier: Apache-2.0
import { GeminiApiKeyProvider } from './gemini-api-key.js';
import { MockProvider } from './mock-provider.js';
import type { ModelProvider } from './types.js';
import { VertexGeminiProvider } from './vertex.js';

export * from './types.js';
export { ProviderError } from './provider-error.js';
export { buildGeminiRequestBody, extractGeminiText } from './gemini-protocol.js';
export type { GeminiContent, GeminiGenerateContentBody, GeminiPart } from './gemini-protocol.js';
export { GeminiApiKeyProvider } from './gemini-api-key.js';
export { MockProvider, DEFAULT_MOCK_REPLY, type MockScript } from './mock-provider.js';
export { VertexGeminiProvider } from './vertex.js';
export type { GoogleAuthLike, VertexGeminiOptions } from './vertex.js';

/**
 * Selects a provider from environment variables, in priority order:
 *  1. GEMINI_API_KEY              -> GeminiApiKeyProvider (Google AI Studio)
 *  2. GOOGLE_PROJECT(_ID)         -> VertexGeminiProvider (GOOGLE_APPLICATION_CREDENTIALS or implied ADC)
 *  3. otherwise                   -> MockProvider (deterministic scripted reply)
 */
export function resolveProvider(env: Record<string, string | undefined>): ModelProvider {
  if (env.GEMINI_API_KEY) {
    return new GeminiApiKeyProvider(env.GEMINI_API_KEY);
  }
  const projectId = env.GOOGLE_PROJECT ?? env.GOOGLE_PROJECT_ID;
  if (projectId) {
    // Credentials are read from GOOGLE_APPLICATION_CREDENTIALS when present,
    // otherwise from ambient Application Default Credentials.
    return new VertexGeminiProvider({ projectId });
  }
  return new MockProvider();
}
