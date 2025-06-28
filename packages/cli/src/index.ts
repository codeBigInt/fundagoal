// import { webcrypto } from "crypto";
// import { WebSocket } from "ws"
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { stdin as input, stdout as output } from "node:process";

import { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { createInterface, Interface } from "node:readline/promises";
import { Logger } from "pino";
import {
  type Ledger,
  ledger,
  CrowdFundingPrivateState,
} from "@crowd-funding/crowd-funding-contract";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { type Config, StandaloneConfig } from "./config.js";
import {
  getLedgerNetworkId,
  getZswapNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import * as Rx from "rxjs";
import { type Wallet } from "@midnight-ntwrk/wallet-api";
import type {
  StartedDockerComposeEnvironment,
  DockerComposeEnvironment,
} from "testcontainers";
import { type Resource, WalletBuilder } from "@midnight-ntwrk/wallet";
import { Transaction as ZswapTransaction } from "@midnight-ntwrk/zswap";
import {
  nativeToken,
  Transaction,
  type CoinInfo,
  type TransactionId,
} from "@midnight-ntwrk/ledger";
import {
  type MidnightProvider,
  type WalletProvider,
  type UnbalancedTransaction,
  createBalancedTx,
  type BalancedTransaction,
  PrivateStateId,
} from "@midnight-ntwrk/midnight-js-types";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import * as fsAsync from "node:fs/promises";
import * as fs from "node:fs";
import { streamToString } from "testcontainers/build/common/streams.js";
import { webcrypto } from "node:crypto";
import {
  CrowdFundingAPI,
  CrowdFundingContractProviders,
  CrowdFundingPrivateStateId,
  DeployedCrowdFundingOnchainContract,
  DerivedCrowdFundingContractState,
} from "@crowd-funding/crowd-funding-api";

/**
 * publicDataProvider is used because it allows us retrieve ledger state variables
 * @param providers provides us with all api to interact with midnight blockchain
 * enable us read or update the state of our smart contract
 * @param contractAddress the address of the intend smart contract we intend to retrieve the state of.
 * @returns the state of our smart contract
 */
export const getStateraLedgerState = (
  providers: CrowdFundingContractProviders,
  contractAddress: ContractAddress
): Promise<Ledger | null> =>
  providers.publicDataProvider
    .queryContractState(contractAddress)
    .then((contractState) =>
      contractState != null ? ledger(contractState.data) : null
    );

const DEPLOY_OR_JOIN_QUESTION = `
    You can do one of the following:
    1. Deploy a statera stablecoin contract
    2. Join an existing one
    3. Exit
`;

const resolve = async (
  providers: CrowdFundingContractProviders,
  rli: Interface,
  logger: Logger
): Promise<CrowdFundingAPI | null> => {
  let api: CrowdFundingAPI | null = null;

  while (true) {
    const choice = await rli.question(DEPLOY_OR_JOIN_QUESTION);
    switch (choice) {
      case "1":
        api = await CrowdFundingAPI.deployCrowdFundingContract(
          providers,
          logger
        );
        logger.info(
          `Deployed contract at address: ${api.deployedContractAddress}`
        );
        return api;

      case "2":
        api = await CrowdFundingAPI.joinCrowdFundingContract(
          providers,
          await rli.question("What is the contract address (in hex)?"),
          logger
        );
        logger.info(
          `Joined contract at address: ${api.deployedContractAddress}`
        );
        return api;
    }
  }
};

const displayLedgerState = async (
  providers: CrowdFundingContractProviders,
  deployedStateraContract: DeployedCrowdFundingOnchainContract,
  logger: Logger
): Promise<void> => {
  const contractAddress =
    deployedStateraContract.deployTxData.public.contractAddress;
  const ledgerState = await getStateraLedgerState(providers, contractAddress);
  if (ledgerState === null) {
    logger.info(
      `There is no token mint contract deployed at ${contractAddress}`
    );
  } else {
    logger.info(
      `Current campaign pool deposits is: ${ledgerState.protocolTVL}`
    );
    logger.info(
      `Current protocol deposits is: ${ledgerState.protocolTVL.size()}`
    );
    logger.info(`Current available campaigns: ${ledgerState.campaigns}`);
  }
};

const displayDerivedLedgerState = async (
  currentState: DerivedCrowdFundingContractState,
  logger: Logger
): Promise<void> => {
  console.log(`Current campaign pool balance is:`, currentState.protocolTVL);
  console.log(`Current available campaigns:`, currentState.campaigns);
  console.log(`Current number of campaigns is:`, currentState.campaigns.length);
};

const getUserPrivateState = async (
  providers: CrowdFundingContractProviders
): Promise<CrowdFundingPrivateState | null> =>
  providers.privateStateProvider
    .get(CrowdFundingPrivateStateId)
    .then((privateState) => (privateState != null ? privateState : null));

const displayUserPrivateState = async (
  providers: CrowdFundingContractProviders,
  logger: Logger
) => {
  const privateState = await getUserPrivateState(providers);

  if (privateState === null)
    logger.info(
      `There is no private state stored at ${CrowdFundingPrivateStateId}`
    );
  logger.info(`Current secrete-key is: ${privateState?.secrete_key}`);
};
``;

// Updated menu with new option
const CIRCUIT_MAIN_LOOP_QUESTION = `
You can do one of the following:
  1. Display the current ledger state (known by everyone)
  2. Display the current derived ledger state (known by everyone)
  3. Display the current private state (known by you alone)
  4. Display comprehensive wallet state (NEW)
  5. Create new campaign
  6. End an existing campaign
  7. Cancel an existing campaign
  8. Update an existing campaign
  9. Fund a campaign
  10. Withdraw funds from your campaign
  11. Request refund from a campaign
  12. Exit

Which would you like to do? `;

const circuit_main_loop = async (
  wallet: Wallet & Resource,
  providers: CrowdFundingContractProviders,
  rli: Interface,
  logger: Logger
): Promise<void> => {
  const CrowdFundingAPI = await resolve(providers, rli, logger);
  if (CrowdFundingAPI === null) return;

  let currentState: DerivedCrowdFundingContractState | undefined;
  const stateObserver = {
    next: (state: DerivedCrowdFundingContractState) => {
      currentState = state;
    },
  };

  const subscription = CrowdFundingAPI.state.subscribe(stateObserver);

  try {
    while (true) {
      const choice = await rli.question(CIRCUIT_MAIN_LOOP_QUESTION);
      switch (choice) {
        case "1": {
          await displayLedgerState(providers, CrowdFundingAPI.allReadyDeployedContract, logger);
          break;
        }

        case "2": {
          await displayDerivedLedgerState(currentState!, logger);
          break;
        }

        case "3": {
          await displayUserPrivateState(providers, logger);
          break;
        }

        case "4": {
          // New option to manually check wallet state
          await displayComprehensiveWalletState(wallet, currentState, logger);
          break;
        }
        case "5": {
          await CrowdFundingAPI.createCampaign(
            await rli.question("Enter newly generated campaign id:"),
            await rli.question("Enter campaign title:"),
            await rli.question("Enter description for campaign:"),
            nativeToken(),
            Number(
              await rli.question("Enter duration for the campaign (days*):")
            ),
            Number(
              await rli.question("Enter duration for the campaign (days*):")
            )
          );

          // Wait for wallet to sync after deposit
          logger.info("Waiting for wallet to sync after creating campaign...");
          await waitForWalletSyncAfterOperation(wallet, logger);
          await displayComprehensiveWalletState(wallet, currentState, logger);
          break;
        }

        case "6": {
          await CrowdFundingAPI.endCampaign(
            await rli.question("Enter campaign id to end:")
          );

          // Wait for wallet to sync after deposit
          logger.info("Waiting for wallet to sync after ending campaign...");
          await waitForWalletSyncAfterOperation(wallet, logger);
          await displayComprehensiveWalletState(wallet, currentState, logger);
          break;
        }

        case "7": {
          await CrowdFundingAPI.cancelCampaign(
            await rli.question("Enter campaign id to cancel:")
          );

          // Wait for wallet to sync after deposit
          logger.info("Waiting for wallet to sync after cancling campaign...");
          await waitForWalletSyncAfterOperation(wallet, logger);
          await displayComprehensiveWalletState(wallet, currentState, logger);
          break;
        }

        case "8": {
          await CrowdFundingAPI.updateCampaign(
            await rli.question("Enter campaign id to update:"),
            Number(await rli.question("Enter new fund goal:")),
            Number(
              await rli.question("Enter new duration for the campaign (days*):")
            )
          );

          // Wait for wallet to sync after deposit
          logger.info("Waiting for wallet to sync after updating campaign...");
          await waitForWalletSyncAfterOperation(wallet, logger);
          await displayComprehensiveWalletState(wallet, currentState, logger);
          break;
        }

        case "9": {
          await CrowdFundingAPI.fundCampaign(
            await rli.question("Enter campaign id to update:"),
            Number(await rli.question("Enter amount you wish to donate:"))
          );

          // Wait for wallet to sync after deposit
          logger.info("Waiting for wallet to sync after funding campaign...");
          await waitForWalletSyncAfterOperation(wallet, logger);
          await displayComprehensiveWalletState(wallet, currentState, logger);
          break;
        }

        case "10": {
          await CrowdFundingAPI.withdrawCampaignFunds(
            await rli.question("Enter if for campaign to withdraw from:")
          );

          // Wait for wallet to sync after deposit
          logger.info("Waiting for wallet to sync after withdrawing campaign...");
          await waitForWalletSyncAfterOperation(wallet, logger);
          await displayComprehensiveWalletState(wallet, currentState, logger);
          break;
        }

        case "11": {
          await CrowdFundingAPI.requestRefund(
            await rli.question("Enter if for campaign to withdraw from:"),
            Number(await rli.question("Enter amount you wish to be refunded:")),
            Number(
              await rli.question("How much did you deposit:")
            )
          );

          // Wait for wallet to sync after deposit
          logger.info("Waiting for wallet to sync after withdrawing campaign...");
          await waitForWalletSyncAfterOperation(wallet, logger);
          await displayComprehensiveWalletState(wallet, currentState, logger);
          break;
        }

        case "12": {
          logger.info("Exiting.......");
          return;
        }

        default:
          logger.error(`Invalid choice: ${choice}`);
      }
    }
  } finally {
    subscription.unsubscribe();
  }
};

export const createWalletAndMidnightProvider = async (
  wallet: Wallet
): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(wallet.state());
  return {
    coinPublicKey: state.coinPublicKey,
    encryptionPublicKey: state.encryptionPublicKey,
    balanceTx(
      tx: UnbalancedTransaction,
      newCoins: CoinInfo[]
    ): Promise<BalancedTransaction> {
      return wallet
        .balanceTransaction(
          ZswapTransaction.deserialize(
            tx.serialize(getLedgerNetworkId()),
            getZswapNetworkId()
          ),
          newCoins
        )
        .then((tx) => wallet.proveTransaction(tx))
        .then((zswapTx) =>
          Transaction.deserialize(
            zswapTx.serialize(getZswapNetworkId()),
            getLedgerNetworkId()
          )
        )
        .then(createBalancedTx);
    },
    submitTx(tx: BalancedTransaction): Promise<TransactionId> {
      return wallet.submitTransaction(tx);
    },
  };
};

export const waitForSync = (wallet: Wallet, logger: Logger) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.tap((state) => {
        const applyGap = state.syncProgress?.lag.applyGap ?? 0n;
        const sourceGap = state.syncProgress?.lag.sourceGap ?? 0n;
        logger.info(
          `Waiting for funds. Backend lag: ${sourceGap}, wallet lag: ${applyGap}, transactions=${state.transactionHistory.length}`
        );
      }),
      Rx.filter((state) => {
        // Let's allow progress only if wallet is synced fully
        return state.syncProgress !== undefined && state.syncProgress.synced;
      })
    )
  );

