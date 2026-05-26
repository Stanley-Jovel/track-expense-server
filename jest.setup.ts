import { loadEnvConfig } from '@next/env';

// Use the same env loader Next.js uses in dev/build so behavior matches the
// running app (handles .env / .env.local / .env.test ordering and quoted PEMs).
loadEnvConfig(process.cwd());

process.env.GOOGLE_SHEETS_TRANSACTIONS_SHEET_NAME = 'Test';
