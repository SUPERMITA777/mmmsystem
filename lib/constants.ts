/**
 * Centralized business constants for the POS and delivery system.
 */

// Estados de pedidos
export const ESTADOS_PEDIDO = {
  PENDIENTE: 'pendiente',
  CONFIRMADO: 'confirmado',
  PREPARANDO: 'preparando',
  LISTO: 'listo',
  EN_CAMINO: 'en_camino',
  ENTREGADO: 'entregado',
  CANCELADO: 'cancelado'
} as const;

export type EstadoPedido = typeof ESTADOS_PEDIDO[keyof typeof ESTADOS_PEDIDO];

export const ESTADOS_PEDIDO_LABELS: Record<EstadoPedido, string> = {
  [ESTADOS_PEDIDO.PENDIENTE]: 'Pendiente',
  [ESTADOS_PEDIDO.CONFIRMADO]: 'Confirmado',
  [ESTADOS_PEDIDO.PREPARANDO]: 'En Cocina',
  [ESTADOS_PEDIDO.LISTO]: 'Listo para retirar/enviar',
  [ESTADOS_PEDIDO.EN_CAMINO]: 'En camino',
  [ESTADOS_PEDIDO.ENTREGADO]: 'Entregado',
  [ESTADOS_PEDIDO.CANCELADO]: 'Cancelado'
};

// Roles de usuario
export const ROLES_USUARIO = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  CAMARERO: 'camarero',
  REPARTIDOR: 'repartidor',
  EMPLEADO: 'empleado'
} as const;

export type RolUsuario = typeof ROLES_USUARIO[keyof typeof ROLES_USUARIO];

export const ROLES_USUARIO_LABELS: Record<RolUsuario, string> = {
  [ROLES_USUARIO.SUPER_ADMIN]: 'Super Administrador',
  [ROLES_USUARIO.ADMIN]: 'Administrador',
  [ROLES_USUARIO.CAMARERO]: 'Camarero',
  [ROLES_USUARIO.REPARTIDOR]: 'Repartidor',
  [ROLES_USUARIO.EMPLEADO]: 'Empleado'
};

// Modalidades de servicio / Tipos de pedidos
export const MODALIDADES_SERVICIO = {
  DELIVERY: 'delivery',
  TAKEAWAY: 'takeaway',
  SALON: 'salon'
} as const;

export type ModalidadServicio = typeof MODALIDADES_SERVICIO[keyof typeof MODALIDADES_SERVICIO];

export const MODALIDADES_SERVICIO_LABELS: Record<ModalidadServicio, string> = {
  [MODALIDADES_SERVICIO.DELIVERY]: 'Delivery',
  [MODALIDADES_SERVICIO.TAKEAWAY]: 'Take Away',
  [MODALIDADES_SERVICIO.SALON]: 'Salón'
};
