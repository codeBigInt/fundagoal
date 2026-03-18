import { createLogger } from '../logger-utils.js';
import path from 'node:path';
import { run } from '../index.js';
import { DockerComposeEnvironment, Wait } from 'testcontainers';
import { currentDir, StandaloneConfig } from '../config.js';

const config = new StandaloneConfig();
const dockerEnv = new DockerComposeEnvironment(path.resolve(currentDir, '..'), 'compose.yml')
  .withWaitStrategy('proof-server', Wait.forListeningPorts().withStartupTimeout(180_000))
  .withWaitStrategy('indexer', Wait.forListeningPorts().withStartupTimeout(180_000))
  .withWaitStrategy('node', Wait.forListeningPorts().withStartupTimeout(180_000));
const logger = await createLogger(config.logDir);
await run(config, logger, dockerEnv);
