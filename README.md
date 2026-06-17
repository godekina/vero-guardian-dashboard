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
  - [Batch Transaction Builder](#batch-transaction-builder)
  - [Security Scanner Results](#security-scanner-results)
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
        └── <RoleContext.Provider>
              ├── <ConnectButton />          # Multi-wallet picker (Freighter, Rabet)
              ├── <PRFeed />                 # Fetches open PRs, renders list
              │     └── <VoteCard pr={...} />  # Per-PR card with guarded vote button
              ├── <TransactionFeed />        # Live Horizon transaction stream
              ├── <GasHeatmap />             # Per-function gas usage heatmap (D3)
              ├── <AccessControl />          # Role-gated Admin vs Guardian UI
              ├── <ReputationBadge />        # Reads vero_reputation from Horizon
              ├── <Toast />                  # Success/error notifications
              └── <ErrorModal />             # Global, dismissible error dialog
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
| Visualization | [D3](https://d3js.org/) (`d3-scale`, `d3-scale-chromatic`) | Gas usage heatmap |
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
│   │   ├── TransactionFeed/    # Live Horizon transaction stream feed
│   │   ├── GasHeatmap/         # Per-function gas usage heatmap (D3)
│   │   ├── ConnectButton.tsx   # Freighter connect/disconnect
│   │   ├── TaskCard.tsx        # Generic task display card
│   │   ├── Toast.tsx           # Success/error notification toasts
│   │   ├── ErrorModal.tsx      # Reusable global error modal + useError() hook
│   │   └── ErrorBoundary.tsx   # React error boundary wrapper
│   ├── context/
│   │   └── WalletContext.tsx   # Global wallet state (publicKey)
│   ├── lib/
│   │   ├── stellar-interact.ts # castVote(), getReputation()
│   │   └── wallets/            # Stellar wallet provider adapters + registry
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
[stellar] Source key loaded: YES (hardware-backed vault)
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

# Optional Horizon account that stores admin/guardian role map entries
NEXT_PUBLIC_ROLE_REGISTRY_ACCOUNT=G...

# Relayer: target network
STELLAR_NETWORK=testnet

# Relayer vault metadata. Store only encrypted vault records in env/config.
RELAYER_VAULT_KEY_PROVIDER=hardware
RELAYER_VAULT_HARDWARE_BACKED=true
RELAYER_VAULT_STELLAR_SECRET_KEY={...encrypted vault record...}
```

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_HORIZON_URL` | Stellar Horizon REST API | `https://horizon-testnet.stellar.org` |
| `NEXT_PUBLIC_ROLE_REGISTRY_ACCOUNT` | Optional Horizon account containing admin/guardian role map entries | connected wallet account |
| `STELLAR_NETWORK` | `testnet` or `mainnet` | `testnet` |
| `RELAYER_VAULT_KEY_PROVIDER` | Hardware-backed vault key provider identifier | `hardware` |
| `RELAYER_VAULT_HARDWARE_BACKED` | Must be `true` when relayer vault keys are backed by OS/HSM storage | — |
| `RELAYER_VAULT_STELLAR_SECRET_KEY` | Encrypted vault record for the relayer signing key | — |

> **Security:** Do not store raw relayer secrets such as `STELLAR_SECRET_KEY` in `.env` files. Store encrypted vault records and unwrap them with a hardware-backed provider.

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

### Batch Transaction Builder

`src/services/txBuilder.ts` provides a reusable batch transaction engine for flows that need to submit more than one Stellar operation in a single wallet approval. It accepts an ordered operation list, loads or reuses safe account sequence state, builds one Stellar transaction, asks Freighter to sign the unsigned XDR, and submits the signed transaction through Horizon.

```typescript
import * as StellarSdk from '@stellar/stellar-sdk';
import { signAndBroadcastBatchTransaction } from '@/services/txBuilder';

const result = await signAndBroadcastBatchTransaction({
  sourceAccount: publicKey,
  networkPassphrase: StellarSdk.Networks.TESTNET,
  operations: [
    StellarSdk.Operation.manageData({ name: 'vote_42', value: 'approve' }),
    StellarSdk.Operation.manageData({ name: 'audit_42', value: 'reviewed' }),
  ],
});

console.log(result.hash);
```

For custom signing flows, call `buildBatchTransaction()` to get an unsigned envelope XDR, pass that XDR to the existing wallet signing flow, then submit with `broadcastSignedBatchTransaction()`. The builder only caches non-sensitive sequence metadata after successful submissions and invalidates that cache if Horizon returns `tx_bad_seq`.

---

### Security Scanner Results

`src/components/security/` provides a reusable UI module for static-analysis and vulnerability scanner JSON. The dashboard renders `<SecurityScannerResults />` with a local JSON input, and callers can also pass scanner output directly:

```tsx
import SecurityScannerResults from '@/components/security';

<SecurityScannerResults results={scannerJson} />
```

Supported scanner fields include `id`, `ruleId`, `cve`, `title`, `message`, `description`, `severity`, `level`, `package`, `dependency`, `file`, `path`, `line`, `recommendation`, `fix`, and safe `http`/`https` URLs. Arrays, common `{ findings: [...] }` style objects, SARIF `runs[].results`, and npm-audit-style `vulnerabilities` maps are normalized into one warning shape.

Severity is normalized case-insensitively: `critical`, `high`, `medium`, `moderate`, `low`, `info`, `warning`, and `error` are supported. `error` maps to `high`; `warning` and `moderate` map to `medium`; unknown values remain `unknown`.

Scanner fields are treated as untrusted. The parser strips HTML/script/style markup, masks obvious secret/token/password values, rejects unsafe URL protocols such as `javascript:`, and the UI renders values as React text nodes without `dangerouslySetInnerHTML`.

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

The `WalletContext` provides a resilient Stellar wallet connection state with localStorage-backed persistence, supporting multiple standard wallet providers through a pluggable adapter registry (`src/lib/wallets/`).

Key features:

- **Multi-wallet support** — connect via any registered provider (currently [Freighter](https://www.freighter.app/) and [Rabet](https://rabet.io/)). `ConnectButton` renders a picker of detected wallets.
- Stores the verified `publicKey` under `vero_wallet_publicKey` and the active provider id under `vero_wallet_provider` in `localStorage`.
- Verifies persisted Freighter keys against `isConnected()`/`getAddress()` before restoring UI state; non-Freighter sessions require an explicit reconnect after reload.
- `WatchWalletChanges` and `freighter-account-change` listeners clear or update wallet state when the active Freighter account changes.
- `connect(providerId?)` resolves the chosen adapter (defaults to Freighter) and surfaces errors; passing an invalid value safely falls back to Freighter.
- `disconnect()` clears state and stored keys.
- Exposes `isLoading`, `error`, `reputation`, `activeProvider`, and `availableProviders` for UI feedback.

#### Adding a wallet provider

Implement the `StellarWalletProvider` interface (`id`, `name`, `isAvailable()`, `connect()`) in a new module under `src/lib/wallets/`, then add it to the `walletProviders` array in `src/lib/wallets/index.ts`. The picker and context pick it up automatically.

API

- `WalletProvider` — React provider component that must wrap your app (already mounted in the root layout).
- `useWallet()` — Hook returning the wallet API:

```ts
type UseWallet = {
  publicKey: string | null;              // Stellar public key when connected
  isConnected: boolean;                  // shorthand for !!publicKey
  isLoading: boolean;                    // true while connecting or initializing
  error: string | null;                  // human-friendly error message
  reputation: number;                    // current reputation score shown in the dashboard
  activeProvider: WalletProviderId | null; // provider backing the connection
  availableProviders: WalletProviderInfo[]; // detected wallets + availability
  connect(providerId?: WalletProviderId): Promise<void>; // defaults to Freighter
  disconnect(): void;                    // clears key and localStorage
};
```

Constants

- Public key storage key: `vero_wallet_publicKey`
- Active provider storage key: `vero_wallet_provider`
- Freighter event: `freighter-account-change`

Example usage

Wrap your application (already done in the RootLayout):

```tsx
// src/app/layout.tsx
import { WalletProvider } from '@/context/WalletContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
```

Consume the hook in components:

```tsx
import { useWallet } from '@/hooks/useWallet';

export function ConnectButton() {
  const { publicKey, isLoading, error, connect, disconnect } = useWallet();

  if (publicKey) {
    return (
      <button onClick={disconnect} className="text-sm text-red-500">
        Disconnect ({publicKey.slice(0, 6)}…)
      </button>
    );
  }

  return (
    <button onClick={connect} disabled={isLoading} className="rounded bg-indigo-600 px-4 py-2 text-white">
      {isLoading ? 'Connecting…' : 'Connect Wallet'}
    </button>
  );
}
```

Notes

- If Freighter is not installed, `connect()` will set `error` to a helpful message.
- Persisted wallet state is restored only after Freighter confirms the same current address.
- Freighter wallet change listeners update or clear stored keys when the user switches accounts.

### Error Modal

`ErrorModal` provides a single, app-wide error dialog so error messaging stays consistent across the dashboard. The `ErrorProvider` is mounted once in the root layout, and any component can raise an error through the `useError()` hook — no need to wire up local modal state.

```tsx
import { useError } from '@/components/ErrorModal';

export function VoteButton() {
  const { showError } = useError();

  async function handleVote() {
    try {
      await castVote();
    } catch (err) {
      showError({
        title: 'Vote failed',
        message: err instanceof Error ? err.message : 'Please try again.',
        actionLabel: 'Retry',
        onAction: handleVote,
      });
    }
  }

  return <button onClick={handleVote}>Vote</button>;
}
```

`showError({ message })` is the only required field; `title` defaults to "Something went wrong". Passing `actionLabel`/`onAction` adds a primary action button (the action runs, then the modal closes). The modal is dismissible via its close button, the Cancel/Dismiss button, the backdrop, or the <kbd>Esc</kbd> key, and uses `role="alertdialog"` with labelled title/description for accessibility.

### Role Context

`RoleContext` fetches the connected wallet's role from Horizon account data and exposes derived permissions for UI guards.

Role data is read from `NEXT_PUBLIC_ROLE_REGISTRY_ACCOUNT` when configured; otherwise, the connected wallet account is inspected. Supported active role markers include `admin:<publicKey>`, `admin_<publicKey>`, `guardian:<publicKey>`, `guardian_<publicKey>`, and exact connected-account keys such as `admin`, `guardian`, or `role`.

Use `AccessControl` to hide admin-only UI from Guardians and unauthorized wallets, and use `useRole()` to block direct UI handlers before invoking guarded actions.

---

### Live Transaction Feed

`TransactionFeed` subscribes to Horizon's transaction stream (Server-Sent Events via `server.transactions().cursor('now').stream(...)`) and renders incoming network transactions in real time — newest first, capped at `MAX_FEED_ENTRIES` (25) and de-duplicated by transaction id. Each row links to the transaction on Stellar Expert, shows the source account, ledger sequence, operation count, and a success/failure indicator, with a live connection status badge.

The stream source is injectable for testing and customization:

```tsx
import TransactionFeed, {
  createHorizonTransactionStream,
} from '@/components/TransactionFeed';

// Default: live Horizon stream from NEXT_PUBLIC_HORIZON_URL (testnet fallback).
<TransactionFeed />

// Custom endpoint or a mock subscriber in tests.
<TransactionFeed subscribe={createHorizonTransactionStream('https://horizon.stellar.org')} />
```

A `subscribe` prop receives `{ onMessage, onError }` and returns an unsubscribe function, so the component can be driven without a network connection in unit tests. The Horizon endpoint is read from `NEXT_PUBLIC_HORIZON_URL` (defaults to `https://horizon-testnet.stellar.org`).

---

### Gas Usage Heatmap

`GasHeatmap` visualizes Soroban resource cost per contract function so gas spikes become obvious at a glance. Functions are rows; resource categories (CPU instructions, memory, ledger reads, ledger writes, events) are columns. Each cell is colored with a D3 sequential scale (`d3-scale-chromatic`'s `interpolateYlOrRd`) and positioned with `d3-scale`'s `scaleBand`. Color **intensity is normalized per metric column**, so the most expensive function for each resource stands out, and those cells are flagged as **hotspots** (also summarized below the grid) — satisfying "hotspots identified".

```tsx
import GasHeatmap, { type FunctionGasUsage } from '@/components/GasHeatmap';

// Default: representative per-function costs for the Vero contract.
<GasHeatmap />

// Inject real data (e.g. from testnet transaction simulation).
const usage: FunctionGasUsage[] = [
  { functionName: 'cast_vote', costs: { cpuInsns: 12_500_000, memBytes: 524_288, ledgerReads: 8, ledgerWrites: 3, events: 2 } },
  // ...
];
<GasHeatmap data={usage} />
```

The pure helpers `buildHeatmap()`, `findHotspots()`, and `formatGas()` are exported and unit-tested independently of rendering. The dataset is held in local component state and is injectable via the `data` prop, so a live testnet simulation feed can replace the default without changing the view.

> **Jest note:** D3 v4+ ships ESM-only packages. `jest.config.js` overrides `transformIgnorePatterns` to transform the `d3-*` modules used here.

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
const { getVaultSecretStatus } = require('./src/services/vault-node');

async function registerTaskOnChain(githubId) {
  const keyStatus = getVaultSecretStatus('STELLAR_SECRET_KEY');
  const network = process.env.STELLAR_NETWORK || 'testnet';

  console.log(`[stellar] Registering PR #${githubId} on ${network}`);
  console.log(`[stellar] Source key loaded: ${keyStatus.configured ? 'YES (vault)' : 'NO (vault entry missing)'}`);

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
