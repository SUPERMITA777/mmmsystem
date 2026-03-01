// Script to apply the Flyer table migration to Supabase
// Run with: node scripts/apply-008-flyer-feature.mjs

import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Client } = pg;

// Connection string for project xnupjsxbvyirpeagbloe
const dbUrl = "postgres://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres";

async function applyMigration() {
    const client = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to Supabase DB');

        const migrationPath = resolve(__dirname, '../supabase/migrations/008_flyer_feature.sql');
        const sql = readFileSync(migrationPath, 'utf8');

        console.log('⏳ Applying migration 008_flyer_feature.sql...');
        await client.query(sql);

        // Reload PostgREST schema cache
        await client.query("NOTIFY pgrst, 'reload schema'");

        console.log('✅ Migration applied successfully and schema cache reloaded!');

    } catch (err) {
        console.error('❌ Error applying migration:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

applyMigration();
