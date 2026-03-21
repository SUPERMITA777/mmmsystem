const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
let envContent = fs.readFileSync(envPath, 'utf8');
const URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
// Use service role key to run DDL commands if enabled
const KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(URL, KEY);

async function runMigration() {
    const { data, error } = await supabase.rpc('query_exec', {
        query: `
            ALTER TABLE sucursal_flyers 
            ADD COLUMN IF NOT EXISTS fecha_desde timestamptz,
            ADD COLUMN IF NOT EXISTS fecha_hasta timestamptz;
        `
    });
    
    // If rpc 'query_exec' doesn't exist, we will use a raw query or provide the SQL text to the user.
    // Let's create a SQL file as well that they can run manually.
    console.log("Migration Attempt:", { data, error });
}

runMigration();
