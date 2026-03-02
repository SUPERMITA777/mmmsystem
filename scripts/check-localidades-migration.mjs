import { createClient } from '@supabase/supabase-js';
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    try {
        const envPath = join(__dirname, "..", ".env");
        const content = readFileSync(envPath, "utf-8");
        content.split("\n").forEach((line) => {
            const trimmed = line.trim().replace(/\r$/, "");
            if (!trimmed || trimmed.startsWith("#")) return;
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx < 0) return;
            const key = trimmed.slice(0, eqIdx).trim();
            const value = trimmed.slice(eqIdx + 1).trim();
            if (!process.env[key]) process.env[key] = value;
        });
    } catch (e) { }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están definidas en el .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log('🔄 Checking if localidades column exists...');

    const { data, error } = await supabase.from('config_sucursal').select('localidades').limit(1);

    if (!error) {
        console.log('✅ Column "localidades" already exists! No migration needed.');
        console.log('Current data:', JSON.stringify(data));
        process.exit(0);
    }

    if (error && error.message.includes('localidades')) {
        console.log('❌ Column does not exist. You need to run this SQL in your Supabase SQL Editor:');
        console.log('');
        console.log("  ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS localidades JSONB DEFAULT '[]'::jsonb;");
        console.log("  NOTIFY pgrst, 'reload schema';");
        console.log('');
        console.log('Go to: https://supabase.com/dashboard/project/xnupjsxbvyirpeagbloe/sql');
        process.exit(1);
    }

    console.log('⚠️ Unexpected error:', error.message);
    process.exit(1);
}

runMigration();
