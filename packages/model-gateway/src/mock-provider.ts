// SPDX-License-Identifier: Apache-2.0
import type { CompletionRequest, CompletionResult, ModelProvider } from './types.js';

export const DEFAULT_MOCK_REPLY = 'DRAFT: Acknowledged — draft reply.';

/**
 * A scenario script: when the request's user content matches, the scripted
 * reply is returned instead of the default. Scripts are evaluated in order
 * and the first match wins.
 */
export interface MockScript {
  match: string | RegExp;
  reply: string;
}

/**
 * Deterministic scripted provider for tests and local development. Returns
 * the reply it was constructed with — or the first matching scenario script
 * — and records the most recent request so callers can assert on what was
 * sent.
 */
export class MockProvider implements ModelProvider {
  readonly id = 'mock';

  private readonly reply: string;
  private readonly scripts: readonly MockScript[];
  lastRequest?: CompletionRequest;

  constructor(reply: string = DEFAULT_MOCK_REPLY, scripts: readonly MockScript[] = []) {
    this.reply = reply;
    this.scripts = scripts;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    this.lastRequest = req;
    const userContent = req.messages.map((message) => message.content).join('\n');
    for (const script of this.scripts) {
      const matched =
        typeof script.match === 'string'
          ? userContent.includes(script.match)
          : script.match.test(userContent);
      if (matched) {
        return { text: script.reply, providerId: this.id };
      }
    }
    return { text: this.reply, providerId: this.id };
  }
}
