import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { Interface } from "node:readline/promises"
import { WalletContext } from "./common-types";
import { mnemonicToSeed } from "@scure/bip39";
import { generateRandomSeed, HDWallet, Roles } from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import * as ledger from "@midnight-ntwrk/ledger-v7";
import { createKeystore, InMemoryTransactionHistoryStorage, PublicKey, UnshieldedKeystore, UnshieldedWallet } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { DustWallet, UtxoWithMeta } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import { filter, firstValueFrom, map, tap, throttleTime } from "rxjs";
import { CREATE_WALLET_CHOICE } from "./userChoices.js";
import { Config } from "./config";
import { fromHex, toHex } from "@midnight-ntwrk/compact-runtime";
import { choice } from "fp-ts";
import { MidnightProvider, WalletProvider } from "@midnight-ntwrk/midnight-js-types";
import { MidnightBech32m, ShieldedAddress, ShieldedCoinPublicKey, ShieldedEncryptionPublicKey } from "@midnight-ntwrk/wallet-sdk-address-format";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { u8aToHex } from "@polkadot/util";


export async function buildWalletFromMnemonics(rli: Interface, config: Config): Promise<WalletContext> {
    console.log(`Building wallet from mnemonic passphrase...`);
    const mnemonics = await rli.question(`Enter your wallet passphrase (24 words): `);
    const seed = await mnemonicToSeed(mnemonics);
    return await buildWalletAndWaitForFunds(config, toHex(seed));
}

export async function buildWalletFromGenSeed(rli: Interface, config: Config): Promise<WalletContext> {
    console.log(`Building wallet from genesis mint wallet seed...`);
    const GENESIS_SEED = `0000000000000000000000000000000000000000000000000000000000000001`;
    const seed = fromHex(GENESIS_SEED);
    return await buildWalletAndWaitForFunds(config, toHex(seed));
}


const buildShieldedConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
});

const buildUnshieldedConfig = ({ indexer, indexerWS }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

const buildDustConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  costParameters: {
    additionalFeeOverhead: 300_000_000_000_000n,
    feeBlocksMargin: 5,
  },
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
});

const toRelayWsUrl = (nodeUrl: string): string => nodeUrl.replace(/^http/, "ws");

const submitFinalizedTransaction = async (
  tx: { serialize(): Uint8Array; identifiers(): string[] },
  nodeUrl: string,
): Promise<string> => {
  const txId = tx.identifiers()[0];
  if (!txId) {
    throw new Error("Finalized transaction did not expose any transaction identifiers");
  }

  const api = await ApiPromise.create({
    provider: new WsProvider(toRelayWsUrl(nodeUrl)),
    throwOnConnect: false,
    noInitWarn: true,
  });

  try {
    await new Promise<void>((resolve, reject) => {
      let completed = false;
      let unsubscribe: (() => void) | undefined;

      const finish = (fn: () => void) => {
        if (completed) return;
        completed = true;
        try {
          unsubscribe?.();
        } catch {
        }
        fn();
      };

      void api.tx.midnight
        .sendMnTransaction(u8aToHex(tx.serialize()))
        .send((result: any) => {
          const status = result.status;

          if (status.isInBlock || status.isFinalized) {
            finish(resolve);
            return;
          }

          if (status.isInvalid) {
            finish(() => reject(new Error("Transaction was marked invalid by the node")));
            return;
          }

          if (status.isDropped) {
            finish(() => reject(new Error("Transaction was dropped by the node")));
            return;
          }

          if (status.isUsurped) {
            finish(() => reject(new Error("Transaction was usurped by another transaction")));
          }
        })
        .then((unsub: () => void) => {
          unsubscribe = unsub;
        })
        .catch((error: unknown) => {
          finish(() => reject(error));
        });
    });

    return txId;
  } finally {
    await api.disconnect();
  }
};


/**
 * Build (or restore) a wallet from a hex seed, then wait for the wallet
 * to sync and receive funds before returning.
 *
 * Steps:
 *   1. Derive HD keys (Zswap, NightExternal, Dust) from the seed
 *   2. Create the three sub-wallets (Shielded, Unshielded, Dust)
 *   3. Start the WalletFacade and wait for sync
 *   4. Display a wallet summary with all addresses
 *   5. If balance is zero, wait for incoming funds (e.g. from faucet)
 */
