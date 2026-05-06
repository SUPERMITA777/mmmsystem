const fs = require('fs');
const env = fs.readFileSync('d:/zzz MMMSYSTEM/.env', 'utf-8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

async function test() {
    console.log("Fetching config_sucursal from REST:", url);
    const res = await fetch(`${url}/rest/v1/config_sucursal?select=*`, {
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`
        }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

test();