export const waitForSyncProgress = async (wallet: Wallet, logger: Logger) =>
  await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.tap((state) => {
        const applyGap = state.syncProgress?.lag.applyGap ?? 0n;
        const sourceGap = state.syncProgress?.lag.sourceGap ?? 0n;
        logger.info(
          `Waiting for funds. Backend lag: ${sourceGap}, wallet lag: ${applyGap}, transactions=${state.transactionHistory.length}`
        );
      }),
      Rx.filter((state) => {
        // Let's allow progress only if syncProgress is defined
        return state.syncProgress !== undefined;
      })
    )
  );

export const waitForFunds = (wallet: Wallet, logger: Logger) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.tap((state) => {
        const applyGap = state.syncProgress?.lag.applyGap ?? 0n;
        const sourceGap = state.syncProgress?.lag.sourceGap ?? 0n;
        logger.info(
          `Waiting for funds. Backend lag: ${sourceGap}, wallet lag: ${applyGap}, transactions=${state.transactionHistory.length}`
        );
      }),
      Rx.filter((state) => {
        // Let's allow progress only if wallet is synced
        return state.syncProgress?.synced === true;
      }),
      Rx.map((s) => s.balances[nativeToken()] ?? 0n),
      Rx.filter((balance) => balance > 0n)
    )
  );

