
const URL = 'https://xnupjsxbvyirpeagbloe.supabase.co/rest/v1/grupos_adicionales?select=*&limit=1';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXBqc3hidnlpcnBlYWdibG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDk4NjksImV4cCI6MjA4NjIyNTg2OX0.p5wMjlSnHvDncNKi__ki6RFMQZNxNackaL3NzcNllxA';

async function debug() {
    try {
        const res = await fetch(URL, {
            headers: {
                'apikey': ANON_KEY,
                'Authorization': `Bearer ${ANON_KEY}`
            }
        });
        const data = await res.json();
        if (data && data[0]) {
            console.log('Columns in grupos_adicionales:', Object.keys(data[0]).join(', '));
            console.log('Sample row:', JSON.stringify(data[0], null, 2));
        } else {
            console.log('No data found in grupos_adicionales');
        }
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

debug();
