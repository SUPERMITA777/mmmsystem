"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Gift, Copy, CheckCircle2, Clock, XCircle, Truck, Package, Percent } from "lucide-react";

type Premio = {
  nombre: string;
  tipo: "porcentaje" | "fijo" | "envio_gratis" | "producto_gratis";
  valor?: number;
  aplicar_a?: string;
};

type CodigoData = {
  codigo: string;
  premio: Premio;
  usado: boolean;
  fecha_vencimiento: string | null;
};

export default function PromoPage() {
  const params = useParams();
  const tenant = params?.tenant as string;
  const pedidoId = params?.pedidoId as string;

  const [estado, setEstado] = useState<"loading" | "animating" | "revealed" | "inactiva" | "error">("loading");
  const [codigoData, setCodigoData] = useState<CodigoData | null>(null);
  const [copied, setCopied] = useState(false);
  const [storeColors, setStoreColors] = useState({ primario: "#7c3aed", secundario: "#1a1a2e" });
  const [storeName, setStoreName] = useState("MMM System");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    // Fetch store info
    try {
      const { data: suc } = await supabase
        .from("sucursales")
        .select("id, nombre, logo_url")
        .eq("slug", tenant)
        .maybeSingle();

      if (suc) {
        setStoreName(suc.nombre || "MMM System");
        if (suc.logo_url) setLogoUrl(suc.logo_url);
        const { data: cfg } = await supabase
          .from("config_sucursal")
          .select("color_primario, color_secundario")
          .eq("sucursal_id", suc.id)
          .maybeSingle();
        if (cfg) {
          setStoreColors({
            primario: cfg.color_primario || "#7c3aed",
            secundario: cfg.color_secundario || "#1a1a2e",
          });
        }
      }
    } catch { /* ignore */ }

    // Fetch / generate promo code
    try {
      const res = await fetch(`/api/promo/${tenant}/${pedidoId}`);
      const data = await res.json();

      if (!data.success || !data.codigo) {
        setEstado("inactiva");
        return;
      }

      setCodigoData(data.codigo);
      // Trigger animation
      setEstado("animating");
      setTimeout(() => setEstado("revealed"), 2200);
    } catch {
      setEstado("error");
    }
  }

  async function copyCode() {
    if (!codigoData) return;
    await navigator.clipboard.writeText(codigoData.codigo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getPremioIcon(tipo: string) {
    if (tipo === "porcentaje") return <Percent size={32} />;
    if (tipo === "fijo") return <span className="text-3xl font-black">$</span>;
    if (tipo === "envio_gratis") return <Truck size={32} />;
    if (tipo === "producto_gratis") return <Package size={32} />;
    return <Gift size={32} />;
  }

  function getPremioLabel(p: Premio) {
    if (p.tipo === "porcentaje" && p.valor) return `${p.valor}% de descuento`;
    if (p.tipo === "fijo" && p.valor) return `$${p.valor} de descuento`;
    if (p.tipo === "envio_gratis") return "¡Envío gratis!";
    if (p.tipo === "producto_gratis") return "¡Producto gratis!";
    return p.nombre;
  }

  const isVencido = codigoData?.fecha_vencimiento
    ? new Date(codigoData.fecha_vencimiento) < new Date()
    : false;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: `radial-gradient(circle at top, ${storeColors.secundario} 0%, #050505 100%)`,
      }}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-10 animate-pulse"
            style={{
              width: `${40 + i * 15}px`,
              height: `${40 + i * 15}px`,
              background: storeColors.primario,
              left: `${(i * 137.5) % 100}%`,
              top: `${(i * 89.7) % 100}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${2 + i * 0.4}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center px-6 max-w-sm w-full">
        {/* Store name */}
        <p className="text-white/50 text-xs font-bold uppercase tracking-[4px] mb-8">{storeName}</p>

        {/* Loading */}
        {estado === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-20 h-20 rounded-full border-4 animate-spin border-t-transparent"
              style={{ borderColor: storeColors.primario, borderTopColor: "transparent" }}
            />
            <p className="text-white/60 text-sm font-medium">Sorteando tu premio...</p>
          </div>
        )}

        {/* Animating — scratch effect */}
        {estado === "animating" && (
          <div className="flex flex-col items-center gap-6">
            {/* Spinning gift box */}
            <div
              className="w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl animate-bounce overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${storeColors.primario}, ${storeColors.secundario})` }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-full h-full object-contain p-2 animate-spin"
                  style={{ animationDuration: "1s" }}
                />
              ) : (
                <Gift size={52} className="text-white animate-spin" style={{ animationDuration: "1s" }} />
              )}
            </div>
            <div className="text-center">
              <p className="text-white text-xl font-black tracking-tight">¡Girando la ruleta!</p>
              <p className="text-white/50 text-sm mt-1">Tu premio está por aparecer...</p>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full animate-pulse"
                style={{ background: storeColors.primario, width: "70%" }}
              />
            </div>
          </div>
        )}

        {/* Revealed */}
        {estado === "revealed" && codigoData && (
          <div className="w-full animate-[fadeIn_0.5s_ease-in-out]" style={{ animation: "fadeIn 0.5s ease-in-out" }}>
            {/* Confetti burst emoji row */}
            <div className="text-center text-3xl mb-4 animate-bounce">🎉</div>

            {/* Prize card */}
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-6">
              {/* Prize header */}
              <div
                className="p-6 text-center text-white"
                style={{ background: `linear-gradient(135deg, ${storeColors.primario} 0%, ${storeColors.secundario} 100%)` }}
              >
                <div className="flex justify-center mb-3">
                  {getPremioIcon(codigoData.premio.tipo)}
                </div>
                <p className="text-sm font-bold opacity-80 uppercase tracking-wider mb-1">¡Ganaste!</p>
                <h1 className="text-2xl font-black leading-tight">{codigoData.premio.nombre}</h1>
                <p className="text-lg font-bold opacity-90 mt-1">{getPremioLabel(codigoData.premio)}</p>
              </div>

              {/* Code section */}
              <div className="p-6 text-center">
                {codigoData.usado ? (
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <XCircle size={24} className="text-gray-400" />
                    <p className="font-bold">Este código ya fue utilizado</p>
                  </div>
                ) : isVencido ? (
                  <div className="flex flex-col items-center gap-2 text-red-500">
                    <Clock size={24} />
                    <p className="font-bold">Este código está vencido</p>
                    {codigoData.fecha_vencimiento && (
                      <p className="text-xs text-gray-400">Venció el {new Date(codigoData.fecha_vencimiento).toLocaleDateString("es-AR")}</p>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Tu código de canje</p>
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <span
                        className="font-mono text-5xl font-black tracking-[8px] select-all"
                        style={{ color: storeColors.primario }}
                      >
                        {codigoData.codigo}
                      </span>
                    </div>

                    <button
                      onClick={copyCode}
                      className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl font-bold text-sm transition-all text-white shadow-lg active:scale-95"
                      style={{ background: copied ? "#22c55e" : storeColors.primario }}
                    >
                      {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                      {copied ? "¡Copiado!" : "Copiar código"}
                    </button>

                    <a
                      href={`/${tenant}?promo=${codigoData.codigo}&openCart=1`}
                      className="flex items-center justify-center gap-2 mx-auto px-5 py-2.5 rounded-xl font-bold text-sm text-white border-2 transition-all active:scale-95 mt-2"
                      style={{ borderColor: storeColors.primario, color: storeColors.primario }}
                    >
                      🛒 Hacer pedido
                    </a>

                    {codigoData.fecha_vencimiento && (
                      <p className="text-[11px] text-gray-400 mt-3">
                        Válido hasta el {new Date(codigoData.fecha_vencimiento).toLocaleDateString("es-AR")}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Instructions */}
            {!codigoData.usado && !isVencido && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-white/70 text-center">
                <p className="text-sm font-medium">
                  Mostrá este código al local al momento de pagar para aplicar tu descuento. <span className="font-bold text-white">¡Solo tiene un uso!</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Inactive */}
        {estado === "inactiva" && (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
              <Gift size={36} className="text-white/40" />
            </div>
            <p className="text-white text-xl font-black">Promo no disponible</p>
            <p className="text-white/50 text-sm mt-2">Esta promoción no está activa en este momento</p>
          </div>
        )}

        {/* Error */}
        {estado === "error" && (
          <div className="text-center">
            <p className="text-white text-xl font-black">Algo salió mal</p>
            <p className="text-white/50 text-sm mt-2">Intentá escanear el código QR nuevamente</p>
            <button
              onClick={() => { setEstado("loading"); init(); }}
              className="mt-4 px-5 py-2 rounded-xl bg-white/20 text-white font-bold text-sm hover:bg-white/30 transition"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