export const isAnotherChain = async (
  wallet: Wallet,
  offset: number,
  logger: Logger
) => {
  await waitForSyncProgress(wallet, logger);
  // Here wallet does not expose the offset block it is synced to, that is why this workaround
  const walletOffset = Number(JSON.parse(await wallet.serializeState()).offset);
  if (walletOffset < offset - 1) {
    logger.info(
      `Your offset offset is: ${walletOffset} restored offset: ${offset} so it is another chain`
    );
    return true;
  } else {
    logger.info(
      `Your offset offset is: ${walletOffset} restored offset: ${offset} ok`
    );
    return false;
  }
};

export const waitForTokenBalance = (
  wallet: Wallet,
  tokenType: string,
  minimumAmount: bigint,
  logger: Logger,
  timeoutMs: number = 30000
): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(2_000),
      Rx.tap((state) => {
        const balance = state.balances[tokenType] ?? 0n;
        const applyGap = state.syncProgress?.lag.applyGap ?? 0n;
        const sourceGap = state.syncProgress?.lag.sourceGap ?? 0n;
        logger.info(
          `Waiting for ${tokenType} balance. Current: ${balance}, Target: ${minimumAmount}, Backend lag: ${sourceGap}, Wallet lag: ${applyGap}`
        );
      }),
      Rx.filter((state) => {
        const balance = state.balances[tokenType] ?? 0n;
        return state.syncProgress?.synced === true && balance >= minimumAmount;
      }),
      Rx.map((state) => state.balances[tokenType] ?? 0n),
      Rx.timeout(timeoutMs)
    )
  );

