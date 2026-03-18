import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { stdin as input, stdout as output } from 'node:process';
import { encodeRawTokenType, encodeUserAddress, fromHex, toHex } from '@midnight-ntwrk/compact-runtime';
import { createInterface, Interface } from 'node:readline/promises';
import { Logger } from 'pino';
import { type Config, contractConfig, StandaloneConfig } from './config.js';
import type { StartedDockerComposeEnvironment, DockerComposeEnvironment } from 'testcontainers';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { buildWallet, createWalletAndMidnightProvider } from './wallet-utils.js';
import { CrowdFundingCircuitKeys, CrowdFundingContract, CrowdFundingContractProviders, CrowdFundingPrivateStateId, WalletContext } from './common-types.js';
import { CIRCUIT_INTERACTION_CHOICE, DEPLOY_OR_JOIN_QUESTION, HEADER_BANNER } from './userChoices.js';
import { DynamicContractAPI, utils } from 'nite-api';
import { Contract, Ledger, ledger, witnesses } from '@crowd-funding/crowd-funding-contract';
import { randomBytes } from "./utils.js"
import { nativeToken } from '@midnight-ntwrk/ledger';
import { firstValueFrom } from 'rxjs';

globalThis.WebSocket = WebSocket;
const SCALE_FACTOR = 1_000_000n;

const parseScaledAmountToBigint = (amount: string, scale: bigint = SCALE_FACTOR): bigint => {
  const value = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error(`Invalid amount "${amount}"`);
  }

  return BigInt(Number(value) * Number(scale));
};

const formatStateValue = (value: Ledger): unknown => {
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).map(([k, v]) => {
      console.log(`${k}:`, v)
    });
  }
  return value;
};

const displayLedgerState = async(
  api: DynamicContractAPI<CrowdFundingContract, CrowdFundingPrivateStateId>
) => {
  const [publicState, _] = await firstValueFrom(api.contractState);
  const ledgerState = ledger(publicState.data);

  if (ledgerState == null) {
    console.log('No contract state found');
    return;
  }

  formatStateValue(ledgerState);
  // console.dir(formatStateValue(ledgerState), { depth: null, colors: true });
};


const resolve = async (
  providers: CrowdFundingContractProviders,
  rli: Interface,
  logger: Logger,
): Promise<DynamicContractAPI<CrowdFundingContract, CrowdFundingPrivateStateId> | null> => {
  while (true) {
    const choice = await rli.question(DEPLOY_OR_JOIN_QUESTION);
    const compiledContract = utils.createCompiledContract(
      "crowd-funding",
      Contract,
      witnesses,
      contractConfig.zkConfigPath
    )
    switch (choice) {
      case '1': {
        return DynamicContractAPI.deploy<CrowdFundingContract, CrowdFundingPrivateStateId>({
          providers,
          compiledContract,
          initialPrivateState: {
            secrete_key: randomBytes(32)
          },
          privateStateId: "crowdFundingPrivateState"
        });

      }
      case '2': {
        const contractAddress = await rli.question('Please enter the contract address: ');
        return DynamicContractAPI.join<CrowdFundingContract, CrowdFundingPrivateStateId>({
          providers,
          compiledContract,
          initialPrivateState: {
            secrete_key: randomBytes(32)
          },
          privateStateId: "crowdFundingPrivateState",
          contractAddress
        });
      }
      case '3':
        return null;
      default:
        console.log('Invalid option. Select 1, 2, or 3.');
    }
  }
};

