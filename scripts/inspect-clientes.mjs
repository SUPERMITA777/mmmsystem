import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, '..', 'clientes_mmm_system.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log('--- ESTRUCTURA DEL EXCEL DE CLIENTES ---');
    console.log('Columnas encontradas:', data[0]);
    console.log('Ejemplo de fila 1:', data[1]);
    console.log('Ejemplo de fila 2:', data[2]);
    console.log('Total de filas:', data.length - 1);
    console.log('---------------------------');
} catch (error) {
    console.error('Error al leer el Excel de clientes:', error.message);
}