// Enhanced function to wait for wallet sync after operations
export const waitForWalletSyncAfterOperation = async (
  wallet: Wallet,
  logger: Logger,
  timeoutMs: number = 30000
): Promise<void> => {
  try {
    await Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(1_000),
        Rx.tap((state) => {
          const applyGap = state.syncProgress?.lag.applyGap ?? 0n;
          const sourceGap = state.syncProgress?.lag.sourceGap ?? 0n;
          logger.info(
            `Syncing after operation. Backend lag: ${sourceGap}, Wallet lag: ${applyGap}`
          );
        }),
        Rx.filter((state) => {
          return state.syncProgress?.synced === true;
        }),
        Rx.timeout(timeoutMs)
      )
    );
    logger.info("Wallet sync completed after operation");
  } catch (error) {
    logger.warn(`Wallet sync timeout after ${timeoutMs}ms`);
  }
};

// Function to display comprehensive wallet state including all token types
const displayComprehensiveWalletState = async (
  wallet: Wallet,
  currentContractState: DerivedCrowdFundingContractState | undefined,
  logger: Logger
): Promise<void> => {
  const state = await Rx.firstValueFrom(wallet.state());

  logger.info("=== WALLET STATE ===");
  logger.info(`Address: ${state.address}`);
  logger.info(
    `Sync Status: ${state.syncProgress?.synced ? "SYNCED" : "SYNCING"}`
  );

  if (state.syncProgress) {
    logger.info(`Apply Gap: ${state.syncProgress.lag.applyGap}`);
    logger.info(`Source Gap: ${state.syncProgress.lag.sourceGap}`);
  }

  logger.info("=== TOKEN BALANCES ===");
  Object.entries(state.balances).forEach(([tokenType, balance]) => {
    if (tokenType === nativeToken()) {
      logger.info(`Native Token (tDUST): ${balance}`);
    }else {
      logger.info(`Token ${tokenType}: ${balance}`);
    }
  });

  logger.info(`Transaction History Count: ${state.transactionHistory.length}`);
  logger.info("===================");
};

