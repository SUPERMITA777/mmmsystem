const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) {
        env[key.trim()] = rest.join('=').trim().replace(/['"]/g, '');
    }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] || '';
const supabaseServiceKey = env['SUPABASE_SERVICE_ROLE_KEY'] || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function run() {
    console.log("URL present:", !!supabaseUrl);
    console.log("Service Key present:", !!supabaseServiceKey);
    console.log("Service Key starts with:", supabaseServiceKey.substring(0, 10));

    const { data: authUsers, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (usersError) {
        console.error("Error from listUsers:", usersError);
    } else {
        console.log("Success! Users count:", authUsers?.users?.length);
    }
}
run();
