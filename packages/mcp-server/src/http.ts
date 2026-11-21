// SPDX-License-Identifier: Apache-2.0

export type FetchImpl = typeof fetch;

export interface ApiCallOptions {
  baseUrl: string;
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  fetchImpl: FetchImpl;
}

export async function apiCall(options: ApiCallOptions): Promise<unknown> {
  const { baseUrl, path, method = "GET", body, fetchImpl } = options;

  const response = await fetchImpl(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
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
