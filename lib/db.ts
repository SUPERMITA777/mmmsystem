import Dexie, { type EntityTable } from "dexie";

/**
 * ═══════════════════════════════════════════════════════════
 *  LOCAL-FIRST DATABASE — Dexie.js (IndexedDB)
 * ═══════════════════════════════════════════════════════════
 *
 *  Esta base de datos local garantiza que los pedidos se
 *  persistan en la terminal del usuario incluso sin conexión.
 *  Cuando se detecta conexión, los registros pendientes
 *  se sincronizan automáticamente con Supabase.
 */

// ─── Tipos ───────────────────────────────────────────────

export interface PedidoLocal {
  /** UUID v4 generado con crypto.randomUUID() */
  id: string;
  /** Número de mesa (puede ser null para delivery/takeaway) */
  mesa: string | null;
  /** Items del pedido serializados como JSON */
  items: any[];
  /** Total calculado del pedido */
  total: number;
  /** Estado del pedido: pendiente, preparando, listo, entregado, cancelado */
  estado: string;
  /** Fecha de creación ISO string */
  created_at: string;
  /** ¿Ya se sincronizó con Supabase? */
  sincronizado: boolean;
  /** ID de la sucursal (tenant) */
  sucursal_id: string;
  /** Payload completo del pedido para Supabase */
  payload_pedido: Record<string, any>;
  /** Payload de los items para Supabase */
  payload_items: Record<string, any>[];
  /** Timestamp del último intento de sincronización */
  ultimo_intento_sync?: string;
  /** Número de intentos de sincronización fallidos */
  intentos_sync: number;
  /** Error del último intento (para debugging) */
  ultimo_error_sync?: string;
}

// ─── Database ────────────────────────────────────────────

class MMMDatabase extends Dexie {
  pedidos!: EntityTable<PedidoLocal, "id">;
  productos!: EntityTable<any, "id">;
  categorias!: EntityTable<any, "id">;
  metodos_pago!: EntityTable<any, "id">;
  adicionales!: EntityTable<any, "id">;
  grupos_adicionales!: EntityTable<any, "id">;
  producto_grupos_adicionales!: EntityTable<any, "id">;
  descuentos!: EntityTable<any, "id">;
  mesas!: EntityTable<any, "id">;
  config_sucursal!: EntityTable<any, "sucursal_id">;
  fichas_tecnicas!: EntityTable<any, "id">;
  ficha_tecnica_items!: EntityTable<any, "id">;
  ingredientes!: EntityTable<any, "id">;

  constructor() {
    super("MMMSystemDB");

    this.version(3).stores({
      pedidos: "id, sincronizado, sucursal_id, created_at, estado",
      productos: "id, sucursal_id, categoria_id, nombre",
      categorias: "id, sucursal_id, orden",
      metodos_pago: "id, sucursal_id",
      adicionales: "id, sucursal_id, grupo_id",
      grupos_adicionales: "id, sucursal_id",
      producto_grupos_adicionales: "id, sucursal_id, producto_id, grupo_id",
      descuentos: "id, sucursal_id",
      mesas: "id, sucursal_id",
      config_sucursal: "sucursal_id",
      fichas_tecnicas: "id, sucursal_id, nombre",
      ficha_tecnica_items: "id, sucursal_id, ficha_tecnica_id, ingrediente_id",
      ingredientes: "id, sucursal_id, nombre"
    });
  }
}

export const db = new MMMDatabase();

// ─── Helpers ─────────────────────────────────────────────

/**
 * Genera un UUID v4 seguro para evitar colisiones.
 * Usa crypto.randomUUID() cuando está disponible (HTTPS),
 * con fallback a generación manual.
 */
export function generateLocalId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para contextos sin crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Guarda un pedido en la base de datos local.
 * Retorna el ID local generado.
 */
export async function guardarPedidoLocal(
  pedido: Omit<PedidoLocal, "id" | "sincronizado" | "intentos_sync" | "created_at">
): Promise<string> {
  const id = generateLocalId();
  const record: PedidoLocal = {
    ...pedido,
    id,
    sincronizado: false,
    intentos_sync: 0,
    created_at: new Date().toISOString(),
  };
  await db.pedidos.add(record);
  return id;
}

/**
 * Obtiene todos los pedidos pendientes de sincronización.
 */
export async function getPedidosPendientes(sucursalId?: string): Promise<PedidoLocal[]> {
  let query = db.pedidos.where("sincronizado").equals(0); // Dexie stores booleans as 0/1
  if (sucursalId) {
    return db.pedidos
      .where("[sincronizado+sucursal_id]")
      .equals([0, sucursalId])
      .toArray()
      .catch(() =>
        // Fallback si no existe el índice compuesto
        db.pedidos
          .where("sincronizado")
          .equals(0)
          .filter((p) => p.sucursal_id === sucursalId)
          .toArray()
      );
  }
  return query.toArray();
}

/**
 * Marca un pedido como sincronizado.
 */
export async function marcarSincronizado(id: string): Promise<void> {
  await db.pedidos.update(id, { sincronizado: true });
}

/**
 * Registra un fallo de sincronización.
 */
export async function registrarFalloSync(id: string, error: string): Promise<void> {
  const pedido = await db.pedidos.get(id);
  if (pedido) {
    await db.pedidos.update(id, {
      intentos_sync: (pedido.intentos_sync || 0) + 1,
      ultimo_intento_sync: new Date().toISOString(),
      ultimo_error_sync: error,
    });
  }
}

/**
 * Cuenta pedidos pendientes de sincronización.
 */
export async function contarPendientes(sucursalId?: string): Promise<number> {
  if (sucursalId) {
    return db.pedidos
      .where("sincronizado")
      .equals(0)
      .filter((p) => p.sucursal_id === sucursalId)
      .count();
  }
  return db.pedidos.where("sincronizado").equals(0).count();
}
