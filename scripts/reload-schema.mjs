import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    try {
        const envPath = join(__dirname, "..", ".env");
        const content = readFileSync(envPath, "utf-8");
        content.split("\n").forEach((line) => {
            const trimmed = line.trim().replace(/\r$/, "");
            if (!trimmed || trimmed.startsWith("#")) return;
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx < 0) return;
            const key = trimmed.slice(0, eqIdx).trim();
            const value = trimmed.slice(eqIdx + 1).trim();
            if (!process.env[key]) process.env[key] = value;
        });
    } catch (e) {
        console.error("No se pudo leer .env:", e.message);
    }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];

async function execSQL(sql, description) {
    process.stdout.write(`⏳ ${description}... `);

    try {
        const res = await fetch(
            `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({ query: sql }),
            }
        );

        const responseText = await res.text();

        if (res.status === 200 || res.status === 201) {
            console.log("✅");
            return true;
        } else {
            console.log(`❌ [${res.status}] ${responseText.substring(0, 200)}`);
            return false;
        }
    } catch (e) {
        console.log(`❌ Error de red: ${e.message}`);
        return false;
    }
}

async function main() {
    const ok = await execSQL("NOTIFY pgrst, 'reload schema'", "Reloading PostgREST Schema Cache");
    if (ok) {
        console.log("Schema cache reloaded successfully.");
    } else {
        console.log("Failed to reload schema cache.");
    }
}

main();
