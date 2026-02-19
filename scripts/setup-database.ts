/**
 * Script para ejecutar las migraciones de Supabase
 * 
 * Uso:
 * 1. Asegúrate de tener las variables de entorno configuradas en .env
 * 2. Ejecuta: npx tsx scripts/setup-database.ts
 */

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { readFileSync } from "fs";
import { join } from "path";

async function runMigration(fileName: string) {
  console.log(`\n📄 Ejecutando migración: ${fileName}...`);
  
  try {
    const migrationPath = join(process.cwd(), "supabase/migrations", fileName);
    const sql = readFileSync(migrationPath, "utf-8");
    
    // Ejecutar el SQL usando Supabase
    const { error } = await supabaseAdmin.rpc("exec_sql", { sql_query: sql });
    
    if (error) {
      // Si no existe la función exec_sql, ejecutamos directamente
      // Nota: Esto requiere usar la API REST de Supabase o psql directamente
      console.log(`⚠️  No se pudo ejecutar automáticamente. Por favor ejecuta manualmente en Supabase SQL Editor:`);
      console.log(`   Archivo: ${migrationPath}`);
      return false;
    }
    
    console.log(`✅ Migración ${fileName} ejecutada correctamente`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error ejecutando ${fileName}:`, error.message);
    return false;
  }
}

async function setupDatabase() {
  console.log("🚀 Iniciando configuración de base de datos...\n");
  
  const migrations = [
    "001_initial_schema.sql",
    "002_rls_policies.sql"
  ];
  
  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (!success) {
      console.log(`\n⚠️  La migración ${migration} debe ejecutarse manualmente.`);
      console.log(`   Ve a Supabase Dashboard > SQL Editor y ejecuta el contenido del archivo.`);
    }
  }
  
  console.log("\n✨ Configuración completada!");
  console.log("\n📝 Próximos pasos:");
  console.log("   1. Ve a Supabase Dashboard > SQL Editor");
  console.log("   2. Ejecuta los archivos SQL en orden:");
  migrations.forEach(m => console.log(`      - supabase/migrations/${m}`));
  console.log("   3. Verifica que las tablas se hayan creado correctamente");
}

setupDatabase().catch(console.error);
