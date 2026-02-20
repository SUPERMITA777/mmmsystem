"use client";

import { useState } from "react";
import { X, ShoppingBag, MapPin, Banknote, CreditCard, Tag, Receipt, Pencil, Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabaseClient";

export default function CartModal({ onClose }: { onClose: () => void }) {
    const { items, updateQty, removeItem, total, clearCart } = useCart();
    const [tipoEntrega, setTipoEntrega] = useState<"delivery" | "retirar">("delivery");
    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [email, setEmail] = useState("");
    const [direccion, setDireccion] = useState("");
    const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia">("efectivo");
    const [conCuanto, setConCuanto] = useState("");
    const [propina, setPropina] = useState(0);
    const [propinaCustom, setPropinaCustom] = useState("");
    const [codigoPromo, setCodigoPromo] = useState("");
    const [sending, setSending] = useState(false);

    const ALIAS_TRANSFERENCIA = "MMM.PIZZA";
    const COSTO_ENVIO = tipoEntrega === "delivery" ? 0 : 0; // puede configurarse
    const totalConPropina = total + propina + COSTO_ENVIO;

    const propinaOpciones = [0, 100, 200, 500];

    async function handleRealizarPedido() {
        if (!nombre.trim()) { alert("Por favor ingresá tu nombre."); return; }
        if (!telefono.trim()) { alert("Por favor ingresá tu teléfono."); return; }
        if (tipoEntrega === "delivery" && !direccion.trim()) { alert("Por favor ingresá tu dirección de entrega."); return; }
        if (items.length === 0) { alert("Tu carrito está vacío."); return; }

        setSending(true);
        try {
            // 1. Obtener Sucursal ID
            const { data: sucursal } = await supabase.from("sucursales").select("id").limit(1).single();
            if (!sucursal) throw new Error("No se encontró sucursal activa.");

            // 2. Obtener Método de Pago ID
            const { data: mPago } = await supabase
                .from("metodos_pago")
                .select("id, nombre")
                .eq("codigo", metodoPago)
                .eq("sucursal_id", sucursal.id)
                .single();

            // 3. Crear el Pedido en la base de datos
            const { data: pedido, error: pedidoError } = await supabase
                .from("pedidos")
                .insert([{
                    sucursal_id: sucursal.id,
                    cliente_nombre: nombre,
                    cliente_telefono: telefono,
                    cliente_direccion: tipoEntrega === "delivery" ? direccion : null,
                    tipo: tipoEntrega,
                    estado: 'pendiente',
                    origen: 'web',
                    subtotal: total,
                    costo_envio: COSTO_ENVIO,
                    propina: propina,
                    total: totalConPropina,
                    metodo_pago_id: mPago?.id,
                    metodo_pago_nombre: mPago?.nombre || (metodoPago === 'efectivo' ? 'Efectivo' : 'Transferencia'),
                    notas: conCuanto ? `Abona con: $${conCuanto}` : ""
                }])
                .select()
                .single();

            if (pedidoError) throw pedidoError;

            // 4. Crear los ítems del pedido
            const itemsToInsert = items.map(i => ({
                pedido_id: pedido.id,
                producto_id: i.productoId,
                nombre_producto: i.nombre,
                cantidad: i.cantidad,
                precio_unitario: i.precio,
                adicionales: i.adicionales // JSONB
            }));

            const { error: itemsError } = await supabase.from("pedido_items").insert(itemsToInsert);
            if (itemsError) throw itemsError;

            // 5. Armamos el mensaje de WhatsApp
            const itemsTexto = items.map(i => {
                const ads = i.adicionales?.map(a => `  + ${a.nombre} (+$${a.precio})`).join("\n") || "";
                return `• ${i.cantidad}x ${i.nombre} - $${new Intl.NumberFormat("es-AR").format(i.precio * i.cantidad)}${ads ? `\n${ads}` : ""}`;
            }).join("\n");

            const msg = `🍕 *NUEVO PEDIDO*\n\n` +
                `*ID:* ${pedido.numero_pedido || pedido.id.slice(0, 8)}\n` +
                `*Tipo:* ${tipoEntrega === "delivery" ? "Delivery" : "Retirar en local"}\n` +
                `*Cliente:* ${nombre}\n` +
                `*Teléfono:* +54 ${telefono}\n` +
                (email ? `*Email:* ${email}\n` : "") +
                (tipoEntrega === "delivery" ? `*Dirección:* ${direccion}\n` : "") +
                `\n*Productos:*\n${itemsTexto}\n\n` +
                `*Subtotal:* $${new Intl.NumberFormat("es-AR").format(total)}\n` +
                (propina > 0 ? `*Propina:* $${new Intl.NumberFormat("es-AR").format(propina)}\n` : "") +
                `*Total:* $${new Intl.NumberFormat("es-AR").format(totalConPropina)}\n` +
                `*Pago:* ${metodoPago === "efectivo" ? `Efectivo${conCuanto ? ` (con $${conCuanto})` : ""}` : "Transferencia"}`;

            const waUrl = `https://wa.me/549XXXXXXXXXX?text=${encodeURIComponent(msg)}`;

            alert("¡Pedido recibido y guardado! Redirigiendo a WhatsApp...");
            window.open(waUrl, '_blank');

            clearCart();
            onClose();
        } catch (error: any) {
            console.error("Error al realizar el pedido:", error);
            alert("Hubo un error al procesar tu pedido. Por favor intentá de nuevo.");
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal panel - centered */}
            <div
                className="relative z-10 w-full max-w-lg mx-auto my-auto bg-[#111] rounded-2xl overflow-hidden flex flex-col shadow-2xl max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">
                        {tipoEntrega === "delivery" ? "Pedido de Delivery" : "Pedido para Retirar"}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-5 py-4 space-y-4">

                        {/* Toggle Delivery / Retirar */}
                        <div className="flex rounded-xl overflow-hidden border border-white/10">
                            <button
                                onClick={() => setTipoEntrega("delivery")}
                                className={`flex-1 py-3 text-sm font-black uppercase tracking-widest transition-colors ${tipoEntrega === "delivery" ? "bg-orange-600 text-white" : "text-slate-400 hover:text-white"}`}
                            >
                                Delivery
                            </button>
                            <button
                                onClick={() => setTipoEntrega("retirar")}
                                className={`flex-1 py-3 text-sm font-black uppercase tracking-widest transition-colors ${tipoEntrega === "retirar" ? "bg-orange-600 text-white" : "text-slate-400 hover:text-white"}`}
                            >
                                Retirar
                            </button>
                        </div>

                        {/* Items */}
                        <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold border-b border-white/5 pb-2">
                                <ShoppingBag size={14} />
                                <span>{items.length} {items.length === 1 ? "Producto" : "Productos"}</span>
                            </div>

                            {/* Column headers */}
                            <div className="flex text-xs text-slate-500 uppercase tracking-wide font-semibold">
                                <span className="flex-1">Item</span>
                                <span className="w-20 text-center">Cant.</span>
                                <span className="w-24 text-right">Precio</span>
                            </div>

                            {items.map(item => (
                                <div key={item.id} className="flex items-center gap-2">
                                    {/* Thumbnail */}
                                    {item.imagen_url && (
                                        <img src={item.imagen_url} alt={item.nombre} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <span className="block text-sm text-white font-medium truncate">{item.nombre}</span>
                                        {item.adicionales && item.adicionales.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                {item.adicionales.map((a, idx) => (
                                                    <span key={idx} className="text-[9px] text-slate-400 leading-none bg-white/5 px-1 py-0.5 rounded border border-white/5">
                                                        + {a.nombre}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Qty controls */}
                                    <div className="flex items-center gap-1 bg-white/5 rounded-lg px-1">
                                        <button onClick={() => updateQty(item.id, item.cantidad - 1)} className="text-slate-400 hover:text-white p-1">
                                            <Minus size={12} />
                                        </button>
                                        <span className="text-white text-xs font-bold w-5 text-center">{item.cantidad}</span>
                                        <button onClick={() => updateQty(item.id, item.cantidad + 1)} className="text-slate-400 hover:text-white p-1">
                                            <Plus size={12} />
                                        </button>
                                    </div>

                                    <span className="w-24 text-right text-white text-sm font-bold">
                                        $ {new Intl.NumberFormat("es-AR").format(item.precio * item.cantidad)}
                                    </span>

                                    <button onClick={() => removeItem(item.id)} className="text-slate-600 hover:text-red-400 transition-colors ml-1">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}

                            <div className="flex justify-between border-t border-white/5 pt-2">
                                <span className="text-sm text-slate-400 font-semibold uppercase tracking-wide">Subtotal</span>
                                <span className="text-white font-black">$ {new Intl.NumberFormat("es-AR").format(total)}</span>
                            </div>
                        </div>

                        {/* Cliente */}
                        <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">
                                <span>👤</span><span>Cliente</span>
                            </div>
                            <input
                                type="text"
                                placeholder="Nombre*"
                                value={nombre}
                                onChange={e => setNombre(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 outline-none focus:border-orange-500/50 transition-colors"
                            />
                            <div className="flex gap-2">
                                <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-slate-400 text-sm gap-1 shrink-0">
                                    <span>🇦🇷</span>
                                    <span>+54</span>
                                    <span className="text-slate-600 ml-1">▾</span>
                                </div>
                                <input
                                    type="tel"
                                    placeholder="Teléfono*"
                                    value={telefono}
                                    onChange={e => setTelefono(e.target.value)}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 outline-none focus:border-orange-500/50 transition-colors"
                                />
                            </div>
                            <input
                                type="email"
                                placeholder="Email (Opcional)"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 outline-none focus:border-orange-500/50 transition-colors"
                            />
                        </div>

                        {/* Dirección de entrega (solo Delivery) */}
                        {tipoEntrega === "delivery" && (
                            <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">
                                    <MapPin size={14} /><span>Dirección de entrega</span>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Dirección*"
                                    value={direccion}
                                    onChange={e => setDireccion(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 outline-none focus:border-orange-500/50 transition-colors"
                                />
                            </div>
                        )}

                        {/* Método de pago */}
                        <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">
                                <Banknote size={14} /><span>Método de pago</span>
                            </div>
                            <button
                                onClick={() => setMetodoPago("efectivo")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-sm font-bold uppercase tracking-wide ${metodoPago === "efectivo" ? "border-orange-500 bg-orange-600/20 text-orange-400" : "border-white/10 text-slate-400 hover:border-white/20"}`}
                            >
                                <Banknote size={16} /> Efectivo
                            </button>
                            {metodoPago === "efectivo" && (
                                <input
                                    type="number"
                                    placeholder="¿Con cuánto abonás?"
                                    value={conCuanto}
                                    onChange={e => setConCuanto(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 outline-none focus:border-orange-500/50 transition-colors"
                                />
                            )}
                            <button
                                onClick={() => setMetodoPago("transferencia")}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-sm ${metodoPago === "transferencia" ? "border-orange-500 bg-orange-600/20" : "border-white/10 hover:border-white/20"}`}
                            >
                                <div className="flex items-center gap-3">
                                    <CreditCard size={16} className={metodoPago === "transferencia" ? "text-orange-400" : "text-slate-400"} />
                                    <span className={`font-bold uppercase tracking-wide ${metodoPago === "transferencia" ? "text-orange-400" : "text-slate-400"}`}>
                                        Transferencia
                                    </span>
                                </div>
                                {metodoPago === "transferencia" && (
                                    <span className="text-xs text-slate-400">Alias: {ALIAS_TRANSFERENCIA}</span>
                                )}
                            </button>
                        </div>

                        {/* Propina */}
                        <div className="bg-[#1a1a1a] rounded-xl p-4">
                            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-3">
                                <span>💛</span><span>Propina</span>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {propinaOpciones.map(p => (
                                    <button
                                        key={p}
                                        onClick={() => { setPropina(p); setPropinaCustom(""); }}
                                        className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${propina === p && !propinaCustom ? "bg-orange-600 border-orange-600 text-white" : "border-white/20 text-slate-400 hover:border-white/40"}`}
                                    >
                                        {p === 0 ? "$0" : `$${p}`}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setPropina(-1)}
                                    className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${propina === -1 ? "bg-orange-600 border-orange-600 text-white" : "border-white/20 text-slate-400 hover:border-white/40"}`}
                                >
                                    Otro
                                </button>
                            </div>
                            {propina === -1 && (
                                <input
                                    type="number"
                                    placeholder="Ingresá el monto"
                                    value={propinaCustom}
                                    onChange={e => setPropinaCustom(e.target.value)}
                                    className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 outline-none focus:border-orange-500/50"
                                />
                            )}
                        </div>

                        {/* Código promocional */}
                        <div className="bg-[#1a1a1a] rounded-xl p-4">
                            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-3">
                                <Tag size={14} /><span>Código promocional</span>
                            </div>
                            <input
                                type="text"
                                placeholder="Ingresá el código"
                                value={codigoPromo}
                                onChange={e => setCodigoPromo(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 outline-none focus:border-orange-500/50 transition-colors"
                            />
                        </div>

                        {/* Resumen */}
                        <div className="bg-[#1a1a1a] rounded-xl p-4">
                            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-3">
                                <Receipt size={14} /><span>Resumen</span>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-slate-300">
                                    <span>Productos</span>
                                    <span>$ {new Intl.NumberFormat("es-AR").format(total)}</span>
                                </div>
                                {tipoEntrega === "delivery" && COSTO_ENVIO > 0 && (
                                    <div className="flex justify-between text-slate-300">
                                        <span>Envío</span>
                                        <span>$ {new Intl.NumberFormat("es-AR").format(COSTO_ENVIO)}</span>
                                    </div>
                                )}
                                {propina > 0 && (
                                    <div className="flex justify-between text-slate-300">
                                        <span>Propina</span>
                                        <span>$ {new Intl.NumberFormat("es-AR").format(propina)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-white font-black text-base border-t border-white/10 pt-2">
                                    <span>Total</span>
                                    <span>$ {new Intl.NumberFormat("es-AR").format(totalConPropina)}</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Sticky footer */}
                <div className="px-5 py-4 border-t border-white/10 bg-[#111]">
                    <button
                        onClick={handleRealizarPedido}
                        disabled={sending || items.length === 0}
                        className="w-full bg-orange-600 hover:bg-orange-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl text-sm uppercase tracking-widest transition-all"
                    >
                        {sending ? "Enviando..." : "Realizar pedido"}
                    </button>
                </div>
            </div>
        </div>
    );
}
