import { createClient } from "@supabase/supabase-js";

// Hardcoded keys for local test (removed from output)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    const { data: roleData, error: roleError } = await supabaseAdmin.from("user_roles").upsert({
        user_id: "00000000-0000-0000-0000-000000000000",
        role: "user"
    }, { onConflict: "user_id" });

    console.log("Upsert Error:", roleError);
}
test();