export const buildWalletAndWaitForFunds = async (config: Config, seed: string): Promise<WalletContext> => {
  console.log('');

  // Derive HD keys and initialize the three sub-wallets
  const { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore } = await withStatus(
    'Building wallet',
    async () => {
      const keys = deriveKeysFromSeed(seed);
      const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
      const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
      const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

      const shieldedWallet = ShieldedWallet(buildShieldedConfig(config)).startWithSecretKeys(shieldedSecretKeys);
      const unshieldedWallet = UnshieldedWallet(buildUnshieldedConfig(config)).startWithPublicKey(
        PublicKey.fromKeyStore(unshieldedKeystore),
      );
      const dustWallet = DustWallet(buildDustConfig(config)).startWithSecretKey(
        dustSecretKey,
        ledger.LedgerParameters.initialParameters().dust,
      );

      const wallet = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
      await wallet.start(shieldedSecretKeys, dustSecretKey);

      return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
    },
  );

  // Show seed and unshielded address immediately so user can fund via faucet while syncing
  const networkId = getNetworkId();
  const DIV = '──────────────────────────────────────────────────────────────';
  console.log(`
${DIV}
  Wallet Overview                            Network: ${networkId}
${DIV}
  Seed: ${seed}

  Unshielded Address (send tNight here):
  ${unshieldedKeystore.getBech32Address()}

  Fund your wallet with tNight from the Preprod faucet:
  https://faucet.preprod.midnight.network/
${DIV}
`);

  // Wait for the wallet to sync with the network
  const syncedState = await withStatus('Syncing with network', () => waitForSync(wallet));

  // Display the full wallet summary with all addresses and balances
  printWalletSummary(seed, syncedState, unshieldedKeystore);

  // Check if wallet has funds; if not, wait for incoming tokens
  const balance = syncedState.unshielded.balances[ledger.unshieldedToken().raw] ?? 0n;
  if (balance === 0n) {
    const fundedBalance = await withStatus('Waiting for incoming tokens', () => waitForFunds(wallet));
    console.log(`    Balance: ${formatBalance(fundedBalance)} tNight\n`);
  }

  // Register NIGHT UTXOs for dust generation (required for tx fees on Preprod/Preview)
  await registerForDustGeneration(wallet, unshieldedKeystore, config);
  await ensureShieldedBalance(wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore, config);
  await printFundingReadiness(wallet);

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
};

export const buildFreshWallet = async (config: Config): Promise<WalletContext> =>
  await buildWalletAndWaitForFunds(config, toHex(Buffer.from(generateRandomSeed())));

/**
 * Get the current DUST balance from the wallet state.
 */
export const getDustBalance = async (
  wallet: WalletFacade,
): Promise<{ available: bigint; pending: bigint; availableCoins: number; pendingCoins: number }> => {
  const state = await firstValueFrom(wallet.state().pipe(filter((s) => s.isSynced)));
  const available = state.dust.walletBalance(new Date());
  const availableCoins = state.dust.availableCoins.length;
  const pendingCoins = state.dust.pendingCoins.length;
  // Sum pending coin initial values for a rough pending balance
  const pending = state.dust.pendingCoins.reduce((sum, c) => sum + c.initialValue, 0n);
  return { available, pending, availableCoins, pendingCoins };
};


/** Wait until the wallet has fully synced with the network. Returns the synced state. */
export const waitForSync = (wallet: WalletFacade) =>
  firstValueFrom(
    wallet.state().pipe(
      throttleTime(5_000),
      filter((state) => state.isSynced),
    ),
  );

/** Wait until the wallet has a non-zero unshielded balance. Returns the balance. */
export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  firstValueFrom(
    wallet.state().pipe(
      throttleTime(10_000),
      filter((state) => state.isSynced),
      map((s) => s.unshielded.balances[ledger.unshieldedToken().raw] ?? 0n),
      filter((balance) => balance > 0n),
    ),
  );

/**
 * Display wallet balances (unshielded, shielded, total)
 */
