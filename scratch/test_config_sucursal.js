const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const KEY = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
    const res = await fetch(`${URL}/rest/v1/config_sucursal?limit=2`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });
    console.log("Status:", res.status);
    console.log("Body:", await res.json());
}
run();
