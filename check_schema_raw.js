const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSchema() {
    const tables = ['adicionales', 'producto_grupos_adicionales', 'grupos_adicionales', 'opciones_adicional'];
    for (const table of tables) {
        console.log(`\nChecking table: ${table}`);
        try {
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (error) {
                console.error(`Error checking ${table}:`, error.message);
            } else {
                console.log(`Table ${table} exists. Columns:`, Object.keys(data[0] || {}));
            }
        } catch (e) {
            console.error(`Failed to query ${table}:`, e.message);
        }
    }
}

checkSchema();