export const buildEnhancedWalletAndWaitForFunds = async (
  config: Config,
  seed: string,
  filename: string,
  logger: Logger
): Promise<Wallet & Resource> => {
  // ... (keep existing wallet building logic)
  const wallet = await buildWalletAndWaitForFunds(
    config,
    seed,
    filename,
    logger
  );

  // Set up continuous state monitoring
  const stateSubscription = wallet
    .state()
    .pipe(Rx.throttleTime(60_000))
    .subscribe({
      next: (state) => {
        logger.info("Wallet state changed - balances updated");
        Object.entries(state.balances).forEach(([tokenType, balance]) => {
          if (balance > 0n) {
            logger.info(`${tokenType}: ${balance}`);
          }
        });
      },
    });

  // Store subscription reference for cleanup
  (wallet as any).__stateSubscription = stateSubscription;

  return wallet;
};

export const buildWalletAndWaitForFunds = async (
  { indexer, indexerWS, node, proofServer }: Config,
  seed: string,
  filename: string,
  logger: Logger
): Promise<Wallet & Resource> => {
  const directoryPath = process.env.SYNC_CACHE;
  let wallet: Wallet & Resource;
  if (directoryPath !== undefined) {
    if (fs.existsSync(`${directoryPath}/${filename}`)) {
      logger.info(
        `Attempting to restore state from ${directoryPath}/${filename}`
      );
      try {
        const serializedStream = fs.createReadStream(
          `${directoryPath}/${filename}`,
          "utf-8"
        );
        const serialized = await streamToString(serializedStream);
        serializedStream.on("finish", () => {
          serializedStream.close();
        });
        wallet = await WalletBuilder.restore(
          indexer,
          indexerWS,
          proofServer,
          node,
          seed,
          serialized,
          "info"
        );
        wallet.start();
        const stateObject = JSON.parse(serialized);
        if (
          (await isAnotherChain(wallet, Number(stateObject.offset), logger)) ===
          true
        ) {
          logger.warn("The chain was reset, building wallet from scratch");
          wallet = await WalletBuilder.build(
            indexer,
            indexerWS,
            proofServer,
            node,
            seed,
            getZswapNetworkId(),
            "info"
          );
          wallet.start();
        } else {
          const newState = await waitForSync(wallet, logger);
          // allow for situations when there's no new index in the network between runs
          if (newState.syncProgress?.synced) {
            logger.info("Wallet was able to sync from restored state");
          } else {
            logger.info(`Offset: ${stateObject.offset}`);
            logger.info(
              `SyncProgress.lag.applyGap: ${newState.syncProgress?.lag.applyGap}`
            );
            logger.info(
              `SyncProgress.lag.sourceGap: ${newState.syncProgress?.lag.sourceGap}`
            );
            logger.warn(
              "Wallet was not able to sync from restored state, building wallet from scratch"
            );
            wallet = await WalletBuilder.build(
              indexer,
              indexerWS,
              proofServer,
              node,
              seed,
              getZswapNetworkId(),
              "info"
            );
            wallet.start();
          }
        }
      } catch (error: unknown) {
        if (typeof error === "string") {
          logger.error(error);
        } else if (error instanceof Error) {
          logger.error(error.message);
        } else {
          logger.error(error);
        }
        logger.warn(
          "Wallet was not able to restore using the stored state, building wallet from scratch"
        );
        wallet = await WalletBuilder.build(
          indexer,
          indexerWS,
          proofServer,
          node,
          seed,
          getZswapNetworkId(),
          "info"
        );
        wallet.start();
      }
    } else {
      logger.info("Wallet save file not found, building wallet from scratch");
      wallet = await WalletBuilder.build(
        indexer,
        indexerWS,
        proofServer,
        node,
        seed,
        getZswapNetworkId(),
        "info"
      );
      wallet.start();
    }
  } else {
    logger.info(
      "File path for save file not found, building wallet from scratch"
    );
    wallet = await WalletBuilder.build(
      indexer,
      indexerWS,
      proofServer,
      node,
      seed,
      getZswapNetworkId(),
      "info"
    );
    wallet.start();
  }

  const state = await Rx.firstValueFrom(wallet.state());
  logger.info(`Your wallet seed is: ${seed}`);
  logger.info(`Your wallet address is: ${state.address}`);
  let balance = state.balances[nativeToken()];
  if (balance === undefined || balance === 0n) {
    logger.info(`Your wallet balance is: 0`);
    logger.info(`Waiting to receive tokens...`);
    balance = await waitForFunds(wallet, logger);
  }
  logger.info(`Your wallet balance is: ${balance}`);
  return wallet;
};

