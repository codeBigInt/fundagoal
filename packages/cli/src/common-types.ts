import {
  Contract,
  Witnesses,
  CrowdFundingPrivateState,
  Campaign,
} from "@crowd-funding/crowd-funding-contract";

import { DynamicProviders } from "nite-api";
import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import * as ledger from "@midnight-ntwrk/ledger-v7";
import { UnshieldedKeystore } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import {ImpureCircuitId} from "@midnight-ntwrk/compact-js";
export interface LedgerMapItem<T extends object>{
  key: Uint8Array,
  item: T
} 

/** Wallet type definition based on preview testnet migration */
export type WalletConfig = {
    indexerUri: string,
    indexerWsUri: string,
    proverServerUri: string,
    node: string,
    networkId: "preview" | "testnet" | "mainnet" | "undeployed"
}

export interface WalletContext {
    wallet: WalletFacade,
    dustSecretKey: ledger.DustSecretKey,
    shieldedSecretKeys: ledger.ZswapSecretKeys,
    unshieldedKeystore: UnshieldedKeystore
}

export interface WalletConfiguration {
    relayURL: URL;
    provingServerUrl: URL;
    indexerClientConnection: {
        indexerHttpUrl: string;
        indexerWsUrl: string
    },
    indexerUrl: string;
    costParameters: {
        additionalFeeOverhead: bigint; // 300 trillion - matches SDK examples
        feeBlocksMargin: number;
    },
    networkId: any;
}

export const CrowdFundingPrivateStateId = "crowdFundingPrivateState";
export type CrowdFundingPrivateStateId = typeof CrowdFundingPrivateStateId;
export type CrowdFundingContract = Contract<
  CrowdFundingPrivateState,
  Witnesses<CrowdFundingPrivateState>
>;
export type CrowdFundingCircuitKeys = ImpureCircuitId<CrowdFundingContract>;
export type CrowdFundingContractProviders = DynamicProviders<CrowdFundingContract, CrowdFundingPrivateStateId>;

export type DerivedCrowdFundingContractState = {
  readonly protocolTVL: DerivedProtocolTotal[];
  readonly campaigns: DerivedCampaign[];
};

export type DerivedProtocolTotal = {
  id: string;
  pool_balance: {
    nonce: Uint8Array;
    color: Uint8Array;
    value: bigint;
    mt_index: bigint;
  };
};

export type DerivedCampaign = {
  id: string;
  campaign: Campaign;
};