export const displayWalletBalances = async (
    wallet: WalletFacade,
): Promise<{ unshielded: any; shielded: bigint; total: bigint }> => {
    const state = await firstValueFrom(wallet.state());
    const unshielded = state.unshielded?.balances[ledger.nativeToken().raw] ?? 0n;
    const shielded = state.shielded?.balances[ledger.nativeToken().raw] ?? 0n;
    const total = unshielded + shielded;

    console.info(`Unshielded balance: ${unshielded} tSTAR`);
    console.info(`Shielded balance: ${shielded} tSTAR`);
    console.info(`Total balance: ${total} tSTAR`);

    return { unshielded, shielded, total };
};

/**
 * Derive HD wallet keys for all three roles (Zswap, NightExternal, Dust)
 * from a hex-encoded seed using BIP-44 style derivation at account 0, index 0.
 */
const deriveKeysFromSeed = (seed: string) => {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') {
    throw new Error('Failed to initialize HDWallet from seed');
  }

  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (derivationResult.type !== 'keysDerived') {
    throw new Error('Failed to derive keys');
  }

  hdWallet.hdWallet.clear();
  return derivationResult.keys;
};


/**
 * Formats a token balance for display (e.g. 1000000000 -> "1,000,000,000").
 */
const formatBalance = (balance: bigint): string => balance.toLocaleString();

/**
 * Runs an async operation with an animated spinner on the console.
 * Shows ⠋⠙⠹... while running, then ✓ on success or ✗ on failure.
 */
export const withStatus = async <T>(message: string, fn: () => Promise<T>): Promise<T> => {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${frames[i++ % frames.length]} ${message}`);
  }, 80);
  try {
    const result = await fn();
    clearInterval(interval);
    process.stdout.write(`\r  ✓ ${message}\n`);
    return result;
  } catch (e) {
    clearInterval(interval);
    process.stdout.write(`\r  ✗ ${message}\n`);
    throw e;
  }
};


/**
 * Register unshielded NIGHT UTXOs for dust generation.
 *
 * On Preprod/Preview, NIGHT tokens generate DUST over time, but only after
 * the UTXOs have been explicitly designated for dust generation via an on-chain
 * transaction. DUST is the non-transferable fee token used by the Midnight network.
 */
const registerForDustGeneration = async (
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
  config: Config,
): Promise<void> => {
  const state = await firstValueFrom(wallet.state().pipe(filter((s) => s.isSynced)));

  // Check if dust is already available (e.g. from a previous designation)
  if (state.dust.availableCoins.length > 0) {
    const dustBal = state.dust.walletBalance(new Date());
    console.log(`  ✓ Dust tokens already available (${formatBalance(dustBal)} DUST)`);
    return;
  }

  // Only register coins that haven't been designated yet
  const nightUtxos = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true,
  );
  if (nightUtxos.length === 0) {
    // All coins already registered — just wait for dust to generate
    await withStatus('Waiting for dust tokens to generate', () =>
      firstValueFrom(
        wallet.state().pipe(
          throttleTime(5_000),
          filter((s) => s.isSynced),
          filter((s) => s.dust.walletBalance(new Date()) > 0n),
        ),
      ),
    );
    return;
  }

  await withStatus(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation`, async () => {
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      unshieldedKeystore.getPublicKey(),
      (payload) => unshieldedKeystore.signData(payload),
    );
    const finalized = await wallet.finalizeRecipe(recipe);
    await submitFinalizedTransaction(finalized, config.node);
  });

  // Wait for dust to actually generate (balance > 0), not just for coins to appear
  await withStatus('Waiting for dust tokens to generate', () =>
    firstValueFrom(
      wallet.state().pipe(
        throttleTime(5_000),
        filter((s) => s.isSynced),
        filter((s) => s.dust.walletBalance(new Date()) > 0n),
      ),
    ),
  );
};

export async function buildWallet(config: Config, rli: Interface): Promise<WalletContext | undefined> {
    let walletContext: WalletContext | undefined;
    const userWalletChoice = await rli.question(CREATE_WALLET_CHOICE);
    switch (userWalletChoice) {
        case "1": {
            walletContext = await buildFreshWallet(config);
            break;
        }
        case "2": {
            walletContext = await buildWalletFromMnemonics(rli, config)
            break;
        }
        case "3": {
            walletContext = await buildWalletFromGenSeed(rli, config)
            break;
        }
        case "4": {
            /** Exit the cli interface */
            console.log(`Exiting cli dapp....`);
            rli.close();
        }
        default: {
            console.error(`Invalid option selected ${choice}`)
        }
    }

    return walletContext;
}



