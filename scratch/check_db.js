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
        // 1. Convertir en SUPERADMIN de forma limpia
        console.log('\n👑 Ascendiendo a Superadmin de forma limpia...');
        await client.query("DELETE FROM user_roles WHERE user_id = '70ca573a-23f2-45e6-9964-b633075c345f'");
        await client.query(`
            INSERT INTO user_roles (user_id, role)
            VALUES ('70ca573a-23f2-45e6-9964-b633075c345f', 'superadmin')
        `);
        console.log('✅ Ahora eres Superadmin oficial.');

        // 2. Diagnosticar por qué Don Juan no muestra usuarios
        console.log('\n🔬 Diagnóstico de funciones de sesión para tu ID...');
        const diag = await client.query(`
            SELECT 
                id, 
                rol, 
                sucursal_id,
                get_user_sucursal_id() as func_sucursal_id,
                is_sucursal_admin() as func_is_admin,
                is_super_admin() as func_is_super
            FROM usuarios 
            WHERE id = '70ca573a-23f2-45e6-9964-b633075c345f'
        `);
        console.table(diag.rows);

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
