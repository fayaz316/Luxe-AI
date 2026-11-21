// SPDX-License-Identifier: Apache-2.0

export type FetchImpl = typeof fetch;

export interface ApiCallOptions {
  baseUrl: string;
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  fetchImpl: FetchImpl;
  /** Optional shared secret forwarded as x-api-key (COPILOT_API_KEY on the server). */
  apiKey?: string;
}

export async function apiCall(options: ApiCallOptions): Promise<unknown> {
  const { baseUrl, path, method = "GET", body, fetchImpl, apiKey } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (apiKey !== undefined && apiKey !== "") headers["x-api-key"] = apiKey;

  const response = await fetchImpl(`${baseUrl}${path}`, {
    method,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let payload: unknown = undefined;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : text;
    throw new Error(`copilot-api ${response.status} on ${method} ${path}: ${detail}`);
  }

  return payload;
}
