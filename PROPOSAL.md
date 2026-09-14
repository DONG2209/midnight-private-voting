# Product Proposal — Private Voting

**Submitted for:** Midnight Level 3 ("Half Light, Half Shadow")
**Idea selected from the provided list:** *Private Voting — anonymous ballots with publicly verifiable tallies.*

## Problem

Most "online voting" today is one of two bad deals:

- **Fully public** (a show-of-hands poll, a signed petition) — verifiable, but every participant's choice is exposed, which chills honest voting on anything sensitive (governance forks, compensation, personnel, controversial proposals).
- **Fully trusted** (a Google Form, a centralized voting SaaS) — private-ish, but the tally is only as honest as the operator, and there's no way for an outside observer to *verify* the count without trusting them.

DAOs, co-ops, and small organizations regularly need a third option: **prove the tally is correct without exposing who voted which way.**

## Why Midnight fits

Midnight's model — public ledger state plus zero-knowledge circuits over private witnesses — maps directly onto this problem:

- The **tally is public ledger state** (`Counter` fields), so anyone can verify it by reading the chain; no trusted tallying party is needed.
- Each **voter's identity is a witness**, never written to the ledger. A circuit-computed **nullifier** (a one-way hash of the voter's secret key, domain-separated per ballot) is published instead, so the contract can reject a second vote from the same voter without ever learning who they are.
- **`disclose()`** makes the privacy boundary explicit and auditable in the contract source itself: every place a witness value influences public state is a single, visible line — see `contract/src/private-voting.compact`.

## Scope for this cycle

In scope:

- One ballot per contract deployment, three choices (YES / NO / ABSTAIN).
- Anonymous, double-vote-proof ballot casting via a per-ballot nullifier.
- A self-service admin role (whoever calls `registerAdmin()` first) that can close voting, authenticated by a secret-key commitment rather than a wallet-identity check.
- A contract-level test suite (11 tests) covering the tallying, double-vote rejection, admin authorization, and the cross-ballot unlinkability property.
- A CI pipeline that installs the real Compact toolchain, compiles the contract, and runs the tests on every push.
- A browser sandbox (`frontend/`) that runs the compiled contract client-side for a zero-infrastructure demo of the full flow.

Explicitly out of scope for this cycle (see README § "Going from sandbox to testnet"):

- Multiple concurrent proposals in one deployment (today: one contract per ballot — a deliberate simplification, not a limitation of the approach).
- Live submission of proved transactions to a Midnight network from the browser (requires a deployed contract address plus wallet/indexer/proof-server providers, which depend on the specific network the reviewer deploys to).
- Voter eligibility gating (e.g., token-gated or allowlisted voting) — a natural follow-up that would combine this idea with *Private Allowlist Access* from the same idea list.

## Success criteria

- [x] A vote changes the public tally without revealing the voter.
- [x] The same voter cannot vote twice in one ballot.
- [x] The same voter's participation in two different ballots is not linkable.
- [x] Only the registered admin can close a ballot, without their key ever appearing on chain.
- [x] All of the above is exercised by automated tests, run on every push via CI.
