// SPDX-License-Identifier: Apache-2.0
//
// Thin wrapper around the Midnight DApp Connector API. A compatible wallet
// (e.g. Lace) injects itself under `window.midnight[<rdns>]` — see
// https://docs.midnight.network for the full connector spec. This module
// only *detects and connects* to a wallet; it deliberately does not submit
// any transaction, since that requires a contract already deployed to a
// live network (see README.md § "Going from sandbox to testnet").

import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

export type DetectedWallet = {
  readonly rdns: string;
  readonly name: string;
  readonly icon: string;
  readonly apiVersion: string;
  readonly api: InitialAPI;
};

export const detectWallets = (): DetectedWallet[] => {
  const injected = window.midnight;
  if (!injected) return [];
  return Object.entries(injected).map(([rdns, api]) => ({
    rdns,
    name: api.name,
    icon: api.icon,
    apiVersion: api.apiVersion,
    api,
  }));
};

/**
 * Connects to a detected wallet, hinting the desired network.
 *
 * `networkId` follows the wallet connector convention (e.g. `'testnet'`,
 * `'undeployed'` for a local/standalone node). The wallet may prompt the
 * user to approve the connection.
 */
export const connectWallet = (wallet: DetectedWallet, networkId: string): Promise<ConnectedAPI> =>
  wallet.api.connect(networkId);
