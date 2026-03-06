const fs = require('fs');
const env = fs.readFileSync('d:/zzz MMMSYSTEM/.env', 'utf-8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

async function test() {
    console.log("Fetching from REST:", url);
    const res = await fetch(`${url}/rest/v1/pedidos?select=*,pedido_items(*,productos(categorias(nombre)))&limit=1`, {
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`
        }
    });
    const data = await res.json();
    console.log(JSON.stringify(data[0].pedido_items[0], null, 2));
}

test();
