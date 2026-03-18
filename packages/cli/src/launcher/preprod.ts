import { createLogger } from '../logger-utils.js';
import { run } from '../index.js';
import { PreProdConfig } from '../config.js';

const config = new PreProdConfig();
const logger = await createLogger(config.logDir);
await run(config, logger);
