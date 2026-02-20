"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type CartItem = {
    id: string;
    productoId: string;
    nombre: string;
    precio: number;
    cantidad: number;
    imagen_url?: string;
    adicionales?: { nombre: string; precio: number; grupo: string }[];
    opciones?: string; // texto de opciones seleccionadas
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

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);

    const addItem = (item: Omit<CartItem, "id">) => {
        setItems((prevItems) => {
            // Find if item with same ID AND same adicionales already exists
            const existingItemIndex = prevItems.findIndex(
                (i) => i.productoId === item.productoId &&
                    JSON.stringify(i.adicionales) === JSON.stringify(item.adicionales)
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

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error("useCart must be used inside CartProvider");
    return ctx;
}
