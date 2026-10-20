import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool({ connectionString: config.databaseUrl, max: 5, idleTimeoutMillis: 30_000 });
pool.on('error', (e) => console.error('pg pool error:', e.message));
