import { NextResponse } from 'next/server';

/**
 * Clase base para todos los errores de dominio de la aplicación.
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public status: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error lanzado ante fallas de autenticación o autorización.
 */
export class AuthError extends AppError {
  constructor(message: string = 'No autorizado o token inválido', status: number = 401, code?: string) {
    super(message, status, code);
  }
}

/**
 * Error relacionado con operaciones sobre pedidos.
 */
export class PedidoError extends AppError {
  constructor(message: string, status: number = 400, code?: string) {
    super(message, status, code);
  }
}

/**
 * Error relacionado con el control de inventario o stock de ingredientes.
 */
export class StockError extends AppError {
  constructor(message: string, status: number = 400, code?: string) {
    super(message, status, code);
  }
}

/**
 * Error que representa una falla interna o de comunicación con la base de datos Supabase.
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Error en el servidor de base de datos', status: number = 500, code?: string) {
    super(message, status, code);
  }
}

/**
 * Error por fallas en la validación de esquemas de datos entrantes.
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Parámetros o datos de entrada inválidos', status: number = 400, code?: string) {
    super(message, status, code);
  }
}

/**
 * Normaliza y mapea errores producidos por clientes de Supabase (PostgrestError)
 * hacia las clases de error de dominio de la aplicación.
 */
export function handleSupabaseError(error: any): AppError {
  if (!error) return new DatabaseError('Error desconocido de Supabase');

  console.error('[Supabase DB Error Logged]:', error);

  const message = error.message || error.details || 'Fallo al procesar consulta en la base de datos';
  const code = error.code;

  // Mapear códigos de error comunes de Postgres
  switch (code) {
    case '23505': // unique_violation
      return new AppError('El registro ya existe en el sistema (restricción de clave única)', 409, code);
    case '23503': // foreign_key_violation
      return new AppError('Error de integridad: la referencia provista no existe en el sistema', 400, code);
    case '42501': // insufficient_privilege (RLS violación)
      return new AuthError('Permisos insuficientes para realizar esta operación (RLS)', 403, code);
    default:
      return new DatabaseError(message, 500, code);
  }
}

/**
 * Atrapa cualquier excepción ocurrida en una API Route y genera la respuesta JSON estandarizada.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  console.error('[Unhandled API Exception]:', error);
  const internalMessage = error instanceof Error ? error.message : 'Error interno del servidor';

  return NextResponse.json(
    { 
      error: 'Ha ocurrido un error inesperado en el servidor', 
      details: process.env.NODE_ENV === 'development' ? internalMessage : undefined 
    },
    { status: 500 }
  );
}
