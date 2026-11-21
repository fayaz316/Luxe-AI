# @lux/mcp-server

MCP server exposing the lux copilot advisor tools over the copilot API.
Intended for MCP-compatible clients used by brand teams; every tool routes
through the copilot API, so the approval-first policy applies unchanged —
`approve_draft` is the human approval gate.

## Configuration

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `COPILOT_API_URL` | `http://localhost:8080` | Base URL of the brand's copilot API deployment |

## Tools

| Tool | Purpose |
| --- | --- |
| `list_clients` | List clients in the brand tenant |
| `get_client` | Fetch a client profile, taste, and interaction history |
| `create_draft` | Draft a client communication (returns `pending_approval`) |
| `approve_draft` | Approve a draft, optionally with advisor edits; records the outbound communication |
| `reject_draft` | Reject a draft; nothing is recorded |

## Client configuration example

```json
{
  "mcpServers": {
    "lux-copilot": {
      "command": "node",
      "args": ["/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "COPILOT_API_URL": "https://your-cloud-run-url"
      }
    }
  }
}
```

## Development

```bash
pnpm --filter @lux/mcp-server build
pnpm --filter @lux/mcp-server test
```

Licensed under Apache-2.0.
