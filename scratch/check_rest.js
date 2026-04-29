// Use Supabase REST API to check RLS policies since pg connection fails
const fetch = require('node-fetch') || globalThis.fetch;

const SUPABASE_URL = 'https://xnupjsxbvyirpeagbloe.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXBqc3hidnlpcnBlYWdibG9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDY0OTg2OSwiZXhwIjoyMDg2MjI1ODY5fQ.abuUcTgjLUnHZqagnlk10l8BpsCnDg3q_IRPUg5hKw0';

async function run() {
    const headers = {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };

    // 1. List all users in Don Juan tenant
    const donjuanId = '15cc8387-26f9-457c-b27e-f3029d1654f2';
    console.log(`\n=== USUARIOS DE DON JUAN (${donjuanId}) ===`);
    
    const res1 = await globalThis.fetch(`${SUPABASE_URL}/rest/v1/usuarios?sucursal_id=eq.${donjuanId}&select=id,email,nombre,rol,activo,sucursal_id`, { headers });
    const users = await res1.json();
    console.table(users);

    // 2. Check RLS functions via SQL
    console.log('\n=== CHECKING RLS POLICIES via SQL ===');
    const sqlRes = await globalThis.fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_sucursal_id`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_user_id: '5c6f68b9-173c-4edc-a9ef-dec45829aa88' })
    });
    
    if (sqlRes.ok) {
        const result = await sqlRes.json();
        console.log('get_user_sucursal_id for ema@mmm.com:', result);
    } else {
        const err = await sqlRes.text();
        console.log('Error calling RPC:', err);
    }

    // 3. Try simulating an anon-key authenticated request for jorge@donjuan (admin)
    // jorge@donjuan.com has id 584cf0bb-9aae-46d1-8dee-3b27eafa23e2
    console.log('\n=== Current state of ema@mmm.com ===');
    const res3 = await globalThis.fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.5c6f68b9-173c-4edc-a9ef-dec45829aa88&select=id,email,rol,sucursal_id`, { headers });
    const ema = await res3.json();
    console.table(ema);
}

run().catch(console.error);
