/**
 * Carga datos iniciales en Supabase usando pg
 * Uso: node scripts/seed-data.mjs DB_PASSWORD
 */

import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const { Client } = pg;
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
    } catch (e) { }
}

loadEnv();

const PROJECT_REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const DB_PASSWORD = process.argv[2];

if (!DB_PASSWORD) {
    console.error("Uso: node scripts/seed-data.mjs TU_PASSWORD");
    process.exit(1);
}

const client = new Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
});

async function step(label, fn) {
    process.stdout.write(`⏳ ${label}... `);
    try {
        const result = await fn();
        console.log("✅");
        return result;
    } catch (e) {
        if (e.message.includes("duplicate key") || e.message.includes("already exists")) {
            console.log("⚠️  ya existe");
            return null;
        }
        console.log(`❌ ${e.message.split("\n")[0]}`);
        return null;
    }
}

async function main() {
    console.log("\n🌱 MMM SYSTEM - Cargando datos iniciales...\n");
    await client.connect();

    // 1. Sucursal
    const sucursalResult = await step("Sucursal principal", () =>
        client.query(`
      INSERT INTO sucursales (nombre, slug, direccion, telefono, activo)
      VALUES ('MMM Sucursal Principal', 'mmm-principal', 'Av. Principal 123', '+54 11 1234-5678', true)
      ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre
      RETURNING id, nombre
    `)
    );

    const { rows: sucRows } = await client.query(`SELECT id FROM sucursales WHERE slug = 'mmm-principal'`);
    if (!sucRows.length) { console.error("No se encontró la sucursal"); await client.end(); process.exit(1); }
    const sucId = sucRows[0].id;
    console.log(`   → ID: ${sucId}`);

    // 2. Config
    await step("Configuración de sucursal", () =>
        client.query(`
      INSERT INTO config_sucursal (
        sucursal_id, enable_delivery, enable_takeaway, enable_salon,
        aceptar_pedidos, tiempo_preparacion_default, moneda, cerrado_temporalmente
      ) VALUES ($1, true, true, false, true, 30, 'ARS', false)
      ON CONFLICT (sucursal_id) DO NOTHING
    `, [sucId])
    );

    // 3. Horarios
    await step("Horarios semanales", async () => {
        for (let dia = 0; dia <= 6; dia++) {
            await client.query(`
        INSERT INTO horarios_sucursal (sucursal_id, dia, cerrado, apertura1, cierre1)
        VALUES ($1, $2, $3, '09:00', '23:00')
        ON CONFLICT (sucursal_id, dia) DO NOTHING
      `, [sucId, dia, dia === 6]);
        }
    });

    // 4. Métodos de pago
    await step("Métodos de pago", async () => {
        const metodos = [
            ["Efectivo", "efectivo", 1],
            ["Transferencia", "transferencia", 2],
            ["Tarjeta Débito", "tarjeta_debito", 3],
            ["Tarjeta Crédito", "tarjeta_credito", 4],
            ["Mercado Pago", "mercado_pago", 5],
        ];
        for (const [nombre, codigo, orden] of metodos) {
            await client.query(`
        INSERT INTO metodos_pago (sucursal_id, nombre, codigo, activo, orden)
        VALUES ($1, $2, $3, true, $4)
        ON CONFLICT (sucursal_id, codigo) DO NOTHING
      `, [sucId, nombre, codigo, orden]);
        }
    });

    // 5. Zona de entrega
    await step("Zona de entrega", () =>
        client.query(`
      INSERT INTO zonas_entrega (sucursal_id, nombre, descripcion, costo_envio, minimo_compra, tiempo_estimado_minutos, activo)
      VALUES ($1, 'Zona Centro', 'Radio 5km del local', 500, 1500, 30, true)
    `, [sucId])
    );

    // 6. Mesas
    await step("Mesas de salón", async () => {
        const mesas = [[1, "Mesa 1", 4], [2, "Mesa 2", 4], [3, "Mesa 3", 6], [4, "Mesa 4", 2], [5, "Barra 1", 2]];
        for (const [num, nombre, cap] of mesas) {
            await client.query(`
        INSERT INTO mesas (sucursal_id, numero, nombre, capacidad, estado, activa)
        VALUES ($1, $2, $3, $4, 'libre', true)
        ON CONFLICT (sucursal_id, numero) DO NOTHING
      `, [sucId, num, nombre, cap]);
        }
    });

    // 7. Categorías
    await step("Categorías de menú", async () => {
        const cats = [["Hamburguesas", 1], ["Pizzas", 2], ["Bebidas", 3], ["Postres", 4]];
        for (const [nombre, orden] of cats) {
            await client.query(`
        INSERT INTO categorias (sucursal_id, nombre, orden, activo)
        VALUES ($1, $2, $3, true)
      `, [sucId, nombre, orden]);
        }
    });

    // 8. Productos
    await step("Productos de menú", async () => {
        const { rows: cats } = await client.query(
            `SELECT id, nombre FROM categorias WHERE sucursal_id = $1`, [sucId]
        );
        const catMap = Object.fromEntries(cats.map(c => [c.nombre, c.id]));

        const productos = [
            ["Hamburguesas", "Hamburguesa Clásica", "Pan brioche, carne 200g, lechuga, tomate, cheddar", 2500, 1, false],
            ["Hamburguesas", "Hamburguesa BBQ", "Pan negro, carne 200g, panceta, cebolla, salsa BBQ", 3200, 2, true],
            ["Hamburguesas", "Hamburguesa Doble", "Doble carne, doble cheddar, panceta crocante", 3800, 3, false],
            ["Pizzas", "Pizza Mozzarella", "Salsa de tomate, mozzarella, albahaca", 2800, 1, false],
            ["Pizzas", "Pizza Napolitana", "Salsa de tomate, mozzarella, tomate, ajo, albahaca", 3100, 2, true],
            ["Bebidas", "Coca Cola 500ml", null, 800, 1, false],
            ["Bebidas", "Fanta Naranja 500ml", null, 800, 2, false],
            ["Bebidas", "Agua Mineral", null, 500, 3, false],
            ["Postres", "Brownie con helado", "Brownie tibio con helado de vainilla", 1500, 1, true],
        ];

        for (const [catNombre, nombre, descripcion, precio, orden, sugerido] of productos) {
            const catId = catMap[catNombre];
            if (!catId) continue;
            await client.query(`
        INSERT INTO productos (sucursal_id, categoria_id, nombre, descripcion, precio, orden, activo, visible_en_menu, producto_oculto, producto_sugerido)
        VALUES ($1, $2, $3, $4, $5, $6, true, true, false, $7)
      `, [sucId, catId, nombre, descripcion, precio, orden, sugerido]);
        }
    });

    // 9. Pedidos de ejemplo
    await step("Pedidos de ejemplo", async () => {
        const pedidos = [
            ["delivery", "pendiente", "Juan García", "1155667788", "Av. Corrientes 1500", 3300, 500, 3800, "Efectivo"],
            ["takeaway", "preparando", "María López", "1144556677", null, 2500, 0, 2500, "Mercado Pago"],
            ["delivery", "listo", "Carlos Rodríguez", "1133445566", "Callao 890", 6400, 500, 6900, "Transferencia"],
            ["salon", "preparando", "Mesa 3", null, null, 5600, 0, 5600, "Tarjeta Débito"],
            ["delivery", "en_camino", "Laura Martínez", "1122334455", "Santa Fe 2100", 4200, 500, 4700, "Efectivo"],
            ["takeaway", "entregado", "Pedro Silva", "1111223344", null, 1800, 0, 1800, "Efectivo"],
        ];
        for (const [tipo, estado, cliente, telefono, direccion, subtotal, envio, total, metodo] of pedidos) {
            await client.query(`
        INSERT INTO pedidos (sucursal_id, numero_pedido, tipo, estado, cliente_nombre, cliente_telefono, cliente_direccion, subtotal, costo_envio, total, metodo_pago_nombre, origen)
        VALUES ($1, '', $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pos')
      `, [sucId, tipo, estado, cliente, telefono, direccion, subtotal, envio, total, metodo]);
        }
    });

    // Resumen final
    const counts = await Promise.all([
        client.query("SELECT COUNT(*) FROM sucursales"),
        client.query("SELECT COUNT(*) FROM categorias"),
        client.query("SELECT COUNT(*) FROM productos"),
        client.query("SELECT COUNT(*) FROM pedidos"),
        client.query("SELECT COUNT(*) FROM mesas"),
    ]);

    console.log("\n📊 Resumen:");
    console.log(`   • Sucursales:  ${counts[0].rows[0].count}`);
    console.log(`   • Categorías:  ${counts[1].rows[0].count}`);
    console.log(`   • Productos:   ${counts[2].rows[0].count}`);
    console.log(`   • Pedidos:     ${counts[3].rows[0].count}`);
    console.log(`   • Mesas:       ${counts[4].rows[0].count}`);

    console.log("\n✅ ¡Datos cargados! Supabase listo.\n");
    await client.end();
}

main().catch(async (e) => {
    console.error("❌", e.message);
    await client.end().catch(() => { });
    process.exit(1);
});
