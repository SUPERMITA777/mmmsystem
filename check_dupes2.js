const { Client } = require('pg');

const run = async () => {
    const connectionString = 'postgres://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres';
    const client = new Client({ connectionString });
    try {
        await client.connect();

        const res = await client.query(`
            SELECT id, nombre, categoria_id, activo, producto_oculto, visible_en_menu, sucursal_id 
            FROM productos 
            WHERE nombre = '2 Muzzas estilo romanas'
        `);
        console.log("Details for '2 Muzzas estilo romanas':");
        console.table(res.rows);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
};

run();
