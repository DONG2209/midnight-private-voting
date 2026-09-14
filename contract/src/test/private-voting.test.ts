// SPDX-License-Identifier: Apache-2.0

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { describe, expect, it } from 'vitest';
import { BallotClient } from '../ballot-client.js';
import { BallotStatus, Choice } from '../managed/private-voting/contract/index.js';
import { createAdminPrivateState, createVoterPrivateState } from '../witnesses.js';

/** A plain, JSON-friendly snapshot of the public ledger, safe to deep-equal. */
const snapshot = (sim: BallotClient) => {
  const ledger = sim.getLedger();
  return {
    title: ledger.title,
    status: ledger.status,
    yesVotes: ledger.yesVotes,
    noVotes: ledger.noVotes,
    abstainVotes: ledger.abstainVotes,
    ballotsCast: ledger.ballotsCast,
    nullifierCount: ledger.nullifiers.size(),
    adminRegistered: ledger.adminRegistered,
    adminCommitment: Array.from(ledger.adminCommitment),
  };
};

setNetworkId('undeployed');

const alice = createVoterPrivateState(new Uint8Array(32).fill(1));
const bob = createVoterPrivateState(new Uint8Array(32).fill(2));
const admin = createAdminPrivateState(new Uint8Array(32).fill(9));
const impostor = createAdminPrivateState(new Uint8Array(32).fill(42));

describe('Private Voting contract', () => {
  it('initializes deterministically from the same title', async () => {
    const a = await BallotClient.deploy('Adopt the new charter?', alice);
    const b = await BallotClient.deploy('Adopt the new charter?', bob);
    expect(snapshot(a)).toEqual(snapshot(b));
  });

  it('starts open with zero tallies and no recorded ballots', async () => {
    const sim = await BallotClient.deploy('Adopt the new charter?', alice);
    const ledger = sim.getLedger();

    expect(ledger.title).toBe('Adopt the new charter?');
    expect(ledger.status).toBe(BallotStatus.OPEN);
    expect(ledger.yesVotes).toBe(0n);
    expect(ledger.noVotes).toBe(0n);
    expect(ledger.abstainVotes).toBe(0n);
    expect(ledger.ballotsCast).toBe(0n);
    expect(ledger.nullifiers.isEmpty()).toBe(true);
    expect(ledger.adminRegistered).toBe(false);
  });

  it('records a YES vote in the public tally and marks the nullifier used', async () => {
    const sim = await BallotClient.deploy('Adopt the new charter?', alice);

    await sim.castVote(Choice.YES);
    const ledger = sim.getLedger();

    expect(ledger.yesVotes).toBe(1n);
    expect(ledger.noVotes).toBe(0n);
    expect(ledger.ballotsCast).toBe(1n);
    expect(ledger.nullifiers.size()).toBe(1n);
  });

  it('tallies NO and ABSTAIN choices independently', async () => {
    const sim = await BallotClient.deploy('Adopt the new charter?', alice);
    const carol = createVoterPrivateState(new Uint8Array(32).fill(3));

    await sim.castVote(Choice.NO);
    const withCarol = BallotClient.joinExisting(sim, carol);
    await withCarol.castVote(Choice.ABSTAIN);

    const ledger = withCarol.getLedger();
    expect(ledger.yesVotes).toBe(0n);
    expect(ledger.noVotes).toBe(1n);
    expect(ledger.abstainVotes).toBe(1n);
    expect(ledger.ballotsCast).toBe(2n);
  });

  it('rejects a second ballot cast with the same voter secret key (double-vote protection)', async () => {
    const sim = await BallotClient.deploy('Adopt the new charter?', alice);

    await sim.castVote(Choice.YES);
    await expect(sim.castVote(Choice.NO)).rejects.toThrow(/already cast a ballot/i);

    // The rejected attempt must not have mutated the public tally.
    const ledger = sim.getLedger();
    expect(ledger.yesVotes).toBe(1n);
    expect(ledger.noVotes).toBe(0n);
    expect(ledger.ballotsCast).toBe(1n);
  });

  it('lets two different voters both cast a ballot in the same election', async () => {
    const sim = await BallotClient.deploy('Adopt the new charter?', alice);
    await sim.castVote(Choice.YES);

    const withBob = BallotClient.joinExisting(sim, bob);
    await withBob.castVote(Choice.YES);

    const ledger = withBob.getLedger();
    expect(ledger.yesVotes).toBe(2n);
    expect(ledger.ballotsCast).toBe(2n);
    expect(ledger.nullifiers.size()).toBe(2n);
  });

  it('lets the first caller register as admin, and only once', async () => {
    const sim = await BallotClient.deploy('Adopt the new charter?', admin);

    await sim.registerAdmin();
    expect(sim.getLedger().adminRegistered).toBe(true);

    await expect(sim.registerAdmin()).rejects.toThrow(/already registered/i);
  });

  it('lets the registered admin close voting', async () => {
    const sim = await BallotClient.deploy('Adopt the new charter?', admin);
    await sim.registerAdmin();

    await sim.closeBallot();
    expect(sim.getLedger().status).toBe(BallotStatus.CLOSED);
  });

  it('refuses to close the ballot for anyone other than the registered admin', async () => {
    const sim = await BallotClient.deploy('Adopt the new charter?', admin);
    await sim.registerAdmin();

    const asImpostor = BallotClient.joinExisting(sim, impostor);
    await expect(asImpostor.closeBallot()).rejects.toThrow(/not authorized/i);
    expect(sim.getLedger().status).toBe(BallotStatus.OPEN);
  });

  it('refuses any vote once the ballot is closed', async () => {
    const sim = await BallotClient.deploy('Adopt the new charter?', admin);
    await sim.registerAdmin();
    await sim.closeBallot();

    await expect(sim.castVote(Choice.YES)).rejects.toThrow(/voting is closed/i);
  });

  it('gives the same voter unlinkable nullifiers across two different ballots (privacy)', async () => {
    const sameVoter = createVoterPrivateState(new Uint8Array(32).fill(7));

    const ballotA = await BallotClient.deploy('Ballot A', sameVoter);
    await ballotA.castVote(Choice.YES);
    const nullifierInA = [...ballotA.getLedger().nullifiers][0];

    const ballotB = await BallotClient.deploy('Ballot B', sameVoter);
    await ballotB.castVote(Choice.YES);
    const nullifierInB = [...ballotB.getLedger().nullifiers][0];

    // Same secret key, different ballots -> unrelated public nullifiers, so an
    // observer watching both ballots cannot tell the same person voted in both.
    expect(Array.from(nullifierInA)).not.toEqual(Array.from(nullifierInB));
  });
});
