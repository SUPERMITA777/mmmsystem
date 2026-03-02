/**
 * Creates usuarios table via direct PG connection + creates admin user via Supabase Auth
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    try {
        const content = readFileSync(join(__dirname, "..", ".env"), "utf-8");
        content.split("\n").forEach(line => {
            const t = line.trim().replace(/\r$/, "");
            if (!t || t.startsWith("#")) return;
            const idx = t.indexOf("=");
            if (idx < 0) return;
            process.env[t.slice(0, idx).trim()] ??= t.slice(idx + 1).trim();
        });
    } catch { }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1];
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT,
  telefono TEXT,
  avatar_url TEXT,
  rol TEXT NOT NULL DEFAULT 'empleado',
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Usuarios pueden ver todos los usuarios"
    ON usuarios FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Usuarios pueden actualizar su propio perfil"
    ON usuarios FOR UPDATE TO authenticated USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Service role puede insertar usuarios"
    ON usuarios FOR INSERT TO service_role WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
`;

async function createUserInAuth(supabase) {
    console.log("\n👤 Creando usuario admin...");

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: "ema@mmm.com",
        password: "1977",
        email_confirm: true,
    });

    if (authError) {
        if (authError.message.includes("already been registered") || authError.message.includes("already exists")) {
            console.log("   ℹ️  El usuario ema@mmm.com ya existe en auth.users");
            const { data: { users } } = await supabase.auth.admin.listUsers();
            const existingUser = users?.find(u => u.email === "ema@mmm.com");
            if (existingUser) return existingUser.id;
            return null;
        }
        console.log(`   ❌ Error: ${authError.message}`);
        return null;
    }

    console.log(`   ✅ Usuario auth creado: ${authData.user.id}`);
    return authData.user.id;
}

async function main() {
    console.log(`\n🔧 MMM System - Setup Admin [${PROJECT_REF}]\n`);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Step 1: Create the auth user first (this works without the table)
    const userId = await createUserInAuth(supabase);
    if (!userId) {
        console.log("❌ No se pudo crear/encontrar el usuario auth. Abortando.");
        process.exit(1);
    }

    // Step 2: Try to create the table via direct PG connection
    if (DB_PASSWORD) {
        console.log("\n📦 Creando tabla usuarios via PG directa...");
        const connStr = `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`;
        const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
        try {
            await client.connect();
            console.log("   ✅ Conectado a PostgreSQL");
            await client.query(CREATE_TABLE_SQL);
            console.log("   ✅ Tabla usuarios creada");
            await client.end();
        } catch (e) {
            console.log(`   ❌ Error PG: ${e.message}`);
            await client.end().catch(() => { });
        }
    } else {
        console.log("\n⚠️  No hay SUPABASE_DB_PASSWORD en .env");
        console.log("   Intentando crear tabla via REST...");
    }

    // Step 3: Try inserting the profile
    console.log("\n📝 Insertando perfil admin en tabla usuarios...");

    // Wait a bit for schema cache
    await new Promise(r => setTimeout(r, 2000));

    const { error: insertError } = await supabase
        .from("usuarios")
        .upsert({
            id: userId,
            email: "ema@mmm.com",
            nombre: "Admin",
            rol: "super_admin",
            activo: true,
        }, { onConflict: "id" });

    if (insertError) {
        if (insertError.message.includes("404") || insertError.code === "PGRST204" || insertError.message.includes("relation") || insertError.code === "42P01") {
            console.log(`   ⚠️  La tabla usuarios aún no existe en la BD.`);
            console.log(`\n📋 Ejecutar manualmente el siguiente SQL en:`);
            console.log(`   https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new\n`);
            console.log(`--- COPIAR Y PEGAR ---`);
            console.log(CREATE_TABLE_SQL);
            console.log(`--- FIN ---\n`);
            console.log(`   Después ejecutar:`);
            console.log(`   INSERT INTO usuarios (id, email, nombre, rol, activo) VALUES ('${userId}', 'ema@mmm.com', 'Admin', 'super_admin', true);`);
        } else {
            console.log(`   ❌ Error: ${insertError.message} (${insertError.code})`);
        }
    } else {
        console.log("   ✅ Perfil admin insertado exitosamente");
        console.log("\n🎉 ¡Todo listo! Podés iniciar sesión en /admin/login con:");
        console.log("   Email: ema@mmm.com");
        console.log("   Password: 1977\n");
    }
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
