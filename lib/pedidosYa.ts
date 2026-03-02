import * as openpgp from 'openpgp';
import { supabaseAdmin } from './supabaseAdmin';

const PY_BASE_URL = process.env.PEDIDOSYA_BASE_URL || 'https://integration-middleware.stg.restaurant-partners.com';
const PY_CHAIN_CODE = process.env.PEDIDOSYA_CHAIN_CODE;
const PY_TOKEN = process.env.PEDIDOSYA_TOKEN;
const PY_PRIVATE_KEY = process.env.PEDIDOSYA_GPG_PRIVATE_KEY;

/**
 * Servicio para interactuar con la API de PedidosYa (Middleware API)
 */
export const pedidosYaService = {
    /**
     * Obtiene una lista de IDs de órdenes procesadas en las últimas X horas.
     */
    async fetchOrderIds(status: 'accepted' | 'cancelled' = 'accepted', hours: number = 24) {
        if (!PY_CHAIN_CODE || !PY_TOKEN) {
            throw new Error('Configuración de PedidosYa incompleta (CHAIN_CODE o TOKEN faltante).');
        }

        const url = `${PY_BASE_URL}/v2/chains/${PY_CHAIN_CODE}/orders/ids?status=${status}&pastNumberOfHours=${hours}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${PY_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Error al obtener IDs de PedidosYa: ${error}`);
        }

        const data = await response.json();
        return data.orderIdentifiers || [];
    },

    /**
     * Descifra datos PII (Personally Identifiable Information) usando la llave privada PGP.
     */
    async decryptData(encryptedData: string): Promise<string> {
        if (!PY_PRIVATE_KEY) {
            throw new Error('Llave privada PGP no configurada en las variables de entorno.');
        }

        try {
            const privateKey = await openpgp.readPrivateKey({ armoredKey: PY_PRIVATE_KEY });
            const message = await openpgp.readMessage({ armoredMessage: encryptedData });

            const { data: decrypted } = await openpgp.decrypt({
                message,
                decryptionKeys: privateKey
            });

            return decrypted as string;
        } catch (error) {
            console.error('Error descifrando datos PGP:', error);
            throw new Error('No se pudo descifrar la información de PedidosYa.');
        }
    },

    /**
     * Procesa un pedido individual obtenido por ID.
     * (Aquí es donde se integraría con el resto del sistema para guardar en Supabase)
     */
    async processOrder(orderId: string) {
        // TODO: Implementar GET /v2/orders/{orderId}
        // Descifrar campos sensibles
        // Insertar en la tabla 'pedidos' de Supabase
    }
};
