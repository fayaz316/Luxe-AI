// SPDX-License-Identifier: Apache-2.0
import { buildGeminiRequestBody, extractGeminiText } from './gemini-protocol.js';
import { ProviderError } from './provider-error.js';
import type { CompletionRequest, CompletionResult, ModelProvider } from './types.js';

const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

/** Minimal GoogleAuth surface this provider relies on. */
export interface GoogleAuthLike {
  getAccessToken(): Promise<string | null | undefined>;
}

interface GoogleAuthModule {
  GoogleAuth: new (options: { scopes: string[] }) => GoogleAuthLike;
}

export interface VertexGeminiOptions {
  projectId: string;
  location?: string;
  model?: string;
  /** Pre-configured auth client; when omitted, Application Default Credentials are used. */
  auth?: GoogleAuthLike;
}

/**
 * Loads google-auth-library lazily so deployments that only use API-key mode
 * do not pay for it, and a missing or broken installation surfaces as a clear
 * ProviderError instead of an import crash.
 */
async function createDefaultAuth(): Promise<GoogleAuthLike> {
  try {
    const googleAuthLibrary = (await import('google-auth-library')) as unknown as GoogleAuthModule;
    return new googleAuthLibrary.GoogleAuth({ scopes: [CLOUD_PLATFORM_SCOPE] });
  } catch {
    throw new ProviderError('vertex credentials unavailable');
  }
}

/**
 * Gemini provider for Vertex AI (service account or Application Default
 * Credentials via google-auth-library). Requests carry a Bearer access token
 * and use the same generateContent body as the API-key provider.
 */
export class VertexGeminiProvider implements ModelProvider {
  readonly id = 'vertex-gemini';

  private readonly projectId: string;
  private readonly location: string;
  private readonly model: string;
  private readonly auth?: GoogleAuthLike;
  private defaultAuth?: Promise<GoogleAuthLike>;

  constructor(options: VertexGeminiOptions) {
    this.projectId = options.projectId;
    this.location = options.location ?? 'us-central1';
    this.model = options.model ?? 'gemini-2.0-flash';
    this.auth = options.auth;
  }

  private resolveAuth(): Promise<GoogleAuthLike> {
    if (this.auth) {
      return Promise.resolve(this.auth);
    }
    this.defaultAuth ??= createDefaultAuth();
    return this.defaultAuth;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const auth = await this.resolveAuth();
    let accessToken: string | null | undefined;
    try {
      accessToken = await auth.getAccessToken();
    } catch {
      throw new ProviderError('vertex credentials unavailable');
    }
    if (!accessToken) {
      throw new ProviderError('vertex credentials unavailable');
    }
    const url =
      `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}` +
      `/locations/${this.location}/publishers/google/models/${this.model}:generateContent`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(buildGeminiRequestBody(req)),
      });
    } catch (err) {
      throw new ProviderError(`vertex request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!response.ok) {
      throw new ProviderError(`vertex responded with status ${response.status}`);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ProviderError('vertex returned a non-JSON response');
    }
    return { text: extractGeminiText(payload), providerId: this.id };
  }
}
