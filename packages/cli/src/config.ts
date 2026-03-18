import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import path from 'node:path';

export interface Config {
  readonly privateStateStoreName: string;
  readonly logDir: string;
  readonly zkConfigPath: string;
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
}

export const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');

export const contractConfig = {
  privateStateStoreName: "crowd-funding",
  zkConfigPath: path.resolve(currentDir, '..', '..', 'contract', 'dist', 'managed', 'crowd-funding')
}

export class PreviewConfig implements Config {
  privateStateStoreName = 'crowd-funding-private-state';
  logDir = path.resolve(currentDir, '..', 'logs', 'preprod-local', `${new Date().toISOString()}.log`);
  zkConfigPath = path.resolve(currentDir, '..', '..', 'contract', 'dist', 'managed', 'crowd-funding');
  indexer = 'https://indexer.preview.midnight.network/api/v3/graphql';
  indexerWS = 'wss://indexer.preview.midnight.network/api/v3/graphql/ws';
  node = 'https://rpc.preview.midnight.network';
  proofServer = 'http://127.0.0.1:6300';
  constructor() {
    setNetworkId('preview');
  }
}

export class StandaloneConfig implements Config {
  privateStateStoreName = 'crowd-funding-private-state';
  logDir = path.resolve(currentDir, '..', 'logs', 'standalone', `${new Date().toISOString()}.log`);
  zkConfigPath = path.resolve(currentDir, '..', '..', 'contract', 'dist', 'managed', 'crowd-funding');
  indexer = 'http://127.0.0.1:8088/api/v3/graphql';
  indexerWS = 'ws://127.0.0.1:8088/api/v3/graphql/ws';
  node = 'ws://127.0.0.1:9944';
  proofServer = 'http://127.0.0.1:6300';
  constructor() {
    setNetworkId('undeployed');
  }
}

export class PreProdConfig implements Config {
  privateStateStoreName = 'crowd-funding-private-state';
  logDir = path.resolve(currentDir, '..', 'logs', 'preprod-remote', `${new Date().toISOString()}.log`);
  zkConfigPath = path.resolve(currentDir, '..', '..', 'contract', 'dist', 'managed', 'crowd-funding');
  indexer = 'https://indexer.preprod.midnight.network/api/v3/graphql';
  indexerWS = 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws';
  node = 'https://rpc.preprod.midnight.network';
  proofServer = 'http://127.0.0.1:6300';
  constructor() {
    setNetworkId('preview');
  }
}
