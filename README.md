# agente402-mcp

MCP server for [agente402](https://agente402.persikos.com) — extract receipt text to structured JSON for 0.01 USDC per call on Base mainnet.

[![agente402-mcp MCP server](https://glama.ai/mcp/servers/amiralimardani-art/agente402-mcp/badges/score.svg)](https://glama.ai/mcp/servers/amiralimardani-art/agente402-mcp)

## Install

```bash
npx agente402-mcp
```

Or add to your MCP client config:

```json
{
  "mcpServers": {
    "agente402": {
      "command": "npx",
      "args": ["agente402-mcp"],
      "env": {
        "AGENTE402_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## Tool: `extract_receipt`

Sends receipt text to agente402, pays 0.01 USDC on Base, and returns structured JSON.

**Input:** `document` (string) — raw receipt text

**Output:**
```json
{
  "merchant": "...",
  "date": "...",
  "currency": "...",
  "total": ...,
  "tax": ...,
  "line_items": [...]
}
```

## Wallet setup

Set `AGENTE402_PRIVATE_KEY` to a Base wallet private key with at least 0.01 USDC. No ETH needed — payments use gasless EIP-3009.

## License

MIT
