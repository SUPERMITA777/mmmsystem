const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

const connectionString = `postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres`;

async function checkAndFix() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('✅ Conectado a la base de datos.');

        // 1. Ver usuarios actuales en el local Don Juan
        const res = await client.query("SELECT id, email FROM auth.users WHERE email = 'emanuelsanch99@gmail.com'");
        console.log('\n🔐 Buscando cuenta en AUTH.USERS:');
        console.table(res.rows);

        if (res.rows.length > 0) {
            const userId = res.rows[0].id;
            const sucursalId = '15cc8387-26f9-457c-b27e-f3029d1654f2';
            console.log(`\n♻️ Cuenta encontrada en Auth. Recreando perfil en public.usuarios para ID: ${userId}...`);
            
            await client.query(`
                INSERT INTO public.usuarios (id, email, nombre, rol, sucursal_id, activo)
                VALUES ($1, $2, 'Emanuel', 'admin', $3, true)
                ON CONFLICT (id) DO UPDATE 
                SET sucursal_id = $3, rol = 'admin';
            `, [userId, 'emanuelsanch99@gmail.com', sucursalId]);
            
            console.log('✅ Perfil recreado/actualizado con éxito.');
        } else {
            console.log('❌ No se encontró la cuenta ni siquiera en Auth.Users.');
        }

        const metaRes = await client.query("SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_name = 'usuarios'");
        console.log('\n🔍 Metadatos de la tabla:');
        console.table(metaRes.rows);
        await client.query("SET row_security = ON;");

        const profilesRes = await client.query("SELECT count(*) FROM public.usuarios");
        console.log('\n📊 Conteo total en PUBLIC.USUARIOS:');
        console.table(profilesRes.rows);

        const sucursalRes = await client.query("SELECT id, nombre FROM sucursales WHERE id = '15cc8387-26f9-457c-b27e-f3029d1654f2'");
        console.log('\n🏢 Verificando que la sucursal existe:');
        console.table(sucursalRes.rows);

        // 2. Corregir el RLS usando funciones SECURITY DEFINER para evitar recursión
        console.log('\n🛠️ Corrigiendo recursión en políticas de RLS...');
        await client.query(`
            DROP POLICY IF EXISTS "lectura_autenticados" ON usuarios;
            
            -- Esta política usa funciones que saltan el RLS para evitar el bucle infinito
            CREATE POLICY "lectura_autenticados" 
            ON usuarios FOR SELECT 
            TO authenticated 
            USING (
                id = auth.uid() OR 
                sucursal_id = get_user_sucursal_id() OR 
                is_sucursal_admin() OR
                is_super_admin()
            );
        `);
        console.log('✅ Bucle de RLS corregido.');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

checkAndFix();
