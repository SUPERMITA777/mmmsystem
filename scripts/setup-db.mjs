/**
 * Script de setup completo para MMM SYSTEM
 * Crea tablas y datos iniciales directamente via Supabase API
 * 
 * Uso: node scripts/setup-db.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargar .env
function loadEnv() {
    try {
        const envPath = join(__dirname, "..", ".env");
        const content = readFileSync(envPath, "utf-8");
        content.split("\n").forEach((line) => {
            const [key, ...rest] = line.split("=");
            if (key && rest.length > 0) {
                const value = rest.join("=").trim().replace(/\r$/, "");
                if (!process.env[key.trim()]) {
                    process.env[key.trim()] = value;
                }
            }
        });
    } catch (e) {
        console.error("No se pudo leer .env:", e.message);
    }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];

// Headers para todas las requests
const headers = {
    "Content-Type": "application/json",
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    "Prefer": "return=representation",
};

async function supabaseQuery(table, method = "GET", body = null) {
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const text = await res.text();

    try {
        return { data: JSON.parse(text), status: res.status, ok: res.ok };
    } catch {
        return { data: text, status: res.status, ok: res.ok };
    }
}

async function supabaseInsert(table, body, onConflict = null) {
    const hdrs = { ...headers };
    if (onConflict) {
        hdrs["Prefer"] = `resolution=merge-duplicates,return=representation`;
    }

    const url = `${SUPABASE_URL}/rest/v1/${table}${onConflict ? `?on_conflict=${onConflict}` : ""}`;

    const res = await fetch(url, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify(body),
    });

    const text = await res.text();
    try {
        return { data: JSON.parse(text), status: res.status, ok: res.ok };
    } catch {
        return { data: text, status: res.status, ok: res.ok };
    }
}

async function checkConnection() {
    console.log("🔌 Verificando conexión con Supabase...");
    console.log(`   URL: ${SUPABASE_URL}`);
    console.log(`   Proyecto: ${PROJECT_REF}`);

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers });
        if (res.status === 200 || res.status === 404) {
            console.log("   ✅ Conexión OK");
            return true;
        }
        console.log("   ❌ Error de conexión:", res.status);
        return false;
    } catch (e) {
        console.error("   ❌ Error de red:", e.message);
        return false;
    }
}

async function checkTableExists(tableName) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?limit=1`, {
            headers,
        });
        return res.status !== 404 && res.status !== 406;
    } catch {
        return false;
    }
}

async function seedData() {
    console.log("\n🌱 Insertando datos iniciales...");

    // 1. Sucursal principal
    let sucursalId = null;

    // Primero verificar si ya existe
    const existing = await supabaseQuery("sucursales?slug=eq.mmm-principal&select=id,nombre");

    if (existing.ok && Array.isArray(existing.data) && existing.data.length > 0) {
        sucursalId = existing.data[0].id;
        console.log(`   ✅ Sucursal ya existe: ${existing.data[0].nombre} (${sucursalId})`);
    } else {
        // Crear nueva
        const { data, ok } = await supabaseInsert("sucursales", {
            nombre: "MMM Sucursal Principal",
            slug: "mmm-principal",
            direccion: "Av. Principal 123",
            telefono: "+54 11 1234-5678",
            activo: true,
        }, "slug");

        if (!ok || !data || !Array.isArray(data) || data.length === 0) {
            console.error("   ❌ Error creando sucursal:", JSON.stringify(data));
            return null;
        }
        sucursalId = data[0].id;
        console.log(`   ✅ Sucursal creada: ${data[0].nombre} (${sucursalId})`);
    }

    // 2. Configuración de sucursal
    const { ok: configOk, data: configData } = await supabaseInsert("config_sucursal", {
        sucursal_id: sucursalId,
        enable_delivery: true,
        enable_takeaway: true,
        enable_salon: false,
        aceptar_pedidos: true,
        tiempo_preparacion_default: 30,
        moneda: "ARS",
        cerrado_temporalmente: false,
    }, "sucursal_id");

    if (configOk) {
        console.log("   ✅ Configuración de sucursal OK");
    } else {
        console.log("   ⚠️  Config:", JSON.stringify(configData).substring(0, 100));
    }

    // 3. Horarios
    const horarios = [];
    for (let i = 0; i < 7; i++) {
        horarios.push({
            sucursal_id: sucursalId,
            dia: i,
            cerrado: i === 6,
            apertura1: "09:00:00",
            cierre1: "23:00:00",
        });
    }

    const { ok: horariosOk } = await supabaseInsert("horarios_sucursal", horarios, "sucursal_id,dia");
    console.log(horariosOk ? "   ✅ Horarios creados" : "   ⚠️  Horarios ya existen o error");

    // 4. Métodos de pago
    const metodosPago = [
        { sucursal_id: sucursalId, nombre: "Efectivo", codigo: "efectivo", activo: true, orden: 1 },
        { sucursal_id: sucursalId, nombre: "Transferencia", codigo: "transferencia", activo: true, orden: 2 },
        { sucursal_id: sucursalId, nombre: "Tarjeta Débito", codigo: "tarjeta_debito", activo: true, orden: 3 },
        { sucursal_id: sucursalId, nombre: "Tarjeta Crédito", codigo: "tarjeta_credito", activo: true, orden: 4 },
        { sucursal_id: sucursalId, nombre: "Mercado Pago", codigo: "mercado_pago", activo: true, orden: 5 },
    ];

    const { ok: mpOk } = await supabaseInsert("metodos_pago", metodosPago, "sucursal_id,codigo");
    console.log(mpOk ? "   ✅ Métodos de pago creados" : "   ⚠️  Métodos de pago ya existen o error");

    // 5. Categorías
    const categoriasDatos = [
        { sucursal_id: sucursalId, nombre: "Hamburguesas", orden: 1, activo: true },
        { sucursal_id: sucursalId, nombre: "Pizzas", orden: 2, activo: true },
        { sucursal_id: sucursalId, nombre: "Bebidas", orden: 3, activo: true },
        { sucursal_id: sucursalId, nombre: "Postres", orden: 4, activo: true },
    ];

    const { data: catData, ok: catOk } = await supabaseInsert("categorias", categoriasDatos);
    let categorias = [];
    if (catOk && Array.isArray(catData)) {
        categorias = catData;
        console.log(`   ✅ ${categorias.length} categorías creadas`);
    } else {
        // Categorías ya existen, buscarlas
        const { data: existingCats } = await supabaseQuery(
            `categorias?sucursal_id=eq.${sucursalId}&select=id,nombre&order=orden`
        );
        if (Array.isArray(existingCats)) {
            categorias = existingCats;
            console.log(`   ✅ ${categorias.length} categorías ya existentes`);
        }
    }

    // 6. Productos de ejemplo
    const catHamburguesas = categorias.find(c => c.nombre === "Hamburguesas");
    const catBebidas = categorias.find(c => c.nombre === "Bebidas");
    const catPizzas = categorias.find(c => c.nombre === "Pizzas");

    if (catHamburguesas || catBebidas) {
        const productos = [];

        if (catHamburguesas) {
            productos.push(
                { sucursal_id: sucursalId, categoria_id: catHamburguesas.id, nombre: "Hamburguesa Clásica", descripcion: "Pan brioche, carne 200g, lechuga, tomate, cheddar", precio: 2500, orden: 1, activo: true, visible_en_menu: true, producto_oculto: false, producto_sugerido: false },
                { sucursal_id: sucursalId, categoria_id: catHamburguesas.id, nombre: "Hamburguesa BBQ", descripcion: "Pan negro, carne 200g, panceta, cebolla caramelizada, salsa BBQ", precio: 3200, orden: 2, activo: true, visible_en_menu: true, producto_oculto: false, producto_sugerido: true },
                { sucursal_id: sucursalId, categoria_id: catHamburguesas.id, nombre: "Hamburguesa Doble", descripcion: "Doble carne, doble cheddar, panceta crocante", precio: 3800, orden: 3, activo: true, visible_en_menu: true, producto_oculto: false, producto_sugerido: false }
            );
        }

        if (catBebidas) {
            productos.push(
                { sucursal_id: sucursalId, categoria_id: catBebidas.id, nombre: "Coca Cola 500ml", precio: 800, orden: 1, activo: true, visible_en_menu: true, producto_oculto: false, producto_sugerido: false },
                { sucursal_id: sucursalId, categoria_id: catBebidas.id, nombre: "Fanta Naranja 500ml", precio: 800, orden: 2, activo: true, visible_en_menu: true, producto_oculto: false, producto_sugerido: false },
                { sucursal_id: sucursalId, categoria_id: catBebidas.id, nombre: "Agua Mineral", precio: 500, orden: 3, activo: true, visible_en_menu: true, producto_oculto: false, producto_sugerido: false }
            );
        }

        if (catPizzas) {
            productos.push(
                { sucursal_id: sucursalId, categoria_id: catPizzas.id, nombre: "Pizza Mozzarella", descripcion: "Salsa de tomate, mozzarella, albahaca fresca", precio: 2800, orden: 1, activo: true, visible_en_menu: true, producto_oculto: false, producto_sugerido: false },
                { sucursal_id: sucursalId, categoria_id: catPizzas.id, nombre: "Pizza Napolitana", descripcion: "Salsa de tomate, mozzarella, tomate, ajo, albahaca", precio: 3100, orden: 2, activo: true, visible_en_menu: true, producto_oculto: false, producto_sugerido: false }
            );
        }

        const { data: prodData, ok: prodOk, status } = await supabaseInsert("productos", productos);

        if (prodOk && Array.isArray(prodData)) {
            console.log(`   ✅ ${prodData.length} productos creados`);
        } else {
            console.log(`   ⚠️  Productos: status=${status}, ${JSON.stringify(prodData).substring(0, 150)}`);
        }
    }

    // 7. Zona de entrega
    const { ok: zonaOk } = await supabaseInsert("zonas_entrega", {
        sucursal_id: sucursalId,
        nombre: "Zona Centro",
        descripcion: "Radio 5km del local",
        costo_envio: 500,
        minimo_compra: 1500,
        tiempo_estimado_minutos: 30,
        activo: true,
    });
    console.log(zonaOk ? "   ✅ Zona de entrega creada" : "   ⚠️  Zona ya existe o error");

    // 8. Pedidos de ejemplo (para ver el panel)
    const pedidosEjemplo = [
        {
            sucursal_id: sucursalId,
            numero_pedido: "",
            tipo: "delivery",
            estado: "pendiente",
            cliente_nombre: "Juan García",
            cliente_telefono: "1155667788",
            cliente_direccion: "Av. Corrientes 1500",
            subtotal: 3300,
            costo_envio: 500,
            total: 3800,
            metodo_pago_nombre: "Efectivo",
            origen: "pos",
        },
        {
            sucursal_id: sucursalId,
            numero_pedido: "",
            tipo: "takeaway",
            estado: "preparando",
            cliente_nombre: "María López",
            cliente_telefono: "1144556677",
            subtotal: 2500,
            total: 2500,
            metodo_pago_nombre: "Mercado Pago",
            origen: "pos",
        },
        {
            sucursal_id: sucursalId,
            numero_pedido: "",
            tipo: "delivery",
            estado: "listo",
            cliente_nombre: "Carlos Rodríguez",
            cliente_telefono: "1133445566",
            cliente_direccion: "Callao 890",
            subtotal: 6400,
            costo_envio: 500,
            total: 6900,
            metodo_pago_nombre: "Transferencia",
            origen: "pos",
        },
        {
            sucursal_id: sucursalId,
            numero_pedido: "",
            tipo: "salon",
            estado: "preparando",
            cliente_nombre: "Mesa 3",
            subtotal: 5600,
            total: 5600,
            metodo_pago_nombre: "Tarjeta Débito",
            origen: "pos",
        },
    ];

    const { data: pedData, ok: pedOk } = await supabaseInsert("pedidos", pedidosEjemplo);
    if (pedOk && Array.isArray(pedData)) {
        console.log(`   ✅ ${pedData.length} pedidos de ejemplo creados`);
    } else {
        console.log(`   ⚠️  Pedidos: ${JSON.stringify(pedData).substring(0, 150)}`);
    }

    console.log(`\n🎉 Setup completado!`);
    console.log(`📋 Sucursal ID: ${sucursalId}`);
    return sucursalId;
}

async function main() {
    console.log("=".repeat(50));
    console.log("  MMM SYSTEM - Setup de Base de Datos");
    console.log("=".repeat(50));

    const connected = await checkConnection();
    if (!connected) {
        console.error("\n❌ No se pudo conectar a Supabase. Verifica el .env");
        process.exit(1);
    }

    // Verificar si las tablas existen
    console.log("\n🔍 Verificando tablas...");
    const tablesExist = await checkTableExists("sucursales");

    if (!tablesExist) {
        console.log("\n❌ Las tablas NO existen en Supabase.");
        console.log("\n📋 Debes ejecutar el SQL de migración en el SQL Editor de Supabase:");
        console.log(`\n   🔗 https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
        console.log("\n   El archivo SQL está en: supabase/migrations/001_initial_schema.sql");
        console.log("\n   Después de ejecutarlo, corre este script nuevamente:");
        console.log("   node scripts/setup-db.mjs");
        process.exit(1);
    }

    console.log("   ✅ Tablas encontradas");

    // Insertar datos iniciales
    await seedData();

    console.log("\n" + "=".repeat(50));
    console.log("✅ Todo listo. Ahora puedes iniciar el servidor:");
    console.log('   npm run dev');
    console.log("=".repeat(50));
}

main().catch((e) => {
    console.error("\n❌ Error inesperado:", e.message);
    console.error(e.stack);
    process.exit(1);
});
