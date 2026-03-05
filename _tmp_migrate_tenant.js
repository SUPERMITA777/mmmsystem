const { Client } = require('pg');

const dbUrl = 'postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres';

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to DB!");

        // 1. Add slug y user_id a sucursales
        // 2. Create user_roles (para identificar al SUPERADMIN independiente de la auth de supabase)
        const sql = `
      -- Añadir identificadores a las sucursales existentes
      ALTER TABLE sucursales
      ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS user_id UUID;
      
      -- Set a default slug for the existing sucursal (the first one)
      UPDATE sucursales SET slug = 'demo' WHERE slug IS NULL;
      
      -- Create a roles table
      CREATE TABLE IF NOT EXISTS user_roles (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'staff')),
          sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

        await client.query(sql);
        console.log("Migration executed successfully!");

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await client.end();
    }
}

run();