const runContractInteractionLoop = async (walletCtx: WalletContext, config: Config, rli: Interface, logger: Logger) => {
  const providers = await configureProviders(walletCtx, config);
  const api = await resolve(providers, rli, logger);

  if (api == null) throw Error('Failed to create contract API');
  await displayLedgerState(api);

  while (true) {
    const choice = await rli.question(CIRCUIT_INTERACTION_CHOICE);

    try {
      switch (choice) {
        case '1':
          const fundGoal = (await rli.question(`Enter a fund goal amount: `));
          const desc = (await rli.question(`Describe the reason for your campaign: `));
          const duration = (await rli.question(`Enter a duration for the capaign: `));
          const title = (await rli.question(`Enter a title for the capaign: `));
          await api.callTx(
            "createCampaign",
            randomBytes(32),
            parseScaledAmountToBigint(fundGoal),
            parseScaledAmountToBigint(duration),
            encodeRawTokenType(nativeToken()),
            BigInt(Date.now()),
            title,
            desc
          );
          break;
        case '2':
          await api.callTx(
            "cancelCampaign",
            fromHex((await rli.question(`Enter campaign id: `)).trim())
          );
          break;
        case '3':
          await api.callTx(
            "endCampaign",
            fromHex((await rli.question(`Enter campaign id: `)).trim()),
            encodeUserAddress((await walletCtx.wallet.unshielded.getAddress()).hexString)
          );
          break;
        case '4': {
          const fundGoal = (await rli.question(`Enter a fund goal amount: `));
          const desc = (await rli.question(`Describe the reason for your campaign: `));
          const duration = (await rli.question(`Enter a duration for the capaign: `));
          const title = (await rli.question(`Enter a title for the capaign: `));
          await api.callTx(
            "updateCampaign",
            fromHex((await rli.question(`Enter campaign id: `)).trim()),
            title,
            desc,
            parseScaledAmountToBigint(fundGoal),
            parseScaledAmountToBigint(duration)
          );
          break;
        }
        case '5': {
          await api.callTx(
            "withdrawCampaignFunds",
            fromHex((await rli.question(`Enter campaign id: `)).trim()),
            encodeUserAddress((await walletCtx.wallet.unshielded.getAddress()).hexString)
          );
          break;
        }
        case '6': {
          const amount = await rli.question(`Enter funding amount: `);
          await api.callTx(
            "fundCampaign",
            encodeRawTokenType(nativeToken()),
            parseScaledAmountToBigint(amount),
            fromHex((await rli.question(`Enter campaign id: `)).trim())
          );
          break;
        }
        case '7': {
          await api.callTx(
            "requestRefund",
            fromHex((await rli.question(`Enter campaign id: `)).trim()),
            parseScaledAmountToBigint(await rli.question(`Enter amount you want to be refunded: `)),
            parseScaledAmountToBigint(await rli.question(`Enter amount you deposited: `)),
            encodeUserAddress((await walletCtx.wallet.unshielded.getAddress()).hexString)
          );
          break;
        }
        case '8':
          await displayLedgerState(api);
          break;
        case '9':
          return;
        default:
          console.log('Invalid option. Select 1 to 8.');
          continue;
      }

      await displayLedgerState(api);
    } catch (error) {
      // const errMsg = error instanceof Error ? error.message : 'Unknown cli dapp error occured';
      console.error(error);
    } finally {
      rli.resume();
    }
  }
};

const configureProviders = async (ctx: WalletContext, config: Config): Promise<CrowdFundingContractProviders> => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx, config);
  const privateStateStoreName = `${config.privateStateStoreName}-${config.networkId}-lenders-v1`;
  const zkConfigProvider = new NodeZkConfigProvider<CrowdFundingCircuitKeys>(config.zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider<typeof CrowdFundingPrivateStateId>({
      privateStateStoreName,
      walletProvider: walletAndMidnightProvider,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider: zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};

const mapContainerPort = (
  env: StartedDockerComposeEnvironment,
  url: string,
  containerNames: string[],
) => {
  const mappedUrl = new URL(url);
  let container: ReturnType<StartedDockerComposeEnvironment['getContainer']> | undefined;

  for (const name of containerNames) {
    try {
      container = env.getContainer(name);
      break;
    } catch {
    }
  }

  if (container === undefined) {
    throw new Error(`Failed to resolve running container from [${containerNames.join(', ')}]`);
  }

  mappedUrl.port = String(container.getFirstMappedPort());
  return mappedUrl.toString().replace(/\/+$/, '');
};

export const run = async (config: Config, logger: Logger, dockerEnv?: DockerComposeEnvironment): Promise<void> => {
  const rli = createInterface({ input, output, terminal: true });
  let env: StartedDockerComposeEnvironment | undefined;

  try {
    if (dockerEnv !== undefined) {
      env = await dockerEnv.up();

      if (config instanceof StandaloneConfig) {
        config.indexer = mapContainerPort(env, config.indexer, ['crowd-funding-indexer', 'indexer']);
        config.indexerWS = mapContainerPort(env, config.indexerWS, ['crowd-funding-indexer', 'indexer']);
        config.node = mapContainerPort(env, config.node, ['crowd-funding-node', 'node']);
        config.proofServer = mapContainerPort(env, config.proofServer, ['crowd-funding-proof-server', 'proof-server']);
      }
    }

    const walletCtx = await buildWallet(config, rli);
    if (walletCtx == null) {
      return;
    }

    try {
      console.log(HEADER_BANNER);
      await runContractInteractionLoop(walletCtx, config, rli, logger);
    } finally {
      await walletCtx.wallet.stop();
    }
  } finally {
    rli.close();
    rli.removeAllListeners();

    if (env !== undefined) {
      await env.down();
    }

    logger.info('Goodbye.');
  }
};
