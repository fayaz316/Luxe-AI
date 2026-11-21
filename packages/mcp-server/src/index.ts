// SPDX-License-Identifier: Apache-2.0

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { copilotTools, type ToolDef } from "./tools.js";
import type { FetchImpl } from "./http.js";

export interface CreateServerOptions {
  apiUrl: string;
  fetchImpl?: FetchImpl;
  /** Optional shared secret forwarded as x-api-key on every tool call. */
  apiKey?: string;
  server?: McpServer;
}

/**
 * Build an MCP server exposing the luxe copilot advisor tools. Every tool
 * routes through the copilot API, so the approval-first policy applies to
 * MCP clients exactly as it does to the web application.
 */
export function createCopilotServer(options: CreateServerOptions): McpServer {
  const server = options.server ?? new McpServer({ name: "luxe-copilot", version: "0.1.0" });
  const tools: ToolDef[] = copilotTools({
    apiUrl: options.apiUrl,
    fetchImpl: options.fetchImpl,
    apiKey: options.apiKey,
  });

  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.shape, async (args) => {
      try {
        const result = await tool.run(args as Record<string, unknown>);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    });
  }

  return server;
}

export async function main(): Promise<void> {
  const apiUrl = process.env.COPILOT_API_URL ?? "http://localhost:8080";
  const apiKey = process.env.COPILOT_API_KEY;
  const server = createCopilotServer({ apiUrl, ...(apiKey ? { apiKey } : {}) });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`luxe-mcp: connected to copilot API at ${apiUrl}\n`);
}

if (process.argv[1] && process.argv[1].endsWith("index.js")) {
  void main().catch((error: unknown) => {
    process.stderr.write(`luxe-mcp: fatal: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
