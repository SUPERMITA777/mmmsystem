const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) {
        env[key.trim()] = rest.join('=').trim().replace(/['"]/g, '');
    }
});

async function testSupabase() {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);
    const { data, error } = await supabase.auth.admin.listUsers();
    return error ? `❌ Supabase: ${error.message}` : `✅ Supabase: OK (${data.users.length} users)`;
}

async function testGroq() {
    const key = env['GROQ_API_KEY'];
    if (!key) return "❓ Groq: Key not found in .env";
    try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        return res.ok ? "✅ Groq: OK" : `❌ Groq: ${res.status} ${res.statusText}`;
    } catch (e) { return `❌ Groq: ${e.message}`; }
}

async function testGemini() {
    const key = env['GEMINI_API_KEY'];
    if (!key) return "❓ Gemini: Key not found in .env";
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        return res.ok ? "✅ Gemini: OK" : `❌ Gemini: ${res.status} ${res.statusText}`;
    } catch (e) { return `❌ Gemini: ${e.message}`; }
}

async function run() {
    console.log("Iniciando validación de llaves...");
    const results = await Promise.all([
        testSupabase(),
        testGroq(),
        testGemini()
    ]);
    results.forEach(r => console.log(r));
}

run();
