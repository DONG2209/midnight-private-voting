// SPDX-License-Identifier: Apache-2.0
//
// Manages local "voter identity" secret keys purely for this demo UI. Each
// identity is a random 32-byte key that never leaves this browser tab — it
// is passed to the contract only as a witness (see contract/src/witnesses.ts)
// and is never written to `localStorage` in a real deployment either; here
// we persist it only so a reload doesn't silently mint a new voter.

import { randomSecretKey } from '@midnight-level3/private-voting-contract';
import { fromHex, toHex } from './hex.js';

const STORAGE_PREFIX = 'private-voting-demo:identity:';

export const loadOrCreateIdentity = (name: string): Uint8Array => {
  const key = STORAGE_PREFIX + name;
  const existing = localStorage.getItem(key);
  if (existing) return fromHex(existing);

  const fresh = randomSecretKey();
  localStorage.setItem(key, toHex(fresh));
  return fresh;
};

export const resetIdentity = (name: string): Uint8Array => {
  localStorage.removeItem(STORAGE_PREFIX + name);
  return loadOrCreateIdentity(name);
};
