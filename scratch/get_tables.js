const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const KEY = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
    // We can query PostgREST OpenAPI to get all defined tables!
    const res = await fetch(`${URL}/rest/v1/`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });
    const schema = await res.json();
    console.log("Tables in DB:", Object.keys(schema.definitions || {}));
}
run();
