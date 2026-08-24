import pg from 'pg';
import 'dotenv/config';
 
pg.types.setTypeParser(1082, (val) => val);
 
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');
 
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});
 
pool.on('error', (err) => {
  console.error('There was an unexpected error when connecting to the database.', err);
});
 