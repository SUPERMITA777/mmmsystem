"use client";

import { createContext, useContext, useState, ReactNode } from "react";

/**
 * @typedef {Object} CartItem
 * @property {string} id - Identificador único de este item en el carrito (autogenerado).
 * @property {string} productoId - ID del producto (referencia a base de datos).
 * @property {string} nombre - Nombre del producto.
 * @property {number} precio - Precio unitario del producto base.
 * @property {number} cantidad - Cantidad agregada.
 * @property {string} [imagen_url] - URL de la imagen del producto.
 * @property {Array} [adicionales] - Adicionales seleccionados (nombre, precio, grupo, impresora).
 * @property {string} [opciones] - Descripción textual de opciones.
 * @property {string} [notas] - Notas o aclaraciones adicionales del cliente.
 * @property {string} [categoriaNombre] - Nombre de la categoría a la que pertenece.
 * @property {boolean} [isComandado] - Indica si el item ya fue impreso/comandado.
 * @property {Object} [descuentoInfo] - Información de descuentos aplicados (id, porcentaje, no_acumulable).
 */

export type CartItem = {
    id: string;
    productoId: string;
    nombre: string;
    precio: number;
    cantidad: number;
    imagen_url?: string;
    adicionales?: { nombre: string; precio: number; grupo: string; impresora?: string }[];
    opciones?: string; // texto de opciones seleccionadas
    notas?: string;
    categoriaNombre?: string;
    isComandado?: boolean;
    descuentoInfo?: {
        id: string;
        porcentaje: number;
        no_acumulable: boolean;
        nombre?: string;
    } | null;
};

type CartContextType = {
    items: CartItem[];
    addItem: (item: Omit<CartItem, "id">) => void;
    removeItem: (id: string) => void;
    updateQty: (id: string, cantidad: number) => void;
    clearCart: () => void;
    total: number;
    totalItems: number;
};

const CartContext = createContext<CartContextType | null>(null);

/**
 * Proveedor del carrito de compras.
 * Gestiona la adición, remoción, actualización de cantidades y cómputo de totales.
 * Mantiene la persistencia en memoria durante el flujo de pedido.
 * 
 * @provider CartProvider
 * @param {Object} props - Propiedades del componente.
 * @param {React.ReactNode} props.children - Nodos hijos a renderizar.
 */
export function CartProvider({ children }: { children: ReactNode }) {

    const [items, setItems] = useState<CartItem[]>([]);

    const addItem = (item: Omit<CartItem, "id">) => {
        setItems((prevItems) => {
            // Find if item with same ID AND same adicionales AND same notas already exists
            const existingItemIndex = prevItems.findIndex(
                (i) => i.productoId === item.productoId &&
                    JSON.stringify(i.adicionales) === JSON.stringify(item.adicionales) &&
                    i.notas === item.notas
            );

            if (existingItemIndex > -1) {
                const newItems = [...prevItems];
                newItems[existingItemIndex].cantidad += item.cantidad;
                return newItems;
            }
            return [...prevItems, { ...item, id: Math.random().toString(36).substr(2, 9) }];
        });
    };

    function removeItem(id: string) {
        setItems(prev => prev.filter(i => i.id !== id));
    }

    function updateQty(id: string, cantidad: number) {
        if (cantidad <= 0) {
            removeItem(id);
            return;
        }
        setItems(prev => prev.map(i => i.id === id ? { ...i, cantidad } : i));
    }

    function clearCart() {
        setItems([]);
    }

    const total = items.reduce((acc, item) => {
        const additionalPrice = item.adicionales?.reduce((sum, a) => sum + a.precio, 0) || 0;
        return acc + (item.precio + additionalPrice) * item.cantidad;
    }, 0);
    const totalItems = items.reduce((sum, i) => sum + i.cantidad, 0);

    return (
        <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, total, totalItems }}>
            {children}
        </CartContext.Provider>
    );
}

/**
 * Hook para consumir el estado del carrito de compras.
 * Debe utilizarse dentro de un CartProvider.
 * 
 * @returns {CartContextType} La interfaz interactiva del carrito de compras.
 * @throws {Error} Si se utiliza fuera de un CartProvider.
 */
export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error("useCart must be used inside CartProvider");
    return ctx;
}

