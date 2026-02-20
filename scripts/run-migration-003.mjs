import pkg from "pg";
const { Client } = pkg;

const client = new Client({
    host: "db.xnupjsxbvyirpeagbloe.supabase.co",
    port: 5432,
    user: "postgres",
    password: "SoleyEma2711",
    database: "postgres",
    ssl: { rejectUnauthorized: false },
});

const steps = [
    ["Crear tabla zonas_entrega",
        `CREATE TABLE IF NOT EXISTS zonas_entrega (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
            nombre TEXT NOT NULL,
            costo_envio NUMERIC(12,2) DEFAULT 0,
            minimo_compra NUMERIC(12,2) DEFAULT 0,
            envio_gratis_desde NUMERIC(12,2) DEFAULT NULL,
            tiempo_estimado_minutos INTEGER DEFAULT NULL,
            tipo_precio TEXT DEFAULT 'fijo',
            precio_por_km NUMERIC(12,2) DEFAULT 0,
            polygon_coords JSONB DEFAULT NULL,
            activo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )`
    ],
    ["Trigger updated_at en zonas_entrega",
        `DO $do$ BEGIN
            CREATE TRIGGER update_zonas_entrega_updated_at
                BEFORE UPDATE ON zonas_entrega
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        EXCEPTION WHEN duplicate_object THEN NULL; END $do$`
    ],
    ["local_lat → config_sucursal",
        "ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS local_lat DOUBLE PRECISION DEFAULT NULL"
    ],
    ["local_lng → config_sucursal",
        "ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS local_lng DOUBLE PRECISION DEFAULT NULL"
    ],
    ["local_direccion → config_sucursal",
        "ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS local_direccion TEXT DEFAULT NULL"
    ],
];

async function main() {
    console.log("\n🔧 Migración 003 → Supabase\n");
    await client.connect();
    console.log("✅ Conectado\n");

    let ok = 0;
    for (const [label, sql] of steps) {
        process.stdout.write(`  ⏳ ${label}... `);
        try {
            await client.query(sql);
            console.log("✅");
            ok++;
        } catch (e) {
            if (e.message.includes("already exists")) { console.log("✅ (ya existe)"); ok++; }
            else console.log(`❌  ${e.message.split("\n")[0]}`);
        }
    }

    await client.end();
    console.log(`\n${ok === steps.length ? "✅ Migración completa." : `⚠  ${ok}/${steps.length} pasos OK.`}`);
    console.log("ℹ  PostgREST refresca el caché en ~30s. Recargá la página.\n");
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
