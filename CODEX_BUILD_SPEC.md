# CODEX BUILD SPEC
Date: 2026-10-06
Service: tokenscan402 — ERC-20 token risk & metadata oracle (Base + Ethereum)
Port: 4023
Price: 0.05 USDC/call (x402, Base mainnet)
Endpoint: POST /scan takes {"chain": "base"|"ethereum", "address": "0x..."} returns {"name","symbol","decimals","totalSupply","owner","ownerRenounced":bool,"isProxy":bool,"implementation","hasMintFn":bool,"hasBlacklistFn":bool,"topHolderPct":number,"priceUsd":number|null,"liquidityUsd":number|null,"pairs":number,"riskScore":0-100,"riskFlags":[string],"ts"}
MCPTool: scan_token — Scan an ERC-20 contract on Base/Ethereum and return metadata, live price/liquidity and a 0-100 rug-risk score with human-readable flags. Use before swapping or recommending an unknown token.
BuildTime: ~3.5h
Why: Trading agents need a cheap pre-trade safety check on unknown tokens, and a single paid call that merges on-chain reads with DEX liquidity is worth far more than 0.05 USDC when it prevents a rug.

## Implementation notes
- Stack: Node 20, Express, viem, `@x402/core` + `@x402/evm` (same as agente402), so the payment middleware can be copied.
- On-chain (viem public client, env `RPC_BASE`, `RPC_ETH`):
  - `name/symbol/decimals/totalSupply` via ERC-20 ABI (multicall).
  - `owner()` (Ownable). Renounced = zero address or 0x...dEaD.
  - EIP-1967 implementation slot `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc` → isProxy/implementation.
  - Bytecode selector scan: mint `0x40c10f19`, blacklist-style (`0x44337ea1`, `0xf9f92be4`), setFee/tax variants, pause `0x8456cb59`.
- Market data: DexScreener public API `GET https://api.dexscreener.com/latest/dex/tokens/{address}` → priceUsd, sum liquidity.usd, pair count.
- Holder concentration: optional (BaseScan/Etherscan `tokenholderlist` with `SCAN_API_KEY`); return null if no key.
- riskScore: start 0; +25 not renounced, +20 proxy, +15 mint, +15 blacklist/pause, +15 liquidity < $10k, +10 topHolderPct > 20. Cap 100. Each add pushes a flag string.
- Cache by `chain:address` for 60s (LRU, 5k entries) to keep RPC cost per paid call ~0.
- Free routes: `GET /health`, `GET /.well-known/x402` (price manifest). Paid: `POST /scan`.
- Validate address with `viem.isAddress`; 400 on bad input BEFORE payment settlement.
- Tests: 3 fixtures (USDC on Base = low risk, a known proxy token, a random EOA → 422 "not a contract").

## Launch checklist
1. Deploy behind Caddy at tokenscan402.persikos.com → :4023.
2. MCP wrapper repo `tokenscan402-mcp` cloned from agente402-mcp `index.js` pattern.
3. List on Smithery, MCPize, Glama, mcp.so, Official MCP Registry (server.json), PulseMCP, ApyHub.
