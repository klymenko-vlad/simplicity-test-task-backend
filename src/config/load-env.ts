import { config as loadDotenv } from 'dotenv';

for (const path of ['.env.local', '.env']) {
  loadDotenv({ path, quiet: true });
}
