const SUPABASE_URL = 'https://xnupjsxbvyirpeagbloe.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXBqc3hidnlpcnBlYWdibG9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDY0OTg2OSwiZXhwIjoyMDg2MjI1ODY5fQ.abuUcTgjLUnHZqagnlk10l8BpsCnDg3q_IRPUg5hKw0';

async function run() {
    const headers = {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
    };

    // Check auth.users for Don Juan users
    console.log('=== auth.users listing ===');
    const res = await globalThis.fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=50`, { headers });
    const data = await res.json();
    const users = data.users || data;
    
    console.log(`Total auth users: ${users.length}`);
    
    const donjuanUsers = ['camarero1@donjuan.com', 'camarero2@gmail.com', 'camarero3@donjuan.com', 'cam4@donjuan.com', 'jorge@donjuan.com', 'ema@mmm.com'];
    
    for (const email of donjuanUsers) {
        const authUser = users.find(u => u.email === email);
        if (authUser) {
            console.log(`✅ ${email} EXISTS in auth.users (id: ${authUser.id})`);
        } else {
            console.log(`❌ ${email} NOT FOUND in auth.users`);
        }
    }

    // Now check: what user ID does auth.uid() return for the currently logged-in session?
    // The key insight: the Supabase client uses auth.uid() which matches auth.users.id
    // But public.usuarios.id may be DIFFERENT from auth.users.id!
    
    console.log('\n=== Cross-referencing auth.users IDs with public.usuarios IDs ===');
    
    const res2 = await globalThis.fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?sucursal_id=eq.15cc8387-26f9-457c-b27e-f3029d1654f2&select=id,email,nombre,rol`,
        { headers }
    );
    const pubUsers = await res2.json();
    
    for (const pu of pubUsers) {
        const authUser = users.find(u => u.email === pu.email);
        const match = authUser ? (authUser.id === pu.id ? '✅ MATCH' : `⚠️ MISMATCH auth.id=${authUser.id} vs pub.id=${pu.id}`) : '❌ NO AUTH USER';
        console.log(`${pu.email}: ${match}`);
    }
}

run().catch(console.error);
