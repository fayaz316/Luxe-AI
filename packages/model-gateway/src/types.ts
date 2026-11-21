// SPDX-License-Identifier: Apache-2.0

/** Roles allowed in a chat-style conversation. */
export type ChatRole = 'system' | 'user' | 'assistant';

/** A single conversation turn sent to a model provider. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Provider-independent completion request. */
export interface CompletionRequest {
  /** Instructions that shape tone and behaviour, mapped to provider system prompts. */
  system: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

/** Provider-independent completion result. */
export interface CompletionResult {
  text: string;
  /** Identifier of the provider that produced the completion. */
  providerId: string;
}

/**
 * Common interface implemented by every lux model provider. Consumers depend
 * on this abstraction only, never on a concrete vendor client.
 */
export interface ModelProvider {
  readonly id: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}
