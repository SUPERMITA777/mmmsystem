require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function run() {
    console.log("URL:", supabaseUrl ? "Present" : "Missing");
    console.log("Service Key:", supabaseServiceKey ? "Present" : "Missing");

    const { data: authUsers, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (usersError) {
        console.error("Error from listUsers:", usersError);
    } else {
        console.log("Success! Users count:", authUsers?.users?.length);
    }
}
run();
