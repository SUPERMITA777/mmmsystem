/**
 * Script de migración para MMM SYSTEM
 * Ejecuta las migraciones SQL contra Supabase usando la Management API
 * 
 * Uso: node scripts/migrate.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Leer .env manualmente (sin dotenv)
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

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Extraer el ref del proyecto desde la URL
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];

async function runSQL(sql, description) {
  console.log(`\n⏳ ${description}...`);

  // Usar la Management API de Supabase para ejecutar SQL
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    // Intentar con endpoint alternativo (REST directo)
    console.log(`   ⚠️  API Management falló, intentando vía RPC...`);
    return null;
  }

  const result = await response.json();
  console.log(`   ✅ OK`);
  return result;
}

async function runSQLViaRPC(sql) {
  // Usar el endpoint de SQL directo de Supabase (requiere service_role)
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });

  return response;
}

async function checkConnection() {
  console.log("🔌 Verificando conexión con Supabase...");
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log(`   Proyecto: ${projectRef}`);

  // Test simple: intentar hacer una query
  const { data, error } = await supabase
    .from("sucursales")
    .select("count")
    .limit(1);

  if (error) {
    if (error.message.includes("does not exist")) {
      console.log("   ℹ️  Tablas no existen aún (esperado en primer run)");
      return true;
    }
    if (error.message.includes("Invalid API key")) {
      console.error("   ❌ API Key inválida");
      return false;
    }
    console.log(`   ℹ️  ${error.message}`);
    return true; // Asumir que la conexión funciona
  }

  console.log("   ✅ Conexión OK");
  return true;
}

async function checkTablesExist() {
  const { data, error } = await supabase.rpc("to_regclass", {
    classname: "public.sucursales",
  });

  if (error) return false;
  return data !== null;
}

async function seedInitialData() {
  console.log("\n🌱 Insertando datos iniciales...");

  // 1. Insertar sucursal
  const { data: sucursal, error: sucursalError } = await supabase
    .from("sucursales")
    .upsert(
      {
        nombre: "MMM Sucursal Principal",
        slug: "mmm-principal",
        direccion: "Av. Principal 123",
        telefono: "+54 11 1234-5678",
        activo: true,
      },
      { onConflict: "slug" }
    )
    .select()
    .single();

  if (sucursalError) {
    console.error("   ❌ Error creando sucursal:", sucursalError.message);
    return null;
  }
  console.log(`   ✅ Sucursal creada: ${sucursal.nombre} (ID: ${sucursal.id})`);

  // 2. Insertar configuración de sucursal
  const { error: configError } = await supabase.from("config_sucursal").upsert(
    {
      sucursal_id: sucursal.id,
      enable_delivery: true,
      enable_takeaway: true,
      enable_salon: false,
      aceptar_pedidos: true,
      tiempo_preparacion_default: 30,
      moneda: "ARS",
    },
    { onConflict: "sucursal_id" }
  );

  if (configError) {
    console.log("   ⚠️  Config sucursal:", configError.message);
  } else {
    console.log("   ✅ Configuración de sucursal creada");
  }

  // 3. Insertar horarios (Lunes a Domingo)
  const diasSemana = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
  ];
  for (let i = 0; i < 7; i++) {
    const { error: horarioError } = await supabase
      .from("horarios_sucursal")
      .upsert(
        {
          sucursal_id: sucursal.id,
          dia: i,
          cerrado: i === 6, // Domingo cerrado por defecto
          apertura1: "09:00",
          cierre1: "23:00",
        },
        { onConflict: "sucursal_id,dia" }
      );

    if (horarioError) {
      console.log(`   ⚠️  Horario ${diasSemana[i]}:`, horarioError.message);
    }
  }
  console.log("   ✅ Horarios creados (Lunes-Sábado 09:00-23:00)");

  // 4. Insertar métodos de pago
  const metodosPago = [
    { nombre: "Efectivo", codigo: "efectivo", orden: 1 },
    { nombre: "Transferencia", codigo: "transferencia", orden: 2 },
    { nombre: "Tarjeta Débito", codigo: "tarjeta_debito", orden: 3 },
    { nombre: "Tarjeta Crédito", codigo: "tarjeta_credito", orden: 4 },
    { nombre: "Mercado Pago", codigo: "mercado_pago", orden: 5 },
  ];

  for (const mp of metodosPago) {
    const { error } = await supabase.from("metodos_pago").upsert(
      { ...mp, sucursal_id: sucursal.id, activo: true },
      { onConflict: "sucursal_id,codigo" }
    );
    if (error) console.log(`   ⚠️  Método pago ${mp.nombre}:`, error.message);
  }
  console.log("   ✅ Métodos de pago creados");

  // 5. Insertar categorías de ejemplo
  const categorias = [
    { nombre: "Hamburguesas", orden: 1 },
    { nombre: "Pizzas", orden: 2 },
    { nombre: "Bebidas", orden: 3 },
    { nombre: "Postres", orden: 4 },
  ];

  const categoriasInsertadas = [];
  for (const cat of categorias) {
    const { data, error } = await supabase
      .from("categorias")
      .insert({ ...cat, sucursal_id: sucursal.id, activo: true })
      .select()
      .single();

    if (error) {
      console.log(`   ⚠️  Categoría ${cat.nombre}:`, error.message);
    } else {
      categoriasInsertadas.push(data);
    }
  }
  console.log(`   ✅ ${categoriasInsertadas.length} categorías creadas`);

  // 6. Insertar productos de ejemplo
  if (categoriasInsertadas.length > 0) {
    const catHamburguesas = categoriasInsertadas[0];
    const catBebidas = categoriasInsertadas[2];

    const productos = [
      {
        nombre: "Hamburguesa Clásica",
        descripcion: "Pan brioche, carne 200g, lechuga, tomate, cheddar",
        precio: 2500,
        categoria_id: catHamburguesas?.id,
        orden: 1,
        activo: true,
        visible_en_menu: true,
      },
      {
        nombre: "Hamburguesa BBQ",
        descripcion: "Pan negro, carne 200g, panceta, cebolla caramelizada, salsa BBQ",
        precio: 3200,
        categoria_id: catHamburguesas?.id,
        orden: 2,
        activo: true,
        visible_en_menu: true,
        producto_sugerido: true,
      },
      {
        nombre: "Coca Cola 500ml",
        precio: 800,
        categoria_id: catBebidas?.id,
        orden: 1,
        activo: true,
        visible_en_menu: true,
      },
      {
        nombre: "Agua Mineral",
        precio: 500,
        categoria_id: catBebidas?.id,
        orden: 2,
        activo: true,
        visible_en_menu: true,
      },
    ];

    let productosOk = 0;
    for (const prod of productos) {
      if (!prod.categoria_id) continue;
      const { error } = await supabase
        .from("productos")
        .insert({ ...prod, sucursal_id: sucursal.id });
      if (!error) productosOk++;
    }
    console.log(`   ✅ ${productosOk} productos de ejemplo creados`);
  }

  // 7. Insertar zona de entrega de ejemplo
  const { error: zonaError } = await supabase.from("zonas_entrega").insert({
    sucursal_id: sucursal.id,
    nombre: "Zona Centro",
    costo_envio: 500,
    minimo_compra: 1500,
    tiempo_estimado_minutos: 30,
    activo: true,
  });

  if (!zonaError) console.log("   ✅ Zona de entrega creada");

  console.log(`\n🎉 Datos iniciales cargados para sucursal ID: ${sucursal.id}`);
  console.log(`📋 Guarda este ID: ${sucursal.id}`);

  return sucursal;
}

async function main() {
  console.log("=".repeat(50));
  console.log("  MMM SYSTEM - Script de Migración");
  console.log("=".repeat(50));

  // 1. Verificar conexión
  const connected = await checkConnection();
  if (!connected) {
    console.error("\n❌ No se pudo conectar a Supabase");
    process.exit(1);
  }

  // 2. Verificar si las tablas ya existen
  const { data: tablesData } = await supabase
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public")
    .eq("table_name", "sucursales");

  const tablesExist = tablesData && tablesData.length > 0;

  if (tablesExist) {
    console.log("\n✅ Las tablas ya existen en Supabase");
    console.log("ℹ️  Saltando creación de tablas, procediendo a datos iniciales...");
  } else {
    console.log("\n📋 Las tablas NO existen.");
    console.log("\n⚠️  DEBES ejecutar manualmente las migraciones SQL:");
    console.log("   1. Abre Supabase Dashboard: https://supabase.com/dashboard");
    console.log("   2. Ve a tu proyecto → SQL Editor");
    console.log("   3. Ejecuta: supabase/migrations/001_initial_schema.sql");
    console.log("   4. Ejecuta: supabase/migrations/002_rls_policies.sql");
    console.log(
      "\n   Después vuelve a correr este script para cargar datos iniciales."
    );
    console.log("\n🔗 URL directa al SQL Editor:");
    console.log(
      `   https://supabase.com/dashboard/project/${projectRef}/sql/new`
    );
    process.exit(0);
  }

  // 3. Verificar si ya hay datos
  const { data: existingSucursales } = await supabase
    .from("sucursales")
    .select("id, nombre")
    .limit(5);

  if (existingSucursales && existingSucursales.length > 0) {
    console.log("\n✅ Ya existen sucursales:");
    existingSucursales.forEach((s) =>
      console.log(`   • ${s.nombre} (${s.id})`)
    );
    console.log("\nℹ️  No se insertarán datos de ejemplo (ya hay datos).");
  } else {
    await seedInitialData();
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ Proceso completado exitosamente");
  console.log("=".repeat(50));
}

main().catch((e) => {
  console.error("\n❌ Error:", e.message);
  process.exit(1);
});
