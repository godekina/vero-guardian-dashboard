# Vero Guardian Dashboard — Wave Program Plan

The Wave Program connects maintainers with contributors through scoped, sprint-ready issues. Maintainers post clearly defined tasks; contributors pick them up, deliver, and earn on-chain reputation via the Vero Guardian system.

---

## How It Works

Each sprint cycle, maintainers open GitHub issues tagged `wave-contribution`. When a contributor's PR is merged, the Vero Relayer automatically registers the task on Stellar and updates the contributor's `vero_reputation` score on-chain.

---

## Types of Work

### 1. Bug Fixes

Scoped issues targeting broken or incorrect behavior. Each issue includes:
- A clear description of the bug and steps to reproduce
- The affected file(s) or component(s)
- Expected vs. actual behavior
- Acceptance criteria (e.g., "existing tests pass, no regressions")

**Examples:**
- `VoteCard` shows stale voted state after wallet disconnect/reconnect
- `getReputation()` returns `NaN` when `vero_reputation` entry is malformed
- Relayer does not return a 500 when `registerTaskOnChain` throws

---

### 2. New Features

Additive work that extends the dashboard or relayer. Issues specify the feature scope, the components involved, and any design constraints.

**Examples:**
- Add a `ReputationBadge` component that displays the Guardian's live score in the nav bar
- Implement a vote history panel that reads past `vote_*` entries from Horizon account data
- Add support for `reject` votes alongside `approve` (new `manageData` value)
- Extend the relayer to support multiple label types beyond `wave-contribution`

---

### 3. Documentation

Writing or improving docs so contributors and Guardians can onboard faster. Issues specify the target audience and the gap being filled.

**Examples:**
- Write a "First Vote" walkthrough for new Guardians (wallet setup → connect → vote)
- Document all `stellar-interact.ts` exports with JSDoc comments
- Add inline comments to `index.js` and `stellar.js` explaining each step
- Create a `CONTRIBUTING.md` with branch naming, commit style, and PR checklist

---

### 4. Testing

Increasing test coverage for components, utilities, and the relayer. Issues specify the target file, the scenarios to cover, and the minimum coverage threshold.

**Examples:**
- Unit tests for `castVote()` — mock Horizon, mock Freighter, assert hash returned
- Component tests for `ConnectButton` — connect flow, disconnect flow, error state
- Integration test for `POST /github-webhook` — valid payload, skipped payload, missing label
- Edge case tests for `getReputation()` — missing entry, zero value, large integer

---

### 5. Refactoring & Code Quality

Improving internal structure without changing external behavior. Issues are scoped to a single file or module.

**Examples:**
- Extract Horizon server initialization into a shared singleton in `src/lib/horizon.ts`
- Replace raw `alert()` calls in `VoteCard` with the `Toast` component
- Add TypeScript strict mode and resolve resulting type errors
- Consolidate `src/lib/stellar-interact.ts` and `src/utils/stellar-interact.ts` into one module

---

### 6. DevEx & Tooling

Improvements to the developer experience, CI pipeline, or local setup.

**Examples:**
- Add ESLint + Prettier config with a pre-commit hook
- Add a `docker-compose.yml` for running the relayer locally alongside the Next.js dev server
- Improve CI pipeline to cache `node_modules` and reduce build time
- Add a `health` endpoint to the relayer (`GET /health` → `{ status: 'ok' }`)

---

## Issue Labeling Convention

| Label | Meaning |
|---|---|
| `wave-contribution` | Eligible for Wave Program sprint |
| `good-first-issue` | Suitable for first-time contributors |
| `bug` | Confirmed broken behavior |
| `feature` | New functionality |
| `docs` | Documentation only |
| `testing` | Test coverage work |
| `refactor` | Internal cleanup, no behavior change |

---

## Acceptance Criteria (All Issues)

1. PR passes all existing tests (`npm test`)
2. No TypeScript errors (`npx tsc --noEmit`)
3. `npm run build` succeeds
4. Code follows existing style conventions
5. PR description references the issue number and summarizes the change
