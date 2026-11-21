// SPDX-License-Identifier: Apache-2.0
import { ProviderError } from './provider-error.js';
import type { CompletionRequest } from './types.js';

/**
 * Wire types for the Gemini generateContent protocol. The Google AI Studio
 * (API key) and Vertex AI endpoints share the same request and response
 * shape, so both providers map through this module.
 */
export interface GeminiPart {
  text?: string;
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiGenerateContentBody {
  systemInstruction: { parts: GeminiPart[] };
  contents: GeminiContent[];
  generationConfig: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
}

/**
 * Maps a provider-independent completion request onto the Gemini
 * generateContent body: the system prompt becomes systemInstruction, the
 * conversation becomes contents (assistant turns map to the Gemini "model"
 * role), and sampling options map to generationConfig.
 */
export function buildGeminiRequestBody(req: CompletionRequest): GeminiGenerateContentBody {
  const generationConfig: GeminiGenerateContentBody['generationConfig'] = {};
  if (req.temperature !== undefined) {
    generationConfig.temperature = req.temperature;
  }
  if (req.maxTokens !== undefined) {
    generationConfig.maxOutputTokens = req.maxTokens;
  }
  return {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: req.messages.map((message) => ({
      role: message.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: message.content }],
    })),
    generationConfig,
  };
}

/**
 * Joins the text parts of the first candidate. Throws ProviderError when the
 * response carries no usable text (empty candidate list, missing content, or
 * parts without text).
 */
export function extractGeminiText(response: unknown): string {
  const candidates = (response as GeminiGenerateContentResponse | null | undefined)?.candidates;
  const parts = candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
  if (text.length === 0) {
    throw new ProviderError('model returned no usable text');
  }
  return text;
}
