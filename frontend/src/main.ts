// SPDX-License-Identifier: Apache-2.0
//
// Wires the DOM in index.html to the BallotClient sandbox and the wallet
// connector. Deliberately framework-free: this is a small, self-contained
// demo, not an app that needs a component library.

import {
  BallotClient,
  BallotStatus,
  Choice,
  createAdminPrivateState,
  createVoterPrivateState,
  randomSecretKey,
  type Ledger,
} from '@midnight-level3/private-voting-contract';
import { shortHex, toHex } from './hex.js';
import { loadOrCreateIdentity, resetIdentity } from './identity.js';
import { connectWallet, detectWallets } from './wallet.js';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

let ballot: BallotClient | null = null;
let voterKey = loadOrCreateIdentity('voter-1');
let adminKey = loadOrCreateIdentity('admin');

// ---------------------------------------------------------------- logging --

const logList = $<HTMLOListElement>('log-list');

const log = (message: string, ok: boolean): void => {
  const item = document.createElement('li');
  item.className = ok ? 'ok' : 'err';
  const time = new Date().toLocaleTimeString();
  item.innerHTML = `<span class="muted">${time}</span> <span class="msg">${ok ? '✓' : '✗'} ${message}</span>`;
  logList.prepend(item);
};

// ------------------------------------------------------------------ wallet --

$('detect-wallet-btn').addEventListener('click', () => {
  const wallets = detectWallets();
  const list = $<HTMLUListElement>('wallet-list');
  list.innerHTML = '';

  if (wallets.length === 0) {
    $('wallet-status').textContent = 'no compatible wallet detected in this browser';
    return;
  }

  $('wallet-status').textContent = `${wallets.length} wallet(s) detected`;
  for (const wallet of wallets) {
    const item = document.createElement('li');
    item.innerHTML = `<img src="${wallet.icon}" alt="" onerror="this.remove()" /> <strong>${wallet.name}</strong> <span class="muted">v${wallet.apiVersion}</span>`;
    const connectBtn = document.createElement('button');
    connectBtn.textContent = 'Connect';
    connectBtn.addEventListener('click', async () => {
      try {
        await connectWallet(wallet, 'testnet');
        $('wallet-status').textContent = `connected to ${wallet.name}`;
        log(`Connected wallet "${wallet.name}"`, true);
      } catch (err) {
        log(`Wallet connection failed: ${String(err)}`, false);
      }
    });
    item.append(connectBtn);
    list.append(item);
  }
});

// ------------------------------------------------------------------ ballot --

const renderLedger = (l: Ledger): void => {
  $('ballot-view').hidden = false;
  $('voter-card').hidden = false;
  $('admin-card').hidden = false;

  $('ballot-title').textContent = l.title;

  const statusEl = $('ballot-status');
  statusEl.textContent = l.status === BallotStatus.OPEN ? 'open' : 'closed';
  statusEl.className = `badge ${l.status === BallotStatus.OPEN ? 'open' : 'closed'}`;

  const total = Number(l.yesVotes + l.noVotes + l.abstainVotes) || 1;
  const pct = (n: bigint) => `${(Number(n) / total) * 100}%`;

  $('count-yes').textContent = l.yesVotes.toString();
  $('count-no').textContent = l.noVotes.toString();
  $('count-abstain').textContent = l.abstainVotes.toString();
  $('bar-yes').style.width = pct(l.yesVotes);
  $('bar-no').style.width = pct(l.noVotes);
  $('bar-abstain').style.width = pct(l.abstainVotes);

  $('ballot-meta').textContent =
    `${l.ballotsCast} ballot(s) cast · admin ${l.adminRegistered ? 'registered' : 'not yet registered'}`;

  const nullifiers = Array.from(l.nullifiers).map((n) => toHex(n));
  $('observer-view').textContent = JSON.stringify(
    {
      title: l.title,
      status: l.status === BallotStatus.OPEN ? 'OPEN' : 'CLOSED',
      yesVotes: l.yesVotes.toString(),
      noVotes: l.noVotes.toString(),
      abstainVotes: l.abstainVotes.toString(),
      ballotsCast: l.ballotsCast.toString(),
      adminRegistered: l.adminRegistered,
      adminCommitment: toHex(l.adminCommitment),
      nullifiers,
    },
    null,
    2,
  );
};

const refresh = (): void => {
  if (!ballot) return;
  renderLedger(ballot.getLedger());
};

const renderIdentities = (): void => {
  $('voter-fingerprint').textContent = shortHex(voterKey);
  $('admin-fingerprint').textContent = shortHex(adminKey);
};

$('deploy-btn').addEventListener('click', async () => {
  const title = $<HTMLInputElement>('title-input').value.trim() || 'Untitled ballot';
  try {
    // Whoever deploys need not be the admin; registerAdmin() decides that.
    ballot = await BallotClient.deploy(title, createVoterPrivateState(randomSecretKey()));
    log(`Deployed ballot "${title}"`, true);
    refresh();
  } catch (err) {
    log(`Deploy failed: ${String(err)}`, false);
  }
});

$('new-ballot-btn').addEventListener('click', () => {
  ballot = null;
  $('ballot-view').hidden = true;
  $('voter-card').hidden = true;
  $('admin-card').hidden = true;
  $('observer-view').textContent = 'deploy a ballot to see its public ledger here';
});

$('new-voter-btn').addEventListener('click', () => {
  voterKey = resetIdentity('voter-1');
  renderIdentities();
  log('Switched to a brand-new voter identity', true);
});

// ------------------------------------------------------------------- vote --

const castVote = async (choice: Choice, label: string): Promise<void> => {
  if (!ballot) return;
  try {
    const asVoter = BallotClient.joinExisting(ballot, createVoterPrivateState(voterKey));
    await asVoter.castVote(choice);
    ballot = asVoter;
    log(`Vote cast: ${label}`, true);
  } catch (err) {
    log(`Vote rejected: ${String(err)}`, false);
  }
  refresh();
};

$('vote-yes-btn').addEventListener('click', () => castVote(Choice.YES, 'YES'));
$('vote-no-btn').addEventListener('click', () => castVote(Choice.NO, 'NO'));
$('vote-abstain-btn').addEventListener('click', () => castVote(Choice.ABSTAIN, 'ABSTAIN'));

// ------------------------------------------------------------------ admin --

$('register-admin-btn').addEventListener('click', async () => {
  if (!ballot) return;
  try {
    const asAdmin = BallotClient.joinExisting(ballot, createAdminPrivateState(adminKey));
    await asAdmin.registerAdmin();
    ballot = asAdmin;
    log('Registered as ballot admin', true);
  } catch (err) {
    log(`Admin registration failed: ${String(err)}`, false);
  }
  refresh();
});

$('close-ballot-btn').addEventListener('click', async () => {
  if (!ballot) return;
  try {
    const asAdmin = BallotClient.joinExisting(ballot, createAdminPrivateState(adminKey));
    await asAdmin.closeBallot();
    ballot = asAdmin;
    log('Ballot closed', true);
  } catch (err) {
    log(`Close failed: ${String(err)}`, false);
  }
  refresh();
});

renderIdentities();
