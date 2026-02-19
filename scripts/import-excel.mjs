/**
 * Importa el menú desde mmm_pizza_menu.xlsx a Supabase
 * Uso: node scripts/import-excel.mjs DB_PASSWORD
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
    console.error('❌ Falta contraseña. Uso: node scripts/import-excel.mjs TU_PASSWORD');
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
    console.log('🚀 Iniciando importación desde Excel...\n');
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
    const workbook = XLSX.readFile(join(__dirname, '..', 'mmm_pizza_menu.xlsx'));
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    console.log(`📄 Registros en Excel: ${data.length}`);

    // 3. Procesar Categorías (primero las coleccionamos)
    const categoryNames = [...new Set(data.map(item => item['Categoría']).filter(Boolean))];
    console.log(`📂 Categorías únicas: ${categoryNames.length}`);

    const catMap = {}; // nombre -> id

    for (const catName of categoryNames) {
        const { rows } = await client.query(
            'INSERT INTO categorias (sucursal_id, nombre, activo) VALUES ($1, $2, true) ON CONFLICT DO NOTHING RETURNING id',
            [sucursalId, catName]
        );

        if (rows.length) {
            catMap[catName] = rows[0].id;
        } else {
            const { rows: existing } = await client.query('SELECT id FROM categorias WHERE sucursal_id = $1 AND nombre = $2', [sucursalId, catName]);
            catMap[catName] = existing[0].id;
        }
    }

    // 4. Importar Productos
    console.log('🍕 Importando productos...');
    let importedCount = 0;
    let skippedCount = 0;

    for (const item of data) {
        const nombre = item['Nombre Producto'];
        const categoria = item['Categoría'];
        const precio = parseFloat(item['Precio Venta']) || 0;
        const desc = item['Descripción Producto'] || '';
        const img = item['Imagen Producto'] || '';
        const sugerido = item['Es producto sugerido'] === true || item['Es producto sugerido'] === 'true';
        const oculto = item['Es producto oculto'] === true || item['Es producto oculto'] === 'true';
        const activo = item['Está activo'] === true || item['Está activo'] === 'true' || item['Está activo'] === undefined;

        if (!nombre || !catMap[categoria]) {
            skippedCount++;
            continue;
        }

        try {
            await client.query(
                `INSERT INTO productos (
          sucursal_id, categoria_id, nombre, nombre_interno, descripcion, 
          precio, imagen_url, producto_sugerido, producto_oculto, activo, visible_en_menu
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                    sucursalId,
                    catMap[categoria],
                    nombre,
                    item['Nombre Interno Producto'] || nombre,
                    desc,
                    precio,
                    img,
                    sugerido,
                    oculto,
                    activo,
                    !oculto
                ]
            );
            importedCount++;
        } catch (e) {
            console.error(`⚠️ Error con producto "${nombre}": ${e.message}`);
            skippedCount++;
        }
    }

    console.log(`\n✅ Importación completada:`);
    console.log(`   - Productos importados: ${importedCount}`);
    console.log(`   - Productos saltados/error: ${skippedCount}`);

    await client.end();
}

main().catch(async e => {
    console.error('❌ Error crítico:', e);
    await client.end().catch(() => { });
});
