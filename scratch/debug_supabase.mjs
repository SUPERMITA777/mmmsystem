import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let envContent = fs.readFileSync(envPath, 'utf8');
const URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const KEY = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
    console.log(`Querying: ${URL}/rest/v1/sucursales?select=*&slug=eq.saboryarte`);
    const res = await fetch(`${URL}/rest/v1/sucursales?select=*&slug=eq.saboryarte`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });
    
    console.log(`HTTP Status: ${res.status} ${res.statusText}`);
    try {
        const data = await res.json();
        console.dir(data[0], { depth: null });
    } catch (e) {
        const text = await res.text();
        console.log("Response Text:", text);
    }
}
run();
