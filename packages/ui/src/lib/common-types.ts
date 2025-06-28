import type { CrowdFundingContractProviders, DeployedCrowdFundingAPI } from "@crowd-funding/crowd-funding-api";
import type { DAppConnectorWalletAPI, ServiceUriConfig } from "@midnight-ntwrk/dapp-connector-api";


export interface WalletAndProvider{
    readonly wallet: DAppConnectorWalletAPI,
    readonly uris: ServiceUriConfig,
    readonly providers: CrowdFundingContractProviders
}

export interface WalletAPI {
  wallet: DAppConnectorWalletAPI;
  coinPublicKey: string;
  encryptionPublicKey: string;
  uris: ServiceUriConfig;
}


export interface CrowdFundingDeployment{
  status: "inprogress" | "deployed" | "failed",
  api: DeployedCrowdFundingAPI;
}