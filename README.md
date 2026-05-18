# Vero Guardian Dashboard

A Next.js dashboard for **Vero Guardians** — trusted reviewers who cast on-chain votes on GitHub pull requests via the Stellar blockchain. Guardians connect their Freighter wallet, browse the live PR feed, and submit cryptographically-signed approval votes that are recorded as Stellar `manageData` transactions.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Key Concepts](#key-concepts)
  - [Casting a Vote](#casting-a-vote)
  - [Guardian Reputation](#guardian-reputation)
  - [Wallet Context](#wallet-context)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Deployment Checklist](#deployment-checklist)

---

## Overview

The Vero system bridges GitHub code review with decentralized trust. A **Vero Relayer** watches GitHub for new PRs and registers them on-chain. Guardians then use this dashboard to:

1. Connect their Stellar wallet (via [Freighter](https://www.freighter.app/))
2. Browse open PRs in the live review feed
3. Cast an approval vote — a signed Stellar transaction stored on Horizon

Each vote is a `manageData` operation keyed `vote_<prId>` with value `approve`, permanently recorded on the Stellar testnet (or mainnet in production).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Guardian Browser                      │
│                                                         │
│  ┌─────────────┐    ┌──────────────┐   ┌────────────┐  │
│  │ ConnectButton│    │   PRFeed     │   │  VoteCard  │  │
│  │  (Freighter) │    │  (PR list)   │   │ (per PR)   │  │
│  └──────┬──────┘    └──────┬───────┘   └─────┬──────┘  │
│         │                  │                  │         │
│         └──────────────────┴──────────────────┘         │
│                            │                            │
│                    ┌───────▼────────┐                   │
│                    │  WalletContext  │                   │
│                    │  (publicKey)    │                   │
│                    └───────┬────────┘                   │
└────────────────────────────┼────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │ stellar-interact │
                    │  castVote()      │
                    │  getReputation() │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
   ┌──────────▼──────────┐    ┌─────────────▼──────────┐
   │  Freighter Extension │    │  Stellar Horizon API    │
   │  (signs XDR)         │    │  (submits transaction)  │
   └──────────────────────┘    └────────────────────────┘
                                          │
                               ┌──────────▼──────────┐
                               │  Stellar Testnet /   │
                               │  Soroban RPC         │
                               └─────────────────────┘
```

### Data Flow for a Vote

```
Guardian clicks "Vote"
        │
        ▼
castVote(prId, publicKey)
        │
        ├─ loadAccount(publicKey)  ──► Horizon REST API
        │
        ├─ TransactionBuilder
        │    └─ manageData({ name: "vote_42", value: "approve" })
        │
        ├─ tx.toXDR()  ──► signTransaction()  ──► Freighter popup
        │                        │
        │                   Guardian signs
        │
        └─ server.submitTransaction(signedTx)  ──► Horizon
                    │
                    ▼
            result.hash  (returned to UI)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Blockchain | [Stellar](https://stellar.org/) / Soroban |
| Wallet | [Freighter](https://www.freighter.app/) browser extension |
| Stellar SDK | `@stellar/stellar-base`, `@stellar/stellar-sdk` |
| HTTP Client | Axios |
| Testing | Jest + `@testing-library/react` |

---

## Project Structure

```
vero-guardian-dashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   ├── globals.css         # Global styles
│   │   └── api/                # Next.js API routes
│   ├── components/
│   │   ├── VoteCard.tsx        # PR card with vote button
│   │   ├── PRFeed.tsx          # Scrollable PR list
│   │   ├── ConnectButton.tsx   # Freighter wallet connect
│   │   ├── TaskCard.tsx        # Generic task display
│   │   ├── Toast.tsx           # Notification toasts
│   │   └── ErrorBoundary.tsx   # React error boundary
│   ├── context/
│   │   └── WalletContext.tsx   # Global wallet state
│   ├── lib/
│   │   └── stellar-interact.ts # Stellar SDK helpers
│   └── utils/
│       └── stellar-interact.ts # Utility wrappers
├── .env.example                # Required env vars
├── jest.config.js
├── next.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Freighter wallet](https://www.freighter.app/) browser extension
- A funded Stellar testnet account ([Friendbot](https://laboratory.stellar.org/#account-creator))

### Install & Run

```bash
# Clone the repo
git clone https://github.com/your-org/vero-guardian-dashboard.git
cd vero-guardian-dashboard

# Install dependencies
npm install

# Copy environment config
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
# .env.example
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# Optional: override the default Horizon endpoint
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
```

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_HORIZON_URL` | Stellar Horizon REST API | `https://horizon-testnet.stellar.org` |

---

## Key Concepts

### Casting a Vote

Votes are Stellar `manageData` operations. The key is `vote_<prId>` and the value is `approve`. This is built, signed via Freighter, and submitted to Horizon:

```typescript
// src/lib/stellar-interact.ts
export async function castVote(prId: number, publicKey: string): Promise<string> {
  const account = await server.loadAccount(publicKey);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.manageData({ name: `vote_${prId}`, value: 'approve' })
    )
    .setTimeout(30)
    .build();

  // Freighter signs the XDR-encoded transaction
  const signed = await signTransaction(tx.toXDR(), { network: 'TESTNET' });

  const result = await server.submitTransaction(
    StellarSdk.TransactionBuilder.fromXDR(signed, StellarSdk.Networks.TESTNET)
  );
  return result.hash; // transaction hash on Stellar
}
```

The `VoteCard` component calls this and tracks loading/voted state:

```tsx
// src/components/VoteCard.tsx
async function handleVote() {
  if (!publicKey) return alert('Connect your wallet first');
  setLoading(true);
  try {
    await castVote(pr.id, publicKey);
    setVoted(true);
  } catch {
    alert('Vote failed');
  } finally {
    setLoading(false);
  }
}
```

### Guardian Reputation

Each Guardian's reputation score is stored as a `vero_reputation` data entry on their Stellar account. It is read directly from Horizon account data:

```typescript
export async function getReputation(publicKey: string): Promise<number> {
  const account = await server.loadAccount(publicKey);
  const entry = (account.data_attr as Record<string, string>)['vero_reputation'];
  return entry ? parseInt(Buffer.from(entry, 'base64').toString(), 10) : 0;
}
```

Reputation is base64-encoded on-chain (Stellar stores all `manageData` values as base64) and decoded to a plain integer in the UI.

### Wallet Context

The `WalletContext` provides the connected Guardian's public key to all components:

```tsx
// src/context/WalletContext.tsx
import { createContext } from 'react';
export const WalletContext = createContext(null);
```

Consume it in any component:

```tsx
import { useWallet } from '@/context/WalletContext';

const { publicKey } = useWallet();
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

Test files live alongside source files or in `__tests__/` directories. Example:

```typescript
// test.js
import { getReputation } from './src/lib/stellar-interact';

test('returns 0 when no reputation entry exists', async () => {
  // mock server.loadAccount ...
  const score = await getReputation('GABC...');
  expect(score).toBe(0);
});
```

---

## CI/CD

The `ci.yml` file defines the integration pipeline. On every push:

1. Install dependencies
2. Run type-check (`tsc --noEmit`)
3. Run tests (`jest`)
4. Build (`next build`)

```yaml
# ci.yml (excerpt)
# integration automation metrics run scripts
```

---

## Deployment Checklist

Before deploying to production:

- [ ] Switch `NEXT_PUBLIC_HORIZON_URL` to `https://horizon.stellar.org` (mainnet)
- [ ] Switch `NEXT_PUBLIC_SOROBAN_RPC_URL` to `https://soroban-rpc.mainnet.stellar.gateway.fm` or equivalent
- [ ] Update `networkPassphrase` in `stellar-interact.ts` to `StellarSdk.Networks.PUBLIC`
- [ ] Update Freighter `signTransaction` network to `'MAINNET'`
- [ ] Verify all Guardians have funded mainnet accounts
- [ ] Run `npm run build` and confirm zero TypeScript errors
- [ ] Run full test suite — all tests must pass
- [ ] Set `NEXT_PUBLIC_*` vars in your hosting provider (Vercel, etc.)
- [ ] Enable HTTPS — Freighter requires a secure context
- [ ] Review CSP headers to allow Stellar Horizon and Soroban RPC origins
