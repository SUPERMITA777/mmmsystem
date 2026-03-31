const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if(parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log("Emptying analytics_visitas table via REST API...");
    // Deleting all rows where cantidad >= 0 (which is all of them)
    const { data: d1, error: err1 } = await supabase.from('analytics_visitas').delete().gte('cantidad', 0);
    if(err1) console.log("Del error:", err1.message);

    console.log("Resetting sucursales total & hourly visit counters to 0 via REST API...");
    // Updating all rows where visitas_total >= 0 (all valid ones)
    const { data: d2, error: err2 } = await supabase.from('sucursales').update({ visitas_total: 0, visitas_hoy: 0 }).gte('visitas_total', 0);
    if(err2) console.log("Update error:", err2.message);

    console.log("All fake visit data wiped successfully!");
}

run();
