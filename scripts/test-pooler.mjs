import pg from "pg";

const regions = [
    "sa-east-1",
    "us-east-1",
    "us-west-1",
    "eu-central-1",
    "eu-west-1",
    "eu-west-2",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-northeast-1",
    "ca-central-1",
    "ap-south-1"
];

const password = "SoleyEma2711";
const projectRef = "xnupjsxbvyirpeagbloe";

async function test() {
    for (let r of regions) {
        process.stdout.write(`Testing region ${r}... `);

        // Try the new Supavisor username format `postgres.[ref]`
        const urlOptions = [
            `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-${r}.pooler.supabase.com:6543/postgres`,
            `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-${r}.pooler.supabase.com:5432/postgres`,
            `postgresql://postgres:${encodeURIComponent(password)}@aws-0-${r}.pooler.supabase.com:6543/postgres`
        ];

        for (let url of urlOptions) {
            const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
            try {
                // Short timeout
                await Promise.race([
                    client.connect(),
                    new Promise((_, r) => setTimeout(() => r(new Error("Timeout")), 3000))
                ]);
                await client.query("SELECT 1");
                console.log(`\n✅ SUCCESS! Connection URL: ${url}`);
                await client.query(`
                    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_lat DOUBLE PRECISION DEFAULT NULL;
                    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_lng DOUBLE PRECISION DEFAULT NULL;
                    NOTIFY pgrst, 'reload schema';
                `);
                console.log("Migration executed successfully over pooler.");
                await client.end();
                process.exit(0);
            } catch (e) {
                // Ignore errors and try the next one
            } finally {
                await client.end().catch(() => { });
            }
        }
        console.log("Failed.");
    }
    console.log("\n❌ All pooler regions and variations failed.");
}

test();
