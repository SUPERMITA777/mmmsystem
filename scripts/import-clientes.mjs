/**
 * Importa clientes desde clientes_pedisy.xlsx a Supabase
 * Uso: node scripts/import-clientes.mjs DB_PASSWORD
 */

import pg from 'pg';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    try {
        const envPath = join(__dirname, '..', '.env');
        const content = readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const [key, ...parts] = trimmed.split('=');
            const value = parts.join('=').trim();
            if (!process.env[key]) process.env[key] = value;
        });
    } catch (e) { }
}

loadEnv();

const PROJECT_REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const DB_PASSWORD = process.argv[2];

if (!DB_PASSWORD) {
    console.error('❌ Falta contraseña. Uso: node scripts/import-clientes.mjs TU_PASSWORD');
    process.exit(1);
}

const client = new Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    console.log('🚀 Iniciando importación de clientes desde Excel...\n');
    await client.connect();

    // 1. Obtener sucursal
    const { rows: sucRows } = await client.query('SELECT id FROM sucursales LIMIT 1');
    if (!sucRows.length) {
        console.error('❌ No se encontró ninguna sucursal en la base de datos.');
        await client.end();
        return;
    }
    const sucursalId = sucRows[0].id;
    console.log(`📍 Sucursal ID: ${sucursalId}`);

    // 2. Leer Excel
    const workbook = XLSX.readFile(join(__dirname, '..', 'clientes_pedisy.xlsx'));
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    console.log(`📄 Registros en Excel: ${data.length}`);

    // 3. Importar Clientes
    console.log('👥 Importando clientes...');
    let importedCount = 0;
    let skippedCount = 0;

    for (const item of data) {
        const name = item['name'] || 'Cliente sin nombre';
        const email = item['email'] || null;
        const phone = item['number'] ? item['number'].toString() : null;
        const address = item['address'] || null;
        const totalOrders = parseInt(item['orders']) || 0;
        const totalSpent = parseFloat(item['totalSpend']) || 0;

        // Split name and surname if possible (optional but cleaner)
        const nameParts = name.trim().split(' ');
        const nombre = nameParts[0];
        const apellido = nameParts.slice(1).join(' ') || '';

        try {
            await client.query(
                `INSERT INTO clientes (
          sucursal_id, nombre, apellido, telefono, email, direccion, total_pedidos, total_gastado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    sucursalId,
                    nombre,
                    apellido,
                    phone,
                    email,
                    address,
                    totalOrders,
                    totalSpent
                ]
            );
            importedCount++;
        } catch (e) {
            console.error(`⚠️ Error con cliente "${name}": ${e.message}`);
            skippedCount++;
        }
    }

    console.log(`\n✅ Importación de clientes completada:`);
    console.log(`   - Clientes importados: ${importedCount}`);
    console.log(`   - Clientes saltados/error: ${skippedCount}`);

    await client.end();
}

main().catch(async e => {
    console.error('❌ Error crítico:', e);
    await client.end().catch(() => { });
});
