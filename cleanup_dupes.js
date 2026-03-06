const { Client } = require('pg');

const run = async () => {
    const connectionString = 'postgres://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres';
    const client = new Client({ connectionString });
    try {
        await client.connect();

        // Find duplicate product names where one has a category and the other does not
        console.log("Identifying duplicate products to clean up...");
        const res = await client.query(`
            SELECT nombre, 
                   array_agg(id) as ids,
                   array_agg(categoria_id) as cats
            FROM productos
            GROUP BY nombre
            HAVING COUNT(*) > 1
        `);

        let deletedCount = 0;

        for (const row of res.rows) {
            const ids = row.ids;
            const cats = row.cats;

            // If we have one with a category and one without, delete the one without
            let idToKeep = null;
            let idsToDelete = [];

            // Prefer keeping one with a category
            for (let i = 0; i < ids.length; i++) {
                if (cats[i] !== null && idToKeep === null) {
                    idToKeep = ids[i];
                } else if (idToKeep !== null) {
                    idsToDelete.push(ids[i]);
                } else {
                    // if neither has category so far, keep the first one
                    idToKeep = ids[i];
                }
            }

            // Ensure if we didn't find one with a category, we still keep one and delete the rest
            if (idToKeep === null) {
                idToKeep = ids[0];
            }
            idsToDelete = ids.filter(id => id !== idToKeep);

            if (idsToDelete.length > 0) {
                console.log(`Keeping ${idToKeep} for "${row.nombre}", deleting ${idsToDelete.join(', ')}`);
                for (const idDel of idsToDelete) {
                    await client.query('DELETE FROM productos WHERE id = $1', [idDel]);
                    deletedCount++;
                }
            }
        }

        console.log(`Cleanup complete. Deleted ${deletedCount} duplicate products.`);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
};

run();
