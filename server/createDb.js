import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: 'postgres', // Connect to default postgres DB
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function createDatabase() {
  try {
    const res = await pool.query("SELECT 1 FROM pg_database WHERE datname = 'devconnect_db'");
    if (res.rowCount === 0) {
      await pool.query('CREATE DATABASE devconnect_db');
      console.log('Database "devconnect_db" created successfully.');
    } else {
      console.log('Database "devconnect_db" already exists.');
    }
  } catch (err) {
    console.error('Error creating database:', err);
  } finally {
    await pool.end();
  }
}

createDatabase();
