// SPDX-License-Identifier: Apache-2.0
import type { CompletionRequest, CompletionResult, ModelProvider } from './types.js';

export const DEFAULT_MOCK_REPLY = 'DRAFT: Acknowledged — draft reply.';

/**
 * Deterministic scripted provider for tests and local development. Returns
 * the reply it was constructed with and records the most recent request so
 * callers can assert on what was sent.
 */
export class MockProvider implements ModelProvider {
  readonly id = 'mock';

  private readonly reply: string;
  lastRequest?: CompletionRequest;

  constructor(reply: string = DEFAULT_MOCK_REPLY) {
    this.reply = reply;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    this.lastRequest = req;
    return { text: this.reply, providerId: this.id };
  }
}
