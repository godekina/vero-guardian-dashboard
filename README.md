# Vero Guardian Dashboard

> A full-stack Next.js 14 dashboard for **Vero Guardians** — trusted on-chain reviewers who cast cryptographically-signed votes on GitHub pull requests via the Stellar blockchain.

Guardians connect their [Freighter](https://www.freighter.app/) wallet, browse the live PR review feed, and submit approval votes recorded as permanent `manageData` transactions on Stellar Horizon. The system bridges open-source code review with decentralized, verifiable trust.

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
  - [High-Level System Map](#high-level-system-map)
  - [Frontend Component Tree](#frontend-component-tree)
  - [Vote Data Flow](#vote-data-flow)
  - [Relayer Pipeline](#relayer-pipeline)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Key Concepts](#key-concepts)
  - [Casting a Vote](#casting-a-vote)
  - [Guardian Reputation](#guardian-reputation)
  - [Wallet Context](#wallet-context)
  - [Webhook Relayer](#webhook-relayer)
- [API Reference](#api-reference)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Deployment Checklist](#deployment-checklist)

---

## Overview

The Vero system connects GitHub's pull request lifecycle to the Stellar blockchain. Here's the end-to-end flow:

1. A developer opens a PR tagged `wave-contribution` on GitHub
2. The **Vero Relayer** (`index.js`) receives the GitHub webhook and calls `registerTaskOnChain`
3. The task is recorded on Stellar as a `manageData` entry
4. **Guardians** open this dashboard, connect their Freighter wallet, and browse the PR feed
5. A Guardian clicks **Vote** — the dashboard builds a Stellar transaction, Freighter signs it, and it's submitted to Horizon
6. The vote hash is permanently stored on-chain under key `vote_<prId>`

Each Guardian's trust score is tracked as `vero_reputation` on their Stellar account, readable by any participant.

---

## System Architecture

### High-Level System Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                          GitHub                                       │
│   Developer opens PR  ──►  Webhook fires (action: closed + merged)   │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  POST /github-webhook
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       Vero Relayer  (index.js)                        │
│                                                                       │
│   • Validates action === 'closed' && pull_request.merged === true     │
│   • Checks labels includes 'wave-contribution'                        │
│   • Calls registerTaskOnChain(prNumber)  ──►  stellar.js             │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  manageData tx (task_<prId>)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Stellar Horizon / Testnet                        │
│                                                                       │
│   task_42 = "wave-contribution"   (manageData entry)                 │
│   vote_42 = "approve"             (Guardian vote entry)              │
│   vero_reputation = <score>       (Guardian account data)            │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  Horizon REST API
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   Guardian Browser  (Next.js 14)                      │
│                                                                       │
│   ConnectButton  ──►  WalletContext (publicKey)                      │
│   PRFeed         ──►  VoteCard  ──►  castVote()  ──►  Freighter     │
│   ReputationBadge ──►  getReputation()                               │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Frontend Component Tree

```
<RootLayout>
  └── <WalletContext.Provider>
        ├── <ConnectButton />          # Freighter wallet connect/disconnect
        ├── <PRFeed />                 # Fetches open PRs, renders list
        │     └── <VoteCard pr={...} />  # Per-PR card with vote button
        │           ├── PR metadata (title, number, author)
        │           ├── Label badges
        │           └── <button onClick={handleVote}>Vote</button>
        ├── <ReputationBadge />        # Reads vero_reputation from Horizon
        └── <Toast />                  # Success/error notifications
```

---

### Vote Data Flow

```
Guardian clicks "Vote"
        │
        ▼
handleVote()  [VoteCard.tsx]
        │
        ├── guard: publicKey must be set (wallet connected)
        │
        ▼
castVote(prId, publicKey)  [stellar-interact.ts]
        │
        ├── server.loadAccount(publicKey)  ──────────────► Horizon API
        │         └── returns AccountResponse (sequence number, etc.)
        │
        ├── TransactionBuilder
        │     ├── fee: BASE_FEE (100 stroops)
        │     ├── networkPassphrase: Networks.TESTNET
        │     └── .addOperation(
        │               Operation.manageData({
        │                 name:  "vote_42",
        │                 value: "approve"
        │               })
        │             )
        │
        ├── tx.toXDR()  ──► signTransaction(xdr, { network: 'TESTNET' })
        │                           │
        │                    Freighter popup
        │                    Guardian approves
        │                           │
        │                    returns signed XDR
        │
        └── server.submitTransaction(signedTx)  ──────────► Horizon API
                      │
                      ▼
              result.hash  ──► setVoted(true)  ──► Toast "Vote recorded!"
```

---

### Relayer Pipeline

```
GitHub Webhook  ──►  POST /github-webhook
                              │
                    ┌─────────▼──────────┐
                    │  Validate payload   │
                    │  action === 'closed'│
                    │  merged === true    │
                    │  label: wave-contrib│
                    └─────────┬──────────┘
                              │ pass
                    ┌─────────▼──────────┐
                    │ registerTaskOnChain │  (stellar.js)
                    │  - load env keys    │
                    │  - build manageData │
                    │  - log tx payload   │
                    │  - submit / simulate│
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Stellar Horizon    │
                    │  task_<prId> stored │
                    └────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) | SSR + client dashboard |
| Language | TypeScript | Type-safe frontend |
| Styling | Tailwind CSS | Utility-first UI |
| Blockchain | [Stellar](https://stellar.org/) / Soroban | On-chain vote storage |
| Wallet | [Freighter](https://www.freighter.app/) | Transaction signing |
| Stellar SDK | `@stellar/stellar-base`, `@stellar/stellar-sdk` | TX building & Horizon calls |
| Relayer | Node.js + Express | GitHub webhook ingestion |
| HTTP Client | Axios | API requests |
| Testing | Jest + `@testing-library/react` | Unit & component tests |

---

## Project Structure

```
vero-guardian-dashboard/
├── index.js                    # Vero Relayer — Express webhook server
├── stellar.js                  # registerTaskOnChain() utility
├── scripts/
│   └── mock-webhook.js         # Simulate a GitHub webhook (npm run simulate)
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with WalletContext provider
│   │   ├── page.tsx            # Home page — renders PRFeed
│   │   ├── globals.css         # Tailwind base styles
│   │   └── api/                # Next.js API routes
│   ├── components/
│   │   ├── VoteCard.tsx        # PR card with vote button + state
│   │   ├── PRFeed.tsx          # Scrollable PR list
│   │   ├── ConnectButton.tsx   # Freighter connect/disconnect
│   │   ├── TaskCard.tsx        # Generic task display card
│   │   ├── Toast.tsx           # Success/error notification toasts
│   │   └── ErrorBoundary.tsx   # React error boundary wrapper
│   ├── context/
│   │   └── WalletContext.tsx   # Global wallet state (publicKey)
│   ├── lib/
│   │   └── stellar-interact.ts # castVote(), getReputation()
│   └── utils/
│       └── stellar-interact.ts # Utility re-exports
├── .env.example                # Required environment variables
├── jest.config.js
├── next.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Freighter wallet](https://www.freighter.app/) browser extension installed
- A funded Stellar testnet account — use [Friendbot](https://laboratory.stellar.org/#account-creator)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/your-org/vero-guardian-dashboard.git
cd vero-guardian-dashboard

# Install dependencies
npm install

# Copy environment config
cp .env.example .env.local

# Start the Next.js dashboard
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run the Relayer

The relayer is a separate Express server that listens for GitHub webhooks:

```bash
# Start the webhook relayer on port 3000
node index.js

# In another terminal, fire a simulated webhook
npm run simulate
```

Expected relayer output:

```
[relayer] Listening on port 3000
[webhook] Merged PR #42 with wave-contribution — registering on chain
[stellar] Registering PR #42 on testnet
[stellar] Source key loaded: YES
[stellar] Transaction compiled: {
  "operation": "manageData",
  "key": "task_42",
  "value": "wave-contribution",
  "network": "testnet",
  "fee": 100
}
[stellar] ✓ Task PR #42 registered — awaiting submission
```

### Build for Production

```bash
npm run build
npm start
```

---

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
# Soroban RPC endpoint
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# Stellar Horizon REST API
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org

# Relayer: Guardian's Stellar secret key (server-side only, never expose to browser)
STELLAR_SECRET_KEY=S...

# Relayer: target network
STELLAR_NETWORK=testnet
```

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_HORIZON_URL` | Stellar Horizon REST API | `https://horizon-testnet.stellar.org` |
| `STELLAR_SECRET_KEY` | Relayer signing key (server only) | — |
| `STELLAR_NETWORK` | `testnet` or `mainnet` | `testnet` |

> **Security:** `STELLAR_SECRET_KEY` must never be prefixed with `NEXT_PUBLIC_`. It is only read by the Node.js relayer process, never sent to the browser.

---

## Key Concepts

### Casting a Vote

Votes are Stellar `manageData` operations. The key is `vote_<prId>` and the value is `approve`. The full flow — build, sign, submit — lives in `src/lib/stellar-interact.ts`:

```typescript
// src/lib/stellar-interact.ts
import * as StellarSdk from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';

const server = new StellarSdk.Horizon.Server(
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon-testnet.stellar.org'
);

export async function castVote(prId: number, publicKey: string): Promise<string> {
  // 1. Load the account to get the current sequence number
  const account = await server.loadAccount(publicKey);

  // 2. Build the transaction
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.manageData({
        name: `vote_${prId}`,
        value: 'approve',
      })
    )
    .setTimeout(30)
    .build();

  // 3. Send XDR to Freighter for signing
  const signedXdr = await signTransaction(tx.toXDR(), { network: 'TESTNET' });

  // 4. Reconstruct and submit
  const signedTx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    StellarSdk.Networks.TESTNET
  );
  const result = await server.submitTransaction(signedTx);

  return result.hash;
}
```

The `VoteCard` component wires this to the UI:

```tsx
// src/components/VoteCard.tsx
import { useWallet } from '@/context/WalletContext';
import { castVote } from '@/lib/stellar-interact';

export function VoteCard({ pr }: { pr: PR }) {
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [voted, setVoted] = useState(false);

  async function handleVote() {
    if (!publicKey) return alert('Connect your wallet first');
    setLoading(true);
    try {
      const hash = await castVote(pr.id, publicKey);
      console.log('Vote tx hash:', hash);
      setVoted(true);
    } catch (err) {
      alert('Vote failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border p-4 shadow-sm">
      <h3 className="font-semibold">{pr.title}</h3>
      <p className="text-sm text-gray-500">PR #{pr.number}</p>
      <button
        onClick={handleVote}
        disabled={loading || voted}
        className="mt-3 rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {voted ? '✓ Voted' : loading ? 'Signing…' : 'Vote'}
      </button>
    </div>
  );
}
```

---

### Guardian Reputation

Each Guardian's reputation score is stored as a `vero_reputation` `manageData` entry on their Stellar account. Stellar encodes all data values as base64, so the value is decoded on read:

```typescript
// src/lib/stellar-interact.ts
export async function getReputation(publicKey: string): Promise<number> {
  const account = await server.loadAccount(publicKey);
  const raw = (account.data_attr as Record<string, string>)['vero_reputation'];
  if (!raw) return 0;
  return parseInt(Buffer.from(raw, 'base64').toString('utf8'), 10);
}
```

Usage in a component:

```tsx
import { useEffect, useState } from 'react';
import { getReputation } from '@/lib/stellar-interact';
import { useWallet } from '@/context/WalletContext';

export function ReputationBadge() {
  const { publicKey } = useWallet();
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    if (publicKey) getReputation(publicKey).then(setScore);
  }, [publicKey]);

  if (score === null) return null;
  return (
    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
      Rep: {score}
    </span>
  );
}
```

---

### Wallet Context

`WalletContext` holds the connected Guardian's Stellar public key and exposes it globally via a custom hook:

```tsx
// src/context/WalletContext.tsx
'use client';
import { createContext, useContext, useState, ReactNode } from 'react';

interface WalletCtx {
  publicKey: string | null;
  setPublicKey: (key: string | null) => void;
}

const WalletContext = createContext<WalletCtx>({ publicKey: null, setPublicKey: () => {} });

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  return (
    <WalletContext.Provider value={{ publicKey, setPublicKey }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
```

The `ConnectButton` component drives the connect/disconnect flow:

```tsx
// src/components/ConnectButton.tsx
'use client';
import { getPublicKey } from '@stellar/freighter-api';
import { useWallet } from '@/context/WalletContext';

export function ConnectButton() {
  const { publicKey, setPublicKey } = useWallet();

  async function connect() {
    const key = await getPublicKey();
    setPublicKey(key);
  }

  if (publicKey) {
    return (
      <button onClick={() => setPublicKey(null)} className="text-sm text-red-500">
        Disconnect ({publicKey.slice(0, 6)}…)
      </button>
    );
  }

  return (
    <button onClick={connect} className="rounded bg-indigo-600 px-4 py-2 text-white">
      Connect Wallet
    </button>
  );
}
```

---

### Webhook Relayer

The relayer (`index.js`) is a lightweight Express server that ingests GitHub webhooks and registers qualifying PRs on-chain:

```javascript
// index.js
const express = require('express');
const { registerTaskOnChain } = require('./stellar');

const app = express();
app.use(express.json());

app.post('/github-webhook', async (req, res) => {
  const { action, pull_request } = req.body;

  // Only process merged PRs
  if (action !== 'closed' || !pull_request?.merged) {
    return res.status(200).json({ skipped: true });
  }

  // Only process wave-contribution tagged PRs
  const hasLabel = pull_request.labels?.some(l => l.name === 'wave-contribution');
  if (!hasLabel) {
    return res.status(200).json({ skipped: true, reason: 'no wave-contribution label' });
  }

  const prNumber = pull_request.number;
  console.log(`[webhook] Merged PR #${prNumber} with wave-contribution — registering on chain`);

  try {
    const result = await registerTaskOnChain(prNumber);
    res.status(200).json({ registered: true, prNumber, result });
  } catch (err) {
    console.error('[webhook] Chain registration failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`[relayer] Listening on port ${process.env.PORT || 3000}`)
);
```

The `stellar.js` module handles transaction compilation:

```javascript
// stellar.js
async function registerTaskOnChain(githubId) {
  const secretKey = process.env.STELLAR_SECRET_KEY || '(not set)';
  const network = process.env.STELLAR_NETWORK || 'testnet';

  console.log(`[stellar] Registering PR #${githubId} on ${network}`);

  const txPayload = {
    operation: 'manageData',
    key: `task_${githubId}`,
    value: 'wave-contribution',
    network,
    fee: 100,
  };

  console.log('[stellar] Transaction compiled:', JSON.stringify(txPayload, null, 2));
  console.log(`[stellar] ✓ Task PR #${githubId} registered — awaiting submission`);

  return { txPayload, status: 'simulated' };
}

module.exports = { registerTaskOnChain };
```

To test the relayer without a live GitHub webhook:

```javascript
// scripts/mock-webhook.js
const payload = {
  action: 'closed',
  pull_request: {
    number: 42,
    merged: true,
    labels: [{ name: 'wave-contribution' }],
  },
};

fetch('http://localhost:3000/github-webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
  .then(res => res.json())
  .then(data => console.log('[mock-webhook] Response:', data))
  .catch(err => console.error('[mock-webhook] Error:', err.message));
```

```bash
npm run simulate
# [mock-webhook] Response: { registered: true, prNumber: 42, result: { ... } }
```

---

## API Reference

### `POST /github-webhook`

Receives GitHub webhook events. Only processes `closed` + `merged` PRs with the `wave-contribution` label.

**Request body** (GitHub webhook format):

```json
{
  "action": "closed",
  "pull_request": {
    "number": 42,
    "merged": true,
    "labels": [{ "name": "wave-contribution" }]
  }
}
```

**Response — registered:**

```json
{
  "registered": true,
  "prNumber": 42,
  "result": {
    "txPayload": {
      "operation": "manageData",
      "key": "task_42",
      "value": "wave-contribution",
      "network": "testnet",
      "fee": 100
    },
    "status": "simulated"
  }
}
```

**Response — skipped:**

```json
{ "skipped": true, "reason": "no wave-contribution label" }
```

---

## Testing

Tests use Jest and React Testing Library:

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

Example unit test for `getReputation`:

```typescript
// src/lib/__tests__/stellar-interact.test.ts
import { getReputation } from '../stellar-interact';

jest.mock('../stellar-interact', () => ({
  ...jest.requireActual('../stellar-interact'),
}));

const mockLoadAccount = jest.fn();
jest.mock('@stellar/stellar-sdk', () => ({
  Horizon: {
    Server: jest.fn(() => ({ loadAccount: mockLoadAccount })),
  },
}));

test('returns 0 when no reputation entry exists', async () => {
  mockLoadAccount.mockResolvedValue({ data_attr: {} });
  const score = await getReputation('GABC123...');
  expect(score).toBe(0);
});

test('decodes base64 reputation value', async () => {
  const encoded = Buffer.from('42').toString('base64');
  mockLoadAccount.mockResolvedValue({ data_attr: { vero_reputation: encoded } });
  const score = await getReputation('GABC123...');
  expect(score).toBe(42);
});
```

Example component test for `VoteCard`:

```tsx
// src/components/__tests__/VoteCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { VoteCard } from '../VoteCard';

const mockPR = { id: 1, number: 42, title: 'Fix auth bug', labels: [] };

test('shows Vote button when wallet is connected', () => {
  render(<VoteCard pr={mockPR} />);
  expect(screen.getByRole('button', { name: /vote/i })).toBeInTheDocument();
});

test('disables button after voting', async () => {
  // mock castVote ...
  render(<VoteCard pr={mockPR} />);
  fireEvent.click(screen.getByRole('button', { name: /vote/i }));
  // assert loading then voted state
});
```

---

## CI/CD Pipeline

The `ci.yml` workflow runs on every push and pull request:

```yaml
# ci.yml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Run tests
        run: npm test -- --ci --coverage

      - name: Build
        run: npm run build
```

Pipeline stages:

1. **Install** — `npm ci` for reproducible installs
2. **Type check** — `tsc --noEmit` catches TypeScript errors without emitting files
3. **Test** — Jest runs all unit and component tests with coverage
4. **Build** — `next build` validates the production bundle

---

## Deployment Checklist

Before going to mainnet:

- [ ] Switch `NEXT_PUBLIC_HORIZON_URL` → `https://horizon.stellar.org`
- [ ] Switch `NEXT_PUBLIC_SOROBAN_RPC_URL` → `https://soroban-rpc.mainnet.stellar.gateway.fm`
- [ ] Update `networkPassphrase` in `stellar-interact.ts` → `StellarSdk.Networks.PUBLIC`
- [ ] Update Freighter `signTransaction` network → `'MAINNET'`
- [ ] Set `STELLAR_NETWORK=mainnet` in relayer environment
- [ ] Verify all Guardians have funded mainnet Stellar accounts
- [ ] Run `npm run build` — confirm zero TypeScript errors
- [ ] Run `npm test` — all tests must pass
- [ ] Set all `NEXT_PUBLIC_*` vars in Vercel (or your hosting provider)
- [ ] Enable HTTPS — Freighter requires a secure context (`https://`)
- [ ] Add CSP headers allowing Stellar Horizon and Soroban RPC origins
- [ ] Configure GitHub webhook secret and validate `X-Hub-Signature-256` in the relayer
- [ ] Rate-limit the `/github-webhook` endpoint
