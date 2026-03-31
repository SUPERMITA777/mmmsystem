import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

// Hardcoded keys for local test 
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    console.log("Fetching analytics_visitas...");
    const { data, error } = await supabaseAdmin.from("analytics_visitas").select("*");
    console.log("Data length:", data?.length);
    console.log("Data:", data);
    console.log("Error:", error);
}
test();
