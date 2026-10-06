#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { privateKeyToAccount } from 'viem/accounts';
import { x402Client, x402HTTPClient } from '@x402/core/client';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const SERVICE_URL = 'https://agente402.persikos.com/v1/receipt';

function loadWallet() {
  // Prefer env var for CI/serverless, fall back to secrets file
  if (process.env.AGENTE402_PRIVATE_KEY) {
    return privateKeyToAccount(process.env.AGENTE402_PRIVATE_KEY);
  }
  const keyPath = process.env.AGENTE402_KEY_FILE ||
    resolve(DIR, '../secrets/buyer.json');
  if (!existsSync(keyPath)) {
    throw new Error(
      'No wallet found. Set AGENTE402_PRIVATE_KEY or provide secrets/buyer.json with {privateKey, address}.'
    );
  }
  const { privateKey } = JSON.parse(readFileSync(keyPath, 'utf8'));
  return privateKeyToAccount(privateKey);
}

async function extractReceipt(document) {
  const account = loadWallet();
  const httpClient = new x402HTTPClient(
    new x402Client().register('eip155:8453', new ExactEvmScheme(account))
  );
  const body = JSON.stringify({ document });
  const headers = { 'Content-Type': 'application/json' };

  // Step 1: probe — expect 402
  const probe = await fetch(SERVICE_URL, { method: 'POST', headers, body });
  if (probe.status !== 402) {
    if (!probe.ok) {
      const text = await probe.text().catch(() => '');
      throw new Error(`agente402 returned ${probe.status}: ${text.substring(0, 200)}`);
    }
    return probe.json();
  }

  // Step 2: sign
  const paymentRequired = httpClient.getPaymentRequiredResponse(
    (name) => probe.headers.get(name)
  );
  const payload = await httpClient.createPaymentPayload(paymentRequired);
  const sigHeaders = httpClient.encodePaymentSignatureHeader(payload);

  // Step 3: paid request
  const response = await fetch(SERVICE_URL, {
    method: 'POST',
    headers: { ...headers, ...sigHeaders },
    body,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`agente402 returned ${response.status}: ${text.substring(0, 200)}`);
  }
  return response.json();
}

const server = new Server(
  { name: 'agente402', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'extract_receipt',
    description: 'Extract structured fields (merchant, date, currency, total, tax, line_items) from receipt text. Costs 0.01 USDC on Base per call.',
    inputSchema: {
      type: 'object',
      properties: {
        document: {
          type: 'string',
          description: 'Raw receipt text — paste the full receipt as plain text.',
          minLength: 1,
        },
      },
      required: ['document'],
      additionalProperties: false,
    },
  }],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'extract_receipt') {
    return { content: [{ type: 'text', text: 'Unknown tool' }], isError: true };
  }
  const { document } = request.params.arguments ?? {};
  if (!document || typeof document !== 'string') {
    return { content: [{ type: 'text', text: 'document is required' }], isError: true };
  }
  try {
    const result = await extractReceipt(document);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: String(err.message) }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
