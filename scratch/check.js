
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://xnupjsxbvyirpeagbloe.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXBqc3hidnlpcnBlYWdibG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDk4NjksImV4cCI6MjA4NjIyNTg2OX0.p5wMjlSnHvDncNKi__ki6RFMQZNxNackaL3NzcNllxA";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    const { data, error } = await supabase.from("pedidos").select("*").limit(1);
    if (data && data[0]) {
        console.log("PEDIDOS COLUMNS:", Object.keys(data[0]));
    } else {
        console.log("No data or error in pedidos", error);
    }

    const { data: prods } = await supabase.from("productos").select("*").limit(1);
    if (prods && prods[0]) {
        console.log("PRODUCTOS COLUMNS:", Object.keys(prods[0]));
        console.log("SAMPLE PRODUCT:", prods[0]);
    }
}
check();
