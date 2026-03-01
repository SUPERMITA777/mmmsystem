import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xnupjsxbvyirpeagbloe.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXBqc3hidnlpcnBlYWdibG9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDY0OTg2OSwiZXhwIjoyMDg2MjI1ODY5fQ.abuUcTgjLUnHZqagnlk10l8BpsCnDg3q_IRPUg5hKw0';

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
