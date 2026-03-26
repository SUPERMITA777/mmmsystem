import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf8');

// Parse .env manualmente
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
      envVars[key] = val;
    }
  }
}

const URL = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const KEY = envVars['SUPABASE_SERVICE_ROLE_KEY'] || envVars['SUPABASE_SECRET_KEY'];

console.log('URL:', URL ? URL.substring(0, 40) + '...' : 'MISSING');
console.log('KEY:', KEY ? `presente (${KEY.length} chars)` : 'MISSING');

if (!URL || !KEY) {
  console.error('Faltan variables de entorno. Abortando.');
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function diagnose() {
  console.log('\n=== DIAGNÓSTICO DE TABLA sucursal_flyers ===');

  // 1. Leer registros
  const { data: rows, error: readError } = await supabase.from('sucursal_flyers').select('*').limit(3);
  if (readError) {
    console.error('❌ Error al leer:', JSON.stringify(readError, null, 2));
    return;
  }
  console.log('✅ Tabla accesible. Columnas disponibles:', rows.length > 0 ? Object.keys(rows[0]).join(', ') : 'tabla vacía');
  if (rows.length > 0) console.log('Primer registro:', JSON.stringify(rows[0]));

  // 2. Intentar upsert con todos los campos nuevos
  const testData = {
    sucursal_id: '00000000-ffff-0000-0000-000000000001',
    imagen_url: 'https://test.com/img.jpg',
    producto_id: null,
    es_eterno: true,
    fecha_desde: null,
    fecha_hasta: null,
    activo: true
  };

  console.log('\nIntentando upsert...');
  const { error: upsertError, data: upsertData } = await supabase
    .from('sucursal_flyers')
    .upsert(testData, { onConflict: 'sucursal_id' })
    .select();

  if (upsertError) {
    console.error('\n❌ Error en upsert:', JSON.stringify(upsertError, null, 2));
  } else {
    console.log('\n✅ Upsert exitoso!');
    // Limpiar registro de test
    await supabase.from('sucursal_flyers').delete().eq('sucursal_id', '00000000-ffff-0000-0000-000000000001');
    console.log('Registro de test eliminado.');
  }
}

diagnose().catch(console.error);
