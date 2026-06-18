import fs from 'fs';
import path from 'path';
import os from 'os';

const dbPath = path.join(os.homedir(), '.mmm_local_db.json');

try {
    if (fs.existsSync(dbPath)) {
        const data = fs.readFileSync(dbPath, 'utf8');
        const db = JSON.parse(data);
        console.log("=== DB Local (Ultimos 5 pedidos) ===");
        console.log(JSON.stringify(db.orders ? db.orders.slice(-5) : [], null, 2));
    } else {
        console.log("No existe el archivo .mmm_local_db.json");
    }
} catch (e) {
    console.error("Error leyendo DB local:", e);
}
