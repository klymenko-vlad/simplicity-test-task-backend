import './config/load-env';

import { createApp } from './bootstrap';

async function main(): Promise<void> {
  const app = await createApp();
  await app.init();
  await app.close();

  console.log('schema.gql written to src/schema.gql');
}

main().catch((error: unknown) => {
  console.error('failed to generate GraphQL schema', error);
  process.exit(1);
});
