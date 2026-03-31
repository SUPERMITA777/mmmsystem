const { Client } = require('pg');

const dbUrl = 'postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres';

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        
        // Fetch existing sucursales
        const sucursalesRes = await client.query('SELECT id, nombre FROM sucursales LIMIT 3;');
        if (sucursalesRes.rows.length === 0) return console.log("No sucursales found.");
        
        console.log("Generating dummy metric data for the charts...");
        
        for (let i = 0; i < 7; i++) {
            // Generate a date for the past 7 days
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split("T")[0];
            
            for (const s of sucursalesRes.rows) {
                // Generate a random number of hourly records for this day (1 to 8 distinct hours)
                const numHours = Math.floor(Math.random() * 8) + 1;
                let totalVisitsForDay = 0;
                
                for (let h = 0; h < numHours; h++) {
                    // Pick a random hour between 8 AM and 11 PM (8 to 23)
                    const randomHour = Math.floor(Math.random() * 16) + 8;
                    const fakeVisits = Math.floor(Math.random() * 15) + 3; // 3 to 17 visits per hour
                    
                    await client.query(`
                        INSERT INTO analytics_visitas (sucursal_id, fecha, hora, cantidad)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT ON CONSTRAINT analytics_visitas_unique_hora
                        DO UPDATE SET cantidad = analytics_visitas.cantidad + $4;
                    `, [s.id, dateStr, randomHour, fakeVisits]);
                    
                    totalVisitsForDay += fakeVisits;
                }
                console.log(`Inserted ${totalVisitsForDay} visits for ${s.nombre} on ${dateStr}`);
            }
        }
        
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await client.end();
    }
}

run();
