// SPDX-License-Identifier: Apache-2.0
//
// A thin, dependency-free client around the compiled contract, built
// directly on `@midnight-ntwrk/compact-runtime`. It runs the exact same
// compiled circuits a wallet/proof-server pipeline would run, just without
// a wallet, node, indexer, or proof server underneath — which makes it
// equally at home in:
//   - unit tests (see src/test/private-voting.test.ts), and
//   - the browser sandbox (see ../../frontend), for a fully client-side,
//     zero-infrastructure demo of the contract's logic and privacy model.
//
// Going from here to a real on-chain deployment means swapping this class
// for `@midnight-ntwrk/midnight-js-contracts`' `deployContract` /
// `findDeployedContract`, wired to a wallet, indexer, and proof server —
// see README.md § "Going from sandbox to testnet".

import {
  type ChargedState,
  type CircuitContext,
  type EncodedZswapLocalState,
  createCircuitContext,
  createConstructorContext,
  emptyZswapLocalState,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Choice, Contract, type Ledger, ledger } from './managed/private-voting/contract/index.js';
import { type VotingPrivateState, witnesses } from './witnesses.js';

/** A fixed, deterministic stand-in coin public key — fine off-chain. */
const SANDBOX_COIN_PUBLIC_KEY = '0'.repeat(64);

export class BallotClient {
  readonly contract: Contract<VotingPrivateState>;
  readonly contractAddress: string;
  private contractState!: ChargedState;
  private zswapState!: EncodedZswapLocalState;
  private privateState!: VotingPrivateState;

  private constructor(contract: Contract<VotingPrivateState>, contractAddress: string) {
    this.contract = contract;
    this.contractAddress = contractAddress;
  }

  /** Deploys a fresh ballot with the given title, as the given local party. */
  static async deploy(title: string, initialPrivateState: VotingPrivateState): Promise<BallotClient> {
    const client = new BallotClient(new Contract<VotingPrivateState>(witnesses), sampleContractAddress());
    const deployed = await client.contract.initialState(
      createConstructorContext(initialPrivateState, SANDBOX_COIN_PUBLIC_KEY),
      title,
    );
    client.contractState = deployed.currentContractState.data;
    client.zswapState = deployed.currentZswapLocalState;
    client.privateState = deployed.currentPrivateState;
    return client;
  }

  /** Points a second local party (e.g. another voter) at the same ballot state. */
  static joinExisting(other: BallotClient, privateState: VotingPrivateState): BallotClient {
    const client = new BallotClient(new Contract<VotingPrivateState>(witnesses), other.contractAddress);
    client.contractState = other.contractState;
    client.zswapState = other.zswapState ?? emptyZswapLocalState(SANDBOX_COIN_PUBLIC_KEY);
    client.privateState = privateState;
    return client;
  }

  private async run<R>(
    circuitId: string,
    exec: (context: CircuitContext<VotingPrivateState>) => Promise<{
      result: R;
      context: {
        callContext: {
          currentQueryContext: { state: ChargedState };
          currentZswapLocalState?: EncodedZswapLocalState;
          currentPrivateState?: VotingPrivateState;
        };
      };
    }>,
  ): Promise<R> {
    const context = createCircuitContext(
      circuitId,
      this.contractAddress,
      this.zswapState,
      this.contractState,
      this.privateState,
    );
    const { result, context: after } = await exec(context);
    this.contractState = after.callContext.currentQueryContext.state;
    this.zswapState = after.callContext.currentZswapLocalState ?? this.zswapState;
    this.privateState = after.callContext.currentPrivateState ?? this.privateState;
    return result;
  }

  castVote(choice: Choice): Promise<[]> {
    return this.run('castVote', (context) => this.contract.impureCircuits.castVote(context, choice));
  }

  registerAdmin(): Promise<[]> {
    return this.run('registerAdmin', (context) => this.contract.impureCircuits.registerAdmin(context));
  }

  closeBallot(): Promise<[]> {
    return this.run('closeBallot', (context) => this.contract.impureCircuits.closeBallot(context));
  }

  getLedger(): Ledger {
    return ledger(this.contractState);
  }

  getPrivateState(): VotingPrivateState {
    return this.privateState;
  }
}
