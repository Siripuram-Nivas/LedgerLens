import { loadConfig } from '../config';
import { createLogger } from '../logger';
import { createServices } from '../services/container';
import { RESET_CONFIRMATION } from '../services/demoService';

async function main() {
  const config = loadConfig();
  if (!config.DEMO_MODE) {
    throw new Error('Refusing to reset: DEMO_MODE is not enabled.');
  }
  const logger = createLogger('warn');
  const services = await createServices(config, logger, { seedDemo: false });
  try {
    const result = await services.demo.reset(RESET_CONFIRMATION, 'cli:reset-demo');
    console.log('Demo dataset reset. Deleted demo-tagged records:');
    for (const [collection, count] of Object.entries(result.deleted)) {
      console.log(`  ${collection}: ${count}`);
    }
    console.log('Reseeded the deterministic demo dataset.');
  } finally {
    await services.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
