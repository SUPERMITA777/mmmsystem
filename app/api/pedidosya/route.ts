import { NextRequest, NextResponse } from 'next/server';
import { pedidosYaService } from '@/lib/pedidosYa';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const hours = parseInt(searchParams.get('hours') || '24');
        const status = (searchParams.get('status') || 'accepted') as 'accepted' | 'cancelled';

        const orderIds = await pedidosYaService.fetchOrderIds(status, hours);

        return NextResponse.json({
            success: true,
            count: orderIds.length,
            orderIdentifiers: orderIds
        });
    } catch (error: any) {
        console.error('Error in PedidosYa GET route:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * Handle Webhooks from PedidosYa (if configured)
 */
export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();

        // Aquí recibirías la orden de PedidosYa.
        // Los campos 'email' y 'phone' vendrían cifrados.
        // Usar pedidosYaService.decryptData(payload.customer.email) para obtener los datos reales.

        return NextResponse.json({ success: true, message: 'Webhook received' });
    } catch (error: any) {
        console.error('Error in PedidosYa POST route:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
