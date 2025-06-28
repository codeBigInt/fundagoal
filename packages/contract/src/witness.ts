import {
  MerkleTreePath,
  WitnessContext,
} from "@midnight-ntwrk/compact-runtime";
import { Ledger } from "./managed/crowd-funding/contract/index.cjs";

export type CrowdFundingPrivateState = {
  readonly secrete_key: Uint8Array;
};

export const createCrowdFundingPrivateState = (secrete_key: Uint8Array) => ({
  secrete_key,
});

export const witnesses = {
  local_secrete_key: ({
    privateState,
  }: WitnessContext<Ledger, CrowdFundingPrivateState>): [
    CrowdFundingPrivateState,
    Uint8Array,
  ] => [privateState, privateState.secrete_key],

  // Generates proof that a user is part of the backers onchain
  findBacker: (
    context: WitnessContext<Ledger, CrowdFundingPrivateState>,
    item: Uint8Array
  ): [CrowdFundingPrivateState, MerkleTreePath<Uint8Array>] => {
    return [
      context.privateState,
      context.ledger.backers.findPathForLeaf(item)!,
    ];
  },

  // Confirms if a campaign has expired
  confirm_campaign_expiration: (
    { privateState }: WitnessContext<Ledger, CrowdFundingPrivateState>,
    duration: bigint,
    startDate: bigint
  ): [CrowdFundingPrivateState, boolean] => {
    const millisecondsPerHour = 1000 * 60 * 60 * 24;
    const durationInMilliseconds = millisecondsPerHour * Number(duration);
    const expiryDate = Number(startDate) + durationInMilliseconds;
    const currentDate = Date.now();
    
    return [privateState, expiryDate >= currentDate];
  },
};
