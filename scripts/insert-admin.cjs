const { readFileSync } = require("fs");
const { join } = require("path");
const { createClient } = require("@supabase/supabase-js");

// Load .env
const content = readFileSync(join(__dirname, "..", ".env"), "utf-8");
content.split("\n").forEach(line => {
    const t = line.trim().replace(/\r$/, "");
    if (!t || t.startsWith("#")) return;
    const idx = t.indexOf("=");
    if (idx < 0) return;
    process.env[t.slice(0, idx).trim()] = process.env[t.slice(0, idx).trim()] || t.slice(idx + 1).trim();
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("URL:", SUPABASE_URL);
console.log("Key starts with:", SERVICE_KEY?.substring(0, 20));

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    // Try insert
    console.log("\nInserting admin user...");
    const { data, error } = await supabase.from("usuarios").insert({
        id: "5c6f68b9-173c-4edc-a9ef-dec45829aa88",
        email: "ema@mmm.com",
        nombre: "Admin",
        rol: "super_admin",
        activo: true,
    });

    if (error) {
        console.log("Insert error:", error.message, error.code);
        if (error.code === "23505") {
            console.log("User already exists, trying upsert...");
            const { error: e2 } = await supabase.from("usuarios").upsert({
                id: "5c6f68b9-173c-4edc-a9ef-dec45829aa88",
                email: "ema@mmm.com",
                nombre: "Admin",
                rol: "super_admin",
                activo: true,
            }, { onConflict: "id" });
            if (e2) console.log("Upsert error:", e2.message);
            else console.log("Upsert OK");
        }
    } else {
        console.log("Insert OK");
    }

    // Verify
    console.log("\nVerifying...");
    const { data: rows, error: selErr } = await supabase.from("usuarios").select("*");
    if (selErr) console.log("Select error:", selErr.message);
    else console.log("Rows:", JSON.stringify(rows, null, 2));
}

main().catch(e => console.error("Fatal:", e.message));
