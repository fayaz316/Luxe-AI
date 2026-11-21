// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { copilotTools } from "./tools.js";
import type { FetchImpl } from "./http.js";

function stubFetch(routes: Array<{ match: (url: string, method: string) => boolean; status?: number; body: unknown }>): FetchImpl {
  const impl: FetchImpl = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? "GET";
    for (const route of routes) {
      if (route.match(url, method)) {
        return new Response(JSON.stringify(route.body), {
          status: route.status ?? 200,
          headers: { "content-type": "application/json" },
        });
      }
    }
    throw new Error(`no stub route for ${method} ${url}`);
  };
  return impl;
}

const API = "http://localhost:8080";

describe("copilotTools", () => {
  it("lists clients", async () => {
    const fetchImpl = stubFetch([
      { match: (url, method) => url === `${API}/clients` && method === "GET", body: [{ id: "c1", displayName: "Amara Laurent", language: "en" }] },
    ]);
    const tools = copilotTools({ apiUrl: API, fetchImpl });
    const listClients = tools.find((t) => t.name === "list_clients");
    if (!listClients) throw new Error("list_clients tool missing");

    const result = (await listClients.run({})) as Array<{ id: string }>;
    expect(result.length).toBe(1);
    expect(result[0]?.id).toBe("c1");
  });

  it("creates a draft with pending_approval status", async () => {
    const fetchImpl = stubFetch([
      {
        match: (url, method) => url === `${API}/draft` && method === "POST",
        body: { id: "d1", clientId: "c1", channel: "whatsapp", text: "Drafted reply", status: "pending_approval" },
      },
    ]);
    const tools = copilotTools({ apiUrl: API, fetchImpl });
    const createDraft = tools.find((t) => t.name === "create_draft");
    if (!createDraft) throw new Error("create_draft tool missing");

    const result = (await createDraft.run({ clientId: "c1", channel: "whatsapp", intentHint: "Saturday table" })) as {
      status: string;
    };
    expect(result.status).toBe("pending_approval");
  });

  it("approves a draft with edited text", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const impl: FetchImpl = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? "GET";
      let body: unknown = undefined;
      if (init?.body) body = JSON.parse(String(init.body));
      calls.push({ url, method, body });
      return new Response(JSON.stringify({ id: "d1", status: "approved" }), { status: 200 });
    };
    const tools = copilotTools({ apiUrl: API, fetchImpl: impl });
    const approve = tools.find((t) => t.name === "approve_draft");
    if (!approve) throw new Error("approve_draft tool missing");

    const result = (await approve.run({ draftId: "d1", text: "Edited final text" })) as { status: string };
    expect(result.status).toBe("approved");
    expect(calls[0]?.url).toBe(`${API}/drafts/d1/approve`);
    expect(calls[0]?.body).toEqual({ text: "Edited final text" });
  });

  it("surfaces API errors as tool failures", async () => {
    const fetchImpl = stubFetch([
      { match: (url) => url === `${API}/clients/nope`, status: 404, body: { message: "client not found" } },
    ]);
    const tools = copilotTools({ apiUrl: API, fetchImpl });
    const getClient = tools.find((t) => t.name === "get_client");
    if (!getClient) throw new Error("get_client tool missing");

    await expect(getClient.run({ id: "nope" })).rejects.toThrow(/404.*client not found/);
  });

  it("exposes exactly the five advisor tools", () => {
    const tools = copilotTools({ apiUrl: API });
    expect(tools.map((t) => t.name).sort()).toEqual([
      "approve_draft",
      "create_draft",
      "get_client",
      "list_clients",
      "reject_draft",
    ]);
  });
});
