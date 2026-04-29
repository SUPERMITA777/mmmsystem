const { Client } = require('pg');

const connectionString = `postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres`;

async function fixAdmin() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('✅ Conectado para corrección.');

        const sucursalId = '15cc8387-26f9-457c-b27e-f3029d1654f2';

        console.log(`\n🚀 Vinculando a TODOS los administradores sin sucursal a ${sucursalId}...`);
        
        const res = await client.query(
            "UPDATE usuarios SET sucursal_id = $1 WHERE (rol = 'admin' OR rol = 'super_admin') AND sucursal_id IS NULL RETURNING id, email, rol, sucursal_id",
            [sucursalId]
        );

        if (res.rowCount > 0) {
            console.log('✅ Usuario actualizado con éxito:');
            console.table(res.rows);
        } else {
            console.log('⚠️ No se encontró el usuario para actualizar.');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

fixAdmin();
