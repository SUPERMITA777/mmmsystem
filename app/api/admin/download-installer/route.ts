import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tenantSlug = searchParams.get('tenant') || 'mmm';
        
        // Resolve host and protocol dynamically from headers
        const host = req.headers.get('host') || 'mmmsystem.vercel.app';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        
        const systemUrl = `${protocol}://${host}/${tenantSlug}/admin/panel-pedidos`;
        
        const filePath = path.join(process.cwd(), 'public', 'INSTALAR_HUB_Y_SISTEMA.bat');
        
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'Archivo instalador base no encontrado' }, { status: 404 });
        }
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Configuración dinámica a inyectar al principio
        const configString = `
:: --- CONFIGURACION DINAMICA INYECTADA ---
set "TENANT_SLUG=${tenantSlug}"
set "SYSTEM_URL=${systemUrl}"
:: ---------------------------------------
`;
        
        // Inyectar justo después de @echo off si está presente, sino al principio
        const echoOffToken = '@echo off';
        if (content.toLowerCase().startsWith(echoOffToken)) {
            content = echoOffToken + configString + content.substring(echoOffToken.length);
        } else {
            content = configString + content;
        }
        
        // Retornar el archivo .bat como descarga
        const response = new NextResponse(content, {
            headers: {
                'Content-Type': 'application/x-bat',
                'Content-Disposition': `attachment; filename="INSTALAR_HUB_Y_SISTEMA_${tenantSlug}.bat"`,
            },
        });
        
        return response;
    } catch (err: any) {
        console.error('Error serving dynamic installer:', err);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
