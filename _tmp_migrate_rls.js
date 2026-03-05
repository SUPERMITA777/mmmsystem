const { Client } = require('pg');

const dbUrl = 'postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres';

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to DB!");

        // We update policies for each table that should be isolated per-tenant.
        // The policy ensures a user can only read/write data where sucursal_id matches one of the sucursales they have access to in user_roles
        const sql = `
      -- 1. Enable RLS on roles
      ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
      
      -- Let superadmin read everything, normal users read their own roles
      CREATE POLICY "Roles read access" ON user_roles FOR SELECT 
      USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'superadmin'
      ));

      -- Helper Function to get user's sucursales
      CREATE OR REPLACE FUNCTION get_user_sucursales()
      RETURNS SETOF UUID AS $$
        SELECT sucursal_id FROM user_roles WHERE user_id = auth.uid();
      $$ LANGUAGE sql SECURITY DEFINER;

      CREATE OR REPLACE FUNCTION is_superadmin()
      RETURNS BOOLEAN AS $$
        SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'superadmin');
      $$ LANGUAGE sql SECURITY DEFINER;

      -- 2. Update Policies (Example: productos)
      -- First, drop existing policies on productos if we need to replace them
      -- Since we don't know the names of existing policies, a safer bet for now is altering the tables in code
      -- However, we will create fresh policies that combine with existing ones. It's safer to drop all old policies on these tables if we know them, but let's just create new ones and assume we will enforce them.
      -- Right now, Supabase allows public anon reads on most tables. For true multitenancy, the tables MUST restrict even anon reads to specific sucursal_id via anon key + slug, but typically we filter that in the application logic (e.g. .eq("sucursal_id", id)). For ADMIN reads, we enforce RLS.
    `;

        // As implementing pure RLS across an already-running app with anon access can immediately break the current production site if not careful, we will rely on APPLICATION-LEVEL filtering for now:
        // e.g. supabase.from('productos').select().eq('sucursal_id', tenant.id)
        // This is often easier for SaaS migration phase 1 without breaking existing public endpoints.

        // Let's create a SuperAdmin user for the user
        // Email: superadmin@mmm-system.com

        console.log("Skipping destructive RLS changes. We will use Application-Level filtering with the tenant ID and enforce it in the API/Pages.");

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await client.end();
    }
}

run();
