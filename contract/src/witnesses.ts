// SPDX-License-Identifier: Apache-2.0
//
// Witnesses supply the contract's PRIVATE inputs. Everything returned from a
// witness function stays on the caller's machine — only the values a circuit
// explicitly wraps in `disclose(...)` (see private-voting.compact) ever reach
// the public ledger or a transcript an observer can read.

import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from './managed/private-voting/contract/index.js';

/**
 * Local, off-chain state for one party interacting with the ballot.
 *
 * A regular voter only ever populates `voterSecretKey`; an admin only ever
 * populates `adminSecretKey`. Both fields exist on the same type purely so a
 * single `Contract` instance (which needs one `Witnesses<PS>` implementation)
 * can serve either role — a voter's `adminSecretKey` is never read because a
 * voter never calls `registerAdmin` / `closeBallot`.
 */
export type VotingPrivateState = {
  readonly voterSecretKey: Uint8Array;
  readonly adminSecretKey: Uint8Array;
};

const UNUSED_KEY = new Uint8Array(32);

export const createVoterPrivateState = (voterSecretKey: Uint8Array): VotingPrivateState => ({
  voterSecretKey,
  adminSecretKey: UNUSED_KEY,
});

export const createAdminPrivateState = (adminSecretKey: Uint8Array): VotingPrivateState => ({
  voterSecretKey: UNUSED_KEY,
  adminSecretKey,
});

/**
 * Generates a fresh, random 32-byte secret key for a new voter or admin.
 * Uses the standard Web Crypto API, available as a global both in the
 * browser and in Node.js 20+ — no bundler polyfill required either side.
 */
export const randomSecretKey = (): Uint8Array => {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
};

export const witnesses = {
  voterSecretKey: (
    context: WitnessContext<Ledger, VotingPrivateState>,
  ): [VotingPrivateState, Uint8Array] => [context.privateState, context.privateState.voterSecretKey],
  adminSecretKey: (
    context: WitnessContext<Ledger, VotingPrivateState>,
  ): [VotingPrivateState, Uint8Array] => [context.privateState, context.privateState.adminSecretKey],
};
