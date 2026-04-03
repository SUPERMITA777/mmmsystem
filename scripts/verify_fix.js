const { Client } = require('pg');

const dbUrl = 'postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres';

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function verify() {
    try {
        await client.connect();
        console.log("Checking constraints on 'pedidos'...");
        
        const res = await client.query(`
            SELECT conname, contype 
            FROM pg_constraint 
            WHERE conrelid = 'pedidos'::regclass;
        `);
        
        console.log("Constraints found:");
        res.rows.forEach(r => console.log(`- ${r.conname} (${r.contype})`));

        const hasOld = res.rows.some(r => r.conname === 'pedidos_numero_pedido_key');
        const hasNew = res.rows.some(r => r.conname === 'pedidos_sucursal_numero_unique');

        if (hasOld) console.error("❌ Old global constraint STILL EXISTS!");
        else console.log("✅ Old global constraint is gone.");

        if (hasNew) console.log("✅ New composite constraint is present.");
        else console.error("❌ New composite constraint MISSING!");

        // Test insertion of duplicate numero_pedido for DIFFERENT sucursal
        console.log("\nTesting insertion of duplicate numero_pedido for different sucursales...");
        const s1 = '9d1bfdb8-cb79-4568-b2bc-5f04f1888462'; // Sucursal 1
        const s2 = 'e15f8d9a-5432-4e1a-8b54-f2038475cda1'; // Random UUID for Sucursal 2 (just for test)
        const num = 'TEST-VERIFY-001';

        try {
            // Clean up first
            await client.query("DELETE FROM pedidos WHERE numero_pedido = $1", [num]);
            
            console.log(`Inserting ${num} for sucursal ${s1}...`);
            await client.query("INSERT INTO pedidos (sucursal_id, numero_pedido, tipo, total) VALUES ($1, $2, 'delivery', 0)", [s1, num]);
            
            console.log(`Inserting ${num} for sucursal ${s2}... (Should NOT fail now)`);
            await client.query("INSERT INTO pedidos (sucursal_id, numero_pedido, tipo, total) VALUES ($1, $2, 'delivery', 0)", [s2, num]);
            
            console.log("✅ Success! Duplicate numero_pedido allowed for different sucursales.");
        } catch (e) {
            console.error("❌ Failed duplicate test:", e.message);
        } finally {
            // Cleanup
            await client.query("DELETE FROM pedidos WHERE numero_pedido = $1", [num]);
        }

    } catch (error) {
        console.error("Verification failed:", error);
    } finally {
        await client.end();
    }
}

verify();