export const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  webcrypto.getRandomValues(bytes);
  return bytes;
};

// Generate a random see and create the wallet with that.
export const buildFreshWallet = async (
  config: Config,
  logger: Logger
): Promise<Wallet & Resource> =>
  await buildWalletAndWaitForFunds(config, toHex(randomBytes(32)), "", logger);

// Prompt for a seed and create the wallet with that.
const buildWalletFromSeed = async (
  config: Config,
  rli: Interface,
  logger: Logger
): Promise<Wallet & Resource> => {
  const seed = await rli.question("Enter your wallet seed: ");
  return await buildWalletAndWaitForFunds(config, seed, "", logger);
};

/* ***********************************************************************
 * This seed gives access to tokens minted in the genesis block of a local development node - only
 * used in standalone networks to build a wallet with initial funds.
 */
const GENESIS_MINT_WALLET_SEED =
  "0000000000000000000000000000000000000000000000000000000000000001";

const WALLET_LOOP_QUESTION = `
You can do one of the following:
  1. Build a fresh wallet
  2. Build wallet from a seed
  3. Exit
Which would you like to do? `;

const buildWallet = async (
  config: Config,
  rli: Interface,
  logger: Logger
): Promise<(Wallet & Resource) | null> => {
  if (config instanceof StandaloneConfig) {
    return await buildWalletAndWaitForFunds(
      config,
      GENESIS_MINT_WALLET_SEED,
      "",
      logger
    );
  }
  while (true) {
    const choice = await rli.question(WALLET_LOOP_QUESTION);
    switch (choice) {
      case "1":
        return await buildFreshWallet(config, logger);
      case "2":
        return await buildWalletFromSeed(config, rli, logger);
      case "3":
        logger.info("Exiting...");
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

const mapContainerPort = (
  env: StartedDockerComposeEnvironment,
  url: string,
  containerName: string
) => {
  const mappedUrl = new URL(url);
  const container = env.getContainer(containerName);

  mappedUrl.port = String(container.getFirstMappedPort());

  return mappedUrl.toString().replace(/\/+$/, "");
};

export const run = async (
  config: Config,
  logger: Logger,
  dockerEnv?: DockerComposeEnvironment
): Promise<void> => {
  const rli = createInterface({ input, output, terminal: true });
  let env;
  if (dockerEnv !== undefined) {
    env = await dockerEnv.up();

    if (config instanceof StandaloneConfig) {
      config.indexer = mapContainerPort(
        env,
        config.indexer,
        "crowd-funding-indexer"
      );
      config.indexerWS = mapContainerPort(
        env,
        config.indexerWS,
        "crowd-funding-indexer"
      );
      config.node = mapContainerPort(env, config.node, "crowd-funding-node");
      config.proofServer = mapContainerPort(
        env,
        config.proofServer,
        "crowd-funding-proof-server"
      );
    }
  }
  const wallet = await buildWallet(config, rli, logger);
  try {
    if (wallet !== null) {
      const walletAndMidnightProvider =
        await createWalletAndMidnightProvider(wallet);
      const providers = {
        privateStateProvider: levelPrivateStateProvider<PrivateStateId>({
          privateStateStoreName: config.privateStateStoreName as string,
        }),
        publicDataProvider: indexerPublicDataProvider(
          config.indexer,
          config.indexerWS
        ),
        zkConfigProvider: new NodeZkConfigProvider<never>(config.zkConfigPath),
        proofProvider: httpClientProofProvider(config.proofServer),
        walletProvider: walletAndMidnightProvider,
        midnightProvider: walletAndMidnightProvider,
      };
      await circuit_main_loop(wallet, providers, rli, logger);
    }
  } catch (e) {
    if (e instanceof Error) {
      logger.error(`Found error '${e.message}'`);
      logger.info("Exiting...");
      logger.debug(`${e.stack}`);
    } else {
      throw e;
    }
  } finally {
    try {
      rli.close();
      rli.removeAllListeners();
    } catch (e) {
    } finally {
      try {
        if (wallet !== null) {
          await wallet.close();
        }
      } catch (e) {
      } finally {
        try {
          if (env !== undefined) {
            await env.down();
            logger.info("Goodbye");
            process.exit(0);
          }
        } catch (e) {}
      }
    }
  }
};
