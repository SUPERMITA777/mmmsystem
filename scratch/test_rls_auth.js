const SUPABASE_URL = 'https://xnupjsxbvyirpeagbloe.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXBqc3hidnlpcnBlYWdibG9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDY0OTg2OSwiZXhwIjoyMDg2MjI1ODY5fQ.abuUcTgjLUnHZqagnlk10l8BpsCnDg3q_IRPUg5hKw0';

async function run() {
    const headers = {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
    };

    // Execute raw SQL to check RLS policies
    const sql = `
        SELECT policyname, cmd, roles, qual, with_check 
        FROM pg_policies 
        WHERE tablename = 'usuarios'
        ORDER BY policyname;
    `;

    const res = await globalThis.fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({})
    });

    // Use the SQL endpoint instead
    // Let's check the function definitions
    const sqlFn = `SELECT prosrc FROM pg_proc WHERE proname = 'get_user_sucursal_id'`;

    // Actually, let's just check if the function exists and what it does
    // by querying the usuarios table with different auth contexts
    
    // Test 1: As service role (should return all)
    console.log('\n=== TEST: usuarios query as service_role ===');
    const donjuanId = '15cc8387-26f9-457c-b27e-f3029d1654f2';
    const res1 = await globalThis.fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?sucursal_id=eq.${donjuanId}&activo=eq.true&select=id,nombre,rol`,
        { headers }
    );
    const data1 = await res1.json();
    console.log(`Count: ${data1.length}`);
    console.table(data1);

    // Test 2: As anon key (simulating unauthenticated)
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXBqc3hidnlpcnBlYWdibG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDk4NjksImV4cCI6MjA4NjIyNTg2OX0.p5wMjlSnHvDncNKi__ki6RFMQZNxNackaL3NzcNllxA';
    
    console.log('\n=== TEST: usuarios query as anon (no auth) ===');
    const res2 = await globalThis.fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?sucursal_id=eq.${donjuanId}&activo=eq.true&select=id,nombre,rol`,
        { 
            headers: {
                'apikey': ANON_KEY,
                'Authorization': `Bearer ${ANON_KEY}`,
            }
        }
    );
    const data2 = await res2.json();
    console.log(`Count: ${Array.isArray(data2) ? data2.length : 'ERROR'}`);
    if (Array.isArray(data2)) {
        console.table(data2);
    } else {
        console.log('Response:', JSON.stringify(data2));
    }
    
    // Test 3: Sign in as jorge@donjuan.com and query
    console.log('\n=== TEST: Sign in as jorge@donjuan.com ===');
    const loginRes = await globalThis.fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'apikey': ANON_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: 'jorge@donjuan.com',
            password: '123456'
        })
    });
    
    if (loginRes.ok) {
        const loginData = await loginRes.json();
        const token = loginData.access_token;
        console.log('✅ Logged in as jorge@donjuan.com');
        
        // Now query usuarios as this user
        const res3 = await globalThis.fetch(
            `${SUPABASE_URL}/rest/v1/usuarios?sucursal_id=eq.${donjuanId}&activo=eq.true&select=id,nombre,rol`,
            { 
                headers: {
                    'apikey': ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                }
            }
        );
        const data3 = await res3.json();
        console.log(`Count as jorge: ${Array.isArray(data3) ? data3.length : 'ERROR'}`);
        if (Array.isArray(data3)) {
            console.table(data3);
        } else {
            console.log('Response:', JSON.stringify(data3));
        }
    } else {
        const errText = await loginRes.text();
        console.log('❌ Login failed:', errText);
        
        // Try with ema@mmm.com
        console.log('\n=== TEST: Sign in as ema@mmm.com ===');
        const loginRes2 = await globalThis.fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'apikey': ANON_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'ema@mmm.com',
                password: '06021977'
            })
        });
        
        if (loginRes2.ok) {
            const loginData = await loginRes2.json();
            const token = loginData.access_token;
            console.log('✅ Logged in as ema@mmm.com');
            
            const res4 = await globalThis.fetch(
                `${SUPABASE_URL}/rest/v1/usuarios?sucursal_id=eq.${donjuanId}&activo=eq.true&select=id,nombre,rol`,
                { 
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${token}`,
                    }
                }
            );
            const data4 = await res4.json();
            console.log(`Count as ema: ${Array.isArray(data4) ? data4.length : 'ERROR'}`);
            if (Array.isArray(data4)) {
                console.table(data4);
            } else {
                console.log('Response:', JSON.stringify(data4));
            }
        } else {
            const errText2 = await loginRes2.text();
            console.log('❌ Login also failed:', errText2);
        }
    }
}

run().catch(console.error);