/**
 * Sign all unshielded offers in a transaction's intents, using the correct
 * proof marker for Intent.deserialize. This works around a bug in the wallet
 * SDK where signRecipe hardcodes 'pre-proof', which fails for proven
 * (UnboundTransaction) intents that contain 'proof' data.
 */
const signTransactionIntents = (
  tx: { intents?: Map<number, any> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: 'proof' | 'pre-proof',
): void => {
  if (!tx.intents || tx.intents.size === 0) return;

  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;

    // Clone the intent with the correct proof marker.
    // The wallet SDK bug hardcodes 'pre-proof' here, which fails for
    // proven (UnboundTransaction) intents that use 'proof'.
    const cloned = ledger.Intent.deserialize<ledger.SignatureEnabled, ledger.Proofish, ledger.PreBinding>(
      'signature',
      proofMarker,
      'pre-binding',
      intent.serialize(),
    );

    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);

    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }

    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }

    tx.intents.set(segment, cloned);
  }
};


/**
 * Prints a formatted wallet summary to the console, showing all three
 * wallet types (Shielded, Unshielded, Dust) with their addresses and balances.
 */
const printWalletSummary = (seed: string, state: any, unshieldedKeystore: UnshieldedKeystore) => {
  const networkId = getNetworkId();
  const unshieldedBalance = state.unshielded.balances[ledger.unshieldedToken().raw] ?? 0n;

  // Build the bech32m shielded address from coin + encryption public keys
  const coinPubKey = ShieldedCoinPublicKey.fromHexString(state.shielded.coinPublicKey.toHexString());
  const encPubKey = ShieldedEncryptionPublicKey.fromHexString(state.shielded.encryptionPublicKey.toHexString());
  const shieldedAddress = MidnightBech32m.encode(networkId, new ShieldedAddress(coinPubKey, encPubKey)).toString();

  const DIV = '──────────────────────────────────────────────────────────────';

  console.log(`
${DIV}
  Wallet Overview                            Network: ${networkId}
${DIV}
  Seed: ${seed}
${DIV}

  Shielded (ZSwap)
  └─ Address: ${shieldedAddress}

  Unshielded
  ├─ Address: ${unshieldedKeystore.getBech32Address()}
  └─ Balance: ${formatBalance(unshieldedBalance)} tNight

  Dust
  └─ Address: ${state.dust.dustAddress}

${DIV}`);
};

const buildShieldedAddress = (state: any): string => {
  const networkId = getNetworkId();
  const coinPubKey = ShieldedCoinPublicKey.fromHexString(state.shielded.coinPublicKey.toHexString());
  const encPubKey = ShieldedEncryptionPublicKey.fromHexString(state.shielded.encryptionPublicKey.toHexString());
  return MidnightBech32m.encode(networkId, new ShieldedAddress(coinPubKey, encPubKey)).toString();
};

const ensureShieldedBalance = async (
  wallet: WalletFacade,
  shieldedSecretKeys: ledger.ZswapSecretKeys,
  dustSecretKey: ledger.DustSecretKey,
  unshieldedKeystore: UnshieldedKeystore,
  config: Config,
): Promise<void> => {
  const state = await firstValueFrom(wallet.state().pipe(filter((s) => s.isSynced)));
  const tokenType = ledger.nativeToken().raw;
  const shieldedBalance = state.shielded?.balances[tokenType] ?? 0n;
  if (shieldedBalance > 0n) return;

  const unshieldedBalance = state.unshielded?.balances[tokenType] ?? 0n;
  if (unshieldedBalance <= 0n) return;

  const amount = unshieldedBalance > 10_000_000n ? 10_000_000n : unshieldedBalance;
  const shieldedAddress = buildShieldedAddress(state);

  await withStatus("Creating initial shielded funds", async () => {
    const recipe = await wallet.initSwap(
      { unshielded: { [tokenType]: amount } },
      [
        {
          type: "shielded",
          outputs: [{ type: tokenType, receiverAddress: shieldedAddress, amount }],
        },
      ],
      { shieldedSecretKeys, dustSecretKey },
      { ttl: new Date(Date.now() + 30 * 60 * 1000), payFees: true },
    );

    const signFn = (payload: Uint8Array) => unshieldedKeystore.signData(payload);
    const signedRecipe = await wallet.signRecipe(recipe, signFn);
    const finalized = await wallet.finalizeRecipe(signedRecipe);
    await submitFinalizedTransaction(finalized, config.node);
  });

  await withStatus("Waiting for shielded funds", () =>
    firstValueFrom(
      wallet.state().pipe(
        throttleTime(2_000),
        filter((s) => s.isSynced),
        filter((s) => (s.shielded?.balances[tokenType] ?? 0n) > 0n),
      ),
    ),
  );
};

