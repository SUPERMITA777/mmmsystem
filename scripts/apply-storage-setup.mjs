import pg from 'pg';

const { Client } = pg;

const dbUrl = "postgres://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres";

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

const sql = `
-- 1. Create the 'images' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

-- 3. Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

-- 4. Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'images');

-- 5. Allow authenticated users to update
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'images');

-- 6. Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'images');

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
`;

async function run() {
    try {
        await client.connect();
        console.log("✅ Conectado a Supabase.");
        console.log("⏳ Ejecutando setup de Storage (bucket 'images')...");
        await client.query(sql);
        console.log("✅ ¡Bucket 'images' creado y políticas configuradas exitosamente!");
    } catch (error) {
        console.error("❌ Error:", error.message);
    } finally {
        await client.end();
    }
}

run();
