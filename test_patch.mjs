import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let envContent = fs.readFileSync(envPath, 'utf8');
const URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const KEY = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
    const defaultSucursalId = '9d1bfdb8-cb79-4568-b2bc-5f04f1888462';

    console.log("Fixing producto_grupos_adicionales...");
    const res1 = await fetch(`${URL}/rest/v1/producto_grupos_adicionales?sucursal_id=is.null`, {
        method: 'PATCH',
        headers: {
            'apikey': KEY,
            'Authorization': `Bearer ${KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ sucursal_id: defaultSucursalId })
    });
    console.log("Rels patched:", await res1.json());

    console.log("Fixing adicionales...");
    const res2 = await fetch(`${URL}/rest/v1/adicionales?sucursal_id=is.null`, {
        method: 'PATCH',
        headers: {
            'apikey': KEY,
            'Authorization': `Bearer ${KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ sucursal_id: defaultSucursalId })
    });
    console.log("Ads patched:", await res2.json());
}
run();
