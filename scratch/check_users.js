const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/)[1];

const supabase = createClient(url, key);

async function check() {
    const { data: usuarios, error: uErr } = await supabase.from('usuarios').select('*');
    console.log('--- USUARIOS TABLE ---');
    console.log('Count:', usuarios ? usuarios.length : 0);
    console.log('Error:', uErr);
    if (usuarios && usuarios.length > 0) {
        console.log('First 3:', usuarios.slice(0, 3).map(u => ({ id: u.id, email: u.email, sucursal: u.sucursal_id })));
    }

    const { data: { users: authUsers }, error: aErr } = await supabase.auth.admin.listUsers();
    console.log('--- AUTH USERS ---');
    console.log('Count:', authUsers ? authUsers.length : 0);
    console.log('Error:', aErr);
}

check();
