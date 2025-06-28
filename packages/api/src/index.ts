import { combineLatest, concat, from, map, Observable, tap } from "rxjs";

import { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import {
  deployContract,
  FinalizedCallTxData,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import {
  Contract,
  ledger,
  CrowdFundingPrivateState,
  witnesses,
  CoinInfo,
  createCrowdFundingPrivateState,
} from "@crowd-funding/crowd-funding-contract";
import { type Logger } from "pino";
import * as utils from "./utils.js";
import { encodeTokenType, nativeToken } from "@midnight-ntwrk/ledger";
import {
  CrowdFundingContract,
  CrowdFundingContractProviders,
  CrowdFundingPrivateStateId,
  DeployedCrowdFundingOnchainContract,
  DerivedCrowdFundingContractState,
} from "./common-types.js";

const CrowdFundingContractInstance: CrowdFundingContract = new Contract(
  witnesses
);

export interface DeployedCrowdFundingAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state: Observable<DerivedCrowdFundingContractState>;
  createCampaign: (
    _campaignID: string,
    title: string,
    desc: string,
    coinType: string,
    duration: number,
    fundGoal: number
  ) => Promise<FinalizedCallTxData<CrowdFundingContract, "createCampaign">>;
  withdrawCampaignFunds: (_campaignID: string) => Promise<FinalizedCallTxData<CrowdFundingContract, "withdrawCampaignFunds">>;
  fundCampaign: (_campaignID: string, amount: number) => Promise<FinalizedCallTxData<CrowdFundingContract, "fundCampaign">>;
  endCampaign: (_campaignID: string) => Promise<FinalizedCallTxData<CrowdFundingContract, "endCampaign">>;
  cancelCampaign: (_campaignID: string) => Promise<FinalizedCallTxData<CrowdFundingContract, "cancelCampaign">>;
  requestRefund: (_campaignID: string, refund_amount: number, amountDeposited: number) => Promise<FinalizedCallTxData<CrowdFundingContract, "requestRefund">>;
  updateCampaign: (_campaignID: string, fundGoal: number, duration: number) => Promise<FinalizedCallTxData<CrowdFundingContract, "updateCampaign">>;
}
/**
 * NB: Declaring a class implements a given type, means it must contain all defined properties and methods, then take on other extra properties or class
 */

export class CrowdFundingAPI implements DeployedCrowdFundingAPI {
  deployedContractAddress: string;
  state: Observable<DerivedCrowdFundingContractState>;

  // Within the constructor set the two properties of the API Class Object
  // Using access modifiers on parameters create a property instances for that parameter and stores it as part of the object
  /**
   * @param allReadyDeployedContract
   * @param logger becomes accessible s if they were decleared as static properties as part of the class
   */
  private constructor(
    providers: CrowdFundingContractProviders,
    public readonly allReadyDeployedContract: DeployedCrowdFundingOnchainContract,
    private logger?: Logger
  ) {
    this.deployedContractAddress =
      allReadyDeployedContract.deployTxData.public.contractAddress;

    // Set the state property
    this.state = combineLatest(
      [
        providers.publicDataProvider
          .contractStateObservable(this.deployedContractAddress, {
            type: "all",
          })
          .pipe(
            map((contractState) => ledger(contractState.data)),
            tap((ledgerState) =>
              logger?.trace({
                ledgerStaeChanged: {
                  ledgerState: {
                    ...ledgerState,
                  },
                },
              })
            )
          ),
        concat(
          from(providers.privateStateProvider.get(CrowdFundingPrivateStateId))
        ),
      ],
      (ledgerState, privateState) => {
        return {
          protocolTVL: utils.createDeriveProtocolTVLArray(
            ledgerState.protocolTVL
          ),
          campaigns: utils.createDerivedCampaignsArray(ledgerState.campaigns),
        };
      }
    );
  }

  static async deployCrowdFundingContract(
    providers: CrowdFundingContractProviders,
    logger?: Logger
  ): Promise<CrowdFundingAPI> {
    logger?.info("deploy contract");
    /**
     * Should deploy a new contract to the blockchain
     * Return the newly deployed contract
     * Log the resulting data about of the newly deployed contract using (logger)
     */
    const deployedContract = await deployContract<CrowdFundingContract>(
      providers,
      {
        contract: CrowdFundingContractInstance,
        initialPrivateState: await CrowdFundingAPI.getPrivateState(providers),
        privateStateId: CrowdFundingPrivateStateId,
      }
    );

    logger?.trace("Deployment successfull", {
      contractDeployed: {
        finalizedDeployTxData: deployedContract.deployTxData.public,
      },
    });

    return new CrowdFundingAPI(providers, deployedContract, logger);
  }

  static async joinCrowdFundingContract(
    providers: CrowdFundingContractProviders,
    contractAddress: string,
    logger?: Logger
  ): Promise<CrowdFundingAPI> {
    logger?.info({
      joinContract: {
        contractAddress,
      },
    });
    /**
     * Should deploy a new contract to the blockchain
     * Return the newly deployed contract
     * Log the resulting data about of the newly deployed contract using (logger)
     */
    const existingContract = await findDeployedContract<CrowdFundingContract>(
      providers,
      {
        contract: CrowdFundingContractInstance,
        contractAddress: contractAddress,
        privateStateId: CrowdFundingPrivateStateId,
        initialPrivateState: await CrowdFundingAPI.getPrivateState(providers),
      }
    );

    logger?.trace("Found Contract...", {
      contractJoined: {
        finalizedDeployTxData: existingContract.deployTxData.public,
      },
    });
    return new CrowdFundingAPI(providers, existingContract, logger);
  }

  coin(amount: number): CoinInfo {
    return {
      color: encodeTokenType(nativeToken()),
      nonce: utils.randomNonceBytes(32),
      value: BigInt(amount),
    };
  }

  async createCampaign(
    _campaignID: string,
    title: string,
    desc: string,
    coinType: string,
    duration: number,
    fundGoal: number
  ): Promise<FinalizedCallTxData<CrowdFundingContract, "createCampaign">> {
    this.logger?.info(`Creating campaign with id ${_campaignID}....`);

    const txData = await this.allReadyDeployedContract.callTx.createCampaign(
      utils.hexStringToUint8Array(_campaignID),
      BigInt(fundGoal),
      BigInt(duration),
      encodeTokenType(coinType),
      BigInt(Date.now()),
      title,
      desc
    );

    this.logger?.trace({
      transactionAdded: {
        circuit: "createCampaign",
        txHash: txData.public.txHash,
        blockDetails: {
          blockHash: txData.public.blockHash,
          blockHeight: txData.public.blockHeight,
        },
      },
    });
    return txData;
  }

  async fundCampaign(_campaignID: string, amount: number): Promise<FinalizedCallTxData<CrowdFundingContract, "fundCampaign">> {
    this.logger?.info(`Funding campaign with id ${_campaignID}...`);

    const txData = await this.allReadyDeployedContract.callTx.fundCampaign(
      this.coin(amount),
      utils.hexStringToUint8Array(_campaignID),
    );

    this.logger?.trace({
      transactionAdded: {
        circuit: "fundCampaign",
        txHash: txData.public.txHash,
        blockDetails: {
          blockHash: txData.public.blockHash,
          blockHeight: txData.public.blockHeight,
        },
      },
    });

    return txData;
  }

  async endCampaign(_campaignID: string): Promise<FinalizedCallTxData<CrowdFundingContract, "endCampaign">> {
    this.logger?.info(`Ending campaign with id ${_campaignID}...`);

    const txData = await this.allReadyDeployedContract.callTx.endCampaign(
      utils.hexStringToUint8Array(_campaignID)
    );

    this.logger?.trace({
      transactionAdded: {
        circuit: "endCampaign",
        txHash: txData.public.txHash,
        blockDetails: {
          blockHash: txData.public.blockHash,
          blockHeight: txData.public.blockHeight,
        },
      },
    });
    return txData;
  }

  async cancelCampaign(_campaignID: string): Promise<FinalizedCallTxData<CrowdFundingContract, "cancelCampaign">> {
    this.logger?.info(`Canceling campaign with id ${_campaignID}...`);

    const txData = await this.allReadyDeployedContract.callTx.cancelCampaign(
      utils.hexStringToUint8Array(_campaignID)
    );

    this.logger?.trace({
      transactionAdded: {
        circuit: "cancelCampaign",
        txHash: txData.public.txHash,
        blockDetails: {
          blockHash: txData.public.blockHash,
          blockHeight: txData.public.blockHeight,
        },
      },
    });
    return txData;
  }

  async requestRefund(_campaignID: string, refund_amount: number, amountDeposited: number): Promise<FinalizedCallTxData<CrowdFundingContract, "requestRefund">> {
    this.logger?.info(`Refunding ${refund_amount} worth of assets deposited to campaign with id ${_campaignID}...`);

    const txData = await this.allReadyDeployedContract.callTx.requestRefund(
      utils.hexStringToUint8Array(_campaignID),
      BigInt(refund_amount),
      BigInt(amountDeposited)
    );
    this.logger?.trace({
      transactionAdded: {
        circuit: "requestRefund",
        txHash: txData.public.txHash,
        blockDetails: {
          blockHash: txData.public.blockHash,
          blockHeight: txData.public.blockHeight,
        },
      },
    });
    return txData;
  }


  async updateCampaign(_campaignID: string, fundGoal: number, duration: number): Promise<FinalizedCallTxData<CrowdFundingContract, "updateCampaign">>
 {
    this.logger?.info(`Updating campaign with id ${_campaignID}...`);

    const txData = await this.allReadyDeployedContract.callTx.updateCampaign(
      utils.hexStringToUint8Array(_campaignID),
      BigInt(fundGoal),
      BigInt(duration)
    );
    this.logger?.trace({
      transactionAdded: {
        circuit: "updateCampaign",
        txHash: txData.public.txHash,
        blockDetails: {
          blockHash: txData.public.blockHash,
          blockHeight: txData.public.blockHeight,
        },
      },
    });
    return txData;
  }

  async withdrawCampaignFunds(_campaignID: string): Promise<FinalizedCallTxData<CrowdFundingContract, "withdrawCampaignFunds">> {
    this.logger?.info(`Withdrawing funds from campaign with id ${_campaignID}...`);

    const txData = await this.allReadyDeployedContract.callTx.withdrawCampaignFunds(
      utils.hexStringToUint8Array(_campaignID),
    );

    this.logger?.trace({
      transactionAdded: {
        circuit: "withdrawCampaignFunds",
        txHash: txData.public.txHash,
        blockDetails: {
          blockHash: txData.public.blockHash,
          blockHeight: txData.public.blockHeight,
        },
      },
    });
    return txData;
  }


  // Used to get the private state from the wallets privateState Provider
  private static async getPrivateState(
    providers: CrowdFundingContractProviders
  ): Promise<CrowdFundingPrivateState> {
    const existingPrivateState = await providers.privateStateProvider.get(
      CrowdFundingPrivateStateId
    );
    return (
      existingPrivateState ??
      createCrowdFundingPrivateState(utils.randomNonceBytes(32))
    );
  }
}

export * as utils from "./utils.js";

export * from "./common-types.js";
