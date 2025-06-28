import {
  Contract,
  Witnesses,
  CrowdFundingPrivateState,
  Campaign,
  CampaignStatus,
} from "@crowd-funding/crowd-funding-contract";

import { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { type FoundContract } from "@midnight-ntwrk/midnight-js-contracts";

export const CrowdFundingPrivateStateId = "crowdFundingPrivateState";
export type CrowdFundingPrivateStateId = typeof CrowdFundingPrivateStateId;
export type CrowdFundingContract = Contract<
  CrowdFundingPrivateState,
  Witnesses<CrowdFundingPrivateState>
>;
export type TokenCircuitKeys = Exclude<
  keyof CrowdFundingContract["impureCircuits"],
  number | symbol
>;
export type CrowdFundingContractProviders = MidnightProviders<
  TokenCircuitKeys,
  CrowdFundingPrivateStateId,
  CrowdFundingPrivateState
>;
export type DeployedCrowdFundingOnchainContract =
  FoundContract<CrowdFundingContract>;
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