const printFundingReadiness = async (wallet: WalletFacade): Promise<void> => {
  const state = await firstValueFrom(wallet.state().pipe(filter((s) => s.isSynced)));
  const tokenType = ledger.nativeToken().raw;
  const unshieldedBalance = state.unshielded?.balances[tokenType] ?? 0n;
  const shieldedBalance = state.shielded?.balances[tokenType] ?? 0n;
  const shieldedCoins = state.shielded?.availableCoins?.length ?? 0;

  console.log(`  Wallet funding check:`);
  console.log(`  - Unshielded: ${formatBalance(unshieldedBalance)} tNight`);
  console.log(`  - Shielded: ${formatBalance(shieldedBalance)} tNight (${shieldedCoins} available coin(s))`);
  if (shieldedBalance === 0n || shieldedCoins === 0) {
    console.log(`  WARNING: No spendable shielded coins. Circuits that call receiveShielded (e.g. supply/createLoanRequest) can fail.`);
  }
};


/**
 * Create the unified WalletProvider & MidnightProvider for midnight-js.
 * This bridges the wallet-sdk-facade to the midnight-js contract API by
 * implementing balance, sign, finalize, and submit operations.
 */
export const createWalletAndMidnightProvider = async (
  ctx: WalletContext,
  config: Config,
): Promise<WalletProvider & MidnightProvider> => {
  const state = await firstValueFrom(ctx.wallet.state().pipe(filter((s) => s.isSynced)));
  return {
    getCoinPublicKey() {
      return state.shielded.coinPublicKey.toHexString();
    },
    getEncryptionPublicKey() {
      return state.shielded.encryptionPublicKey.toHexString();
    },
    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );

      // Work around wallet SDK bug: signRecipe uses hardcoded 'pre-proof'
      // marker when cloning intents, but proven (UnboundTransaction) intents
      // have 'proof' data, causing "Failed to clone intent". We sign manually
      // with the correct proof markers.
      const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      }

      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx(tx) {
      return submitFinalizedTransaction(tx, config.node) as any;
    },
  };
};



/**
 * Monitor DUST balance with a live-updating display.
 * Prints a status line every 5 seconds showing balance, coins, and status.
 * Resolves when the user presses Enter (via the provided signal).
 */
export const monitorDustBalance = async (wallet: WalletFacade, stopSignal: Promise<void>): Promise<void> => {
  let stopped = false;
  void stopSignal.then(() => {
    stopped = true;
  });

  const sub = wallet
    .state()
    .pipe(
      throttleTime(5_000),
      filter((s) => s.isSynced),
    )
    .subscribe((state) => {
      if (stopped) return;

      const now = new Date();
      const available = state.dust.walletBalance(now);
      const availableCoins = state.dust.availableCoins.length;
      const pendingCoins = state.dust.pendingCoins.length;

      const registeredNight = state.unshielded.availableCoins.filter(
        (coin: any) => coin.meta?.registeredForDustGeneration === true,
      ).length;
      const totalNight = state.unshielded.availableCoins.length;

      let status = '';
      if (pendingCoins > 0 && availableCoins === 0) {
        status = '⚠ locked by pending tx';
      } else if (available > 0n) {
        status = '✓ ready to deploy';
      } else if (availableCoins > 0) {
        status = 'accruing...';
      } else if (registeredNight > 0) {
        status = 'waiting for generation...';
      } else {
        status = 'no NIGHT registered';
      }

      const time = now.toLocaleTimeString();
      console.log(
        `  [${time}] DUST: ${formatBalance(available)} (${availableCoins} coins, ${pendingCoins} pending) | NIGHT: ${totalNight} UTXOs, ${registeredNight} registered | ${status}`,
      );
    });

  await stopSignal;
  sub.unsubscribe();
};
