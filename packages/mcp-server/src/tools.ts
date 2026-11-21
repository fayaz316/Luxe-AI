// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";
import { apiCall, type FetchImpl } from "./http.js";

export interface CopilotToolsOptions {
  apiUrl: string;
  fetchImpl?: FetchImpl;
}

export interface ToolDef {
  name: string;
  description: string;
  shape: Record<string, z.ZodTypeAny>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

interface ClientSummary {
  id: string;
  displayName: string;
  language: string;
}

interface DraftSummary {
  id: string;
  clientId: string;
  channel: string;
  text: string;
  status: string;
}

/**
 * Advisor tool surface over the copilot API. The approval gate is preserved:
 * `approve_draft` is the explicit human approval required before any
 * outbound communication is recorded.
 */
export function copilotTools(options: CopilotToolsOptions): ToolDef[] {
  const { apiUrl } = options;
  const fetchImpl = options.fetchImpl ?? fetch;

  return [
    {
      name: "list_clients",
      description: "List clients known to this brand tenant, with a summary for each.",
      shape: {},
      run: async () => {
        const clients = (await apiCall({ baseUrl: apiUrl, path: "/clients", fetchImpl })) as ClientSummary[];
        return clients;
      },
    },
    {
      name: "get_client",
      description: "Fetch one client: profile, taste, and full interaction history.",
      shape: { id: z.string().describe("Client id") },
      run: async (args) => {
        const id = String(args.id);
        return apiCall({ baseUrl: apiUrl, path: `/clients/${id}`, fetchImpl });
      },
    },
    {
      name: "create_draft",
      description:
        "Draft a client communication from the client's memory. Returns a draft in status pending_approval; nothing is sent.",
      shape: {
        clientId: z.string().describe("Client id"),
        channel: z.enum(["whatsapp", "email", "phone"]).describe("Outbound channel"),
        intentHint: z.string().optional().describe("What the communication should accomplish"),
      },
      run: async (args) => {
        return apiCall({
          baseUrl: apiUrl,
          path: "/draft",
          method: "POST",
          fetchImpl,
          body: {
            clientId: String(args.clientId),
            channel: String(args.channel),
            ...(args.intentHint === undefined ? {} : { intentHint: String(args.intentHint) }),
          },
        }) as Promise<DraftSummary>;
      },
    },
    {
      name: "approve_draft",
      description:
        "Approve a pending draft (optionally with advisor edits) and record it as the outbound communication. This is the human approval gate.",
      shape: {
        draftId: z.string().describe("Draft id"),
        text: z.string().optional().describe("Edited final text; defaults to the draft text"),
      },
      run: async (args) => {
        const draftId = String(args.draftId);
        return apiCall({
          baseUrl: apiUrl,
          path: `/drafts/${draftId}/approve`,
          method: "POST",
          fetchImpl,
          body: args.text === undefined ? {} : { text: String(args.text) },
        }) as Promise<DraftSummary>;
      },
    },
    {
      name: "reject_draft",
      description: "Reject a pending draft. No communication is recorded.",
      shape: { draftId: z.string().describe("Draft id") },
      run: async (args) => {
        const draftId = String(args.draftId);
        return apiCall({
          baseUrl: apiUrl,
          path: `/drafts/${draftId}/reject`,
          method: "POST",
          fetchImpl,
          body: {},
        }) as Promise<DraftSummary>;
      },
    },
  ];
}
