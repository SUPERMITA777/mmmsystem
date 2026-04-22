"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getWeightedRandom } from "@/lib/utils/weightedRandom";
import { RuletaWheel } from "./RuletaWheel";
import { 
  Gift, MessageSquare, Phone, User as UserIcon, 
  Loader2, CheckCircle2, AlertCircle, Sparkles
} from "lucide-react";
import confetti from "canvas-confetti";

interface RuletaData {
  id: string;
  nombre: string;
  activa: boolean;
  subtitulo_logo?: string;
  whatsapp_negocio: string;
  whatsapp_emojis: string;
}

interface Segmento {
  id: string;
  nombre: string;
  color: string;
  probabilidad: number;
  imagen_url?: string;
  validez?: string;
}

export function RuletaClientView({ slug, tenant }: { slug: string, tenant: string }) {
  const [ruleta, setRuleta] = useState<RuletaData | null>(null);
  const [segments, setSegments] = useState<Segmento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(true);

  // Spin state
  const [spinning, setSpinning] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [prize, setPrize] = useState<Segmento | null>(null);
  const [showPrizeModal, setShowPrizeModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [slug]);

  async function fetchData() {
    try {
      const { data: ruletaData, error: rError } = await supabase
        .from("ruletas")
        .select("*")
        .eq("short_code", slug)
        .eq("activa", true)
        .maybeSingle();

      if (rError || !ruletaData) {
        setError("Esta ruleta no está activa o no existe.");
        setLoading(false);
        return;
      }

      setRuleta(ruletaData);

      const { data: segData } = await supabase
        .from("ruleta_premios")
        .select("*")
        .eq("ruleta_id", ruletaData.id)
        .eq("activa", true);

      if (!segData || segData.length === 0) {
        setError("Esta ruleta no tiene premios configurados.");
      } else {
        setSegments(segData);
      }
    } catch (e) {
      setError("Ocurrió un error al cargar la ruleta.");
    } finally {
      setLoading(false);
    }
  }

  const handleStartSpin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !whatsapp) return;
    
    // Limpieza de whatsapp (solo números)
    const cleanWhatsapp = whatsapp.replace(/\D/g, "");
    if (cleanWhatsapp.length < 10) {
      alert("Por favor ingresá un número de WhatsApp válido.");
      return;
    }

    setSubmitting(true);

    // 1. Verificar si ya giró
    const { data: existingLead } = await supabase
      .from("ruleta_leads")
      .select("id")
      .eq("ruleta_id", ruleta!.id)
      .eq("whatsapp_cliente", cleanWhatsapp)
      .maybeSingle();

    if (existingLead) {
      alert("Lo sentimos, este número ya participó en esta ruleta.");
      setSubmitting(false);
      return;
    }

    // 2. Elegir ganador
    const winner = getWeightedRandom(segments, "probabilidad");
    const wIndex = segments.findIndex(s => s.id === winner.id);
    
    setWinnerIndex(wIndex);
    setPrize(winner);
    
    // 3. Ocultar formulario e iniciar giro
    setShowForm(false);
    setSpinning(true);
    setSubmitting(false);
  };

  const onSpinFinished = async () => {
    setSpinning(false);
    setShowPrizeModal(true);
    
    // Confetti!
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: segments.map(s => s.color)
    });

    // 4. Guardar lead
    const cleanWhatsapp = whatsapp.replace(/\D/g, "");
    await supabase.from("ruleta_leads").insert({
      ruleta_id: ruleta!.id,
      nombre_cliente: nombre,
      whatsapp_cliente: cleanWhatsapp,
      premio_id: prize!.id,
      premio_nombre: prize!.nombre
    });
  };

  const handleClaim = () => {
    if (!ruleta || !prize) return;
    const msg = `¡Hola! Gané un premio en la ruleta: *${prize.nombre}* ${ruleta.whatsapp_emojis || "🎡🎁"}\n\nMi nombre: ${nombre}\nValidez: ${prize.validez || "24hs"}`;
    const url = `https://wa.me/${ruleta.whatsapp_negocio}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1C0D02]">
        <Loader2 className="w-12 h-12 text-[#FFC107] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#1C0D02] text-white text-center">
        <AlertCircle className="w-16 h-16 text-[#D32F2F] mb-4" />
        <h2 className="text-2xl font-bold mb-2">¡Oops!</h2>
        <p className="text-orange-200/60">{error}</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#1C0D02] text-white overflow-hidden flex flex-col items-center justify-between py-8 px-4 font-serif">
      {/* Background decoration - Gastronomic Atmosphere */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-40">
         <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#D32F2F] rounded-full blur-[120px] opacity-20" />
         <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#FFC107] rounded-full blur-[120px] opacity-10" />
         {/* Texture overlay (conceptually wood/rustic) */}
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-5" />
      </div>

      {/* Header */}
      <div className="relative z-10 text-center mb-4">
        <h1 className="text-4xl font-black tracking-tighter uppercase mb-1 bg-clip-text text-transparent bg-gradient-to-b from-[#FFD54F] to-[#FF8F00]">
          {ruleta?.nombre}
        </h1>
        <p className="text-orange-200/60 text-xs font-bold tracking-[0.3em] uppercase">
          {ruleta?.subtitulo_logo || "Una experiencia gourmet en cada giro"}
        </p>
      </div>

      {/* Wheel Area */}
      <div className="relative z-10 w-full max-w-[420px] flex-1 flex items-center justify-center py-4">
        <div className="bg-[#2D1B0D]/40 backdrop-blur-2xl border border-white/5 rounded-[50px] p-4 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden group">
           <RuletaWheel 
             segments={segments}
             winnerIndex={winnerIndex}
             onFinished={onSpinFinished}
             spinning={spinning}
           />
           
           {/* Glass overlay hint */}
           {!spinning && showForm && (
             <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px] flex items-center justify-center p-6 text-center animate-in fade-in duration-700">
               <div className="bg-[#1C0D02]/95 p-8 rounded-[32px] border border-orange-500/20 shadow-2xl transform transition-transform group-hover:scale-105">
                 <Sparkles className="w-10 h-10 text-[#FFC107] mx-auto mb-4" />
                 <p className="text-xl font-black text-white uppercase tracking-tight">¡Girala y descubrí<br/>tu premio!</p>
                 <p className="text-orange-200/40 text-[10px] mt-2 tracking-widest">INGRESÁ TUS DATOS DEBAJO</p>
               </div>
             </div>
           )}
        </div>
      </div>

      {/* Form / Actions */}
      <div className="relative z-10 w-full max-w-[360px] mb-4">
        {showForm ? (
          <form onSubmit={handleStartSpin} className="space-y-4 bg-white/[0.03] backdrop-blur-md p-7 rounded-[32px] border border-white/5 shadow-2xl">
             <div className="relative group">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-200/30 w-4 h-4 group-focus-within:text-[#FFC107] transition-colors" />
                <input 
                  type="text" 
                  required
                  placeholder="Nombre y Apellido"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm outline-none focus:border-[#FFC107]/30 focus:bg-white/[0.08] transition-all placeholder:text-orange-200/20"
                />
             </div>
             <div className="relative group">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-200/30 w-4 h-4 group-focus-within:text-[#FFC107] transition-colors" />
                <input 
                  type="tel" 
                  required
                  placeholder="WhatsApp de contacto"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm outline-none focus:border-[#FFC107]/30 focus:bg-white/[0.08] transition-all placeholder:text-orange-200/20"
                />
             </div>
             <button 
               type="submit"
               disabled={submitting}
               className="w-full bg-gradient-to-br from-[#D32F2F] to-[#B71C1C] text-white py-4.5 rounded-2xl font-black text-lg shadow-[0_10px_20px_-5px_rgba(211,47,47,0.4)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 uppercase tracking-tighter"
             >
               {submitting ? "SALIENDO DEL HORNO..." : "¡GIRO GRATIS!"}
             </button>
             <div className="flex items-center justify-center gap-2 opacity-30">
               <CheckCircle2 size={10} />
               <p className="text-[9px] uppercase tracking-[0.2em] font-bold">Promoción Exclusiva</p>
             </div>
          </form>
        ) : !showPrizeModal && !spinning && (
          <div className="text-center p-10 bg-white/[0.02] backdrop-blur-md rounded-[32px] border border-white/5 shadow-2xl">
             <div className="relative w-12 h-12 mx-auto mb-5">
                <Loader2 className="w-12 h-12 text-[#FFC107] animate-spin" />
                <Sparkles className="absolute inset-0 w-6 h-6 text-white m-auto animate-pulse" />
             </div>
             <p className="font-black text-xl tracking-tighter uppercase italic">¡Mirá la Pizza!</p>
             <p className="text-orange-200/40 text-[10px] tracking-widest mt-1">SELECCIONANDO TU PREMIO...</p>
          </div>
        )}
      </div>


      {/* Prize Modal (Mobile Style) */}
      {showPrizeModal && prize && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="w-full max-w-[400px] bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1e] rounded-[40px] border border-white/10 p-8 text-center shadow-2xl scale-in-95 duration-300">
              <div className="w-20 h-20 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-yellow-400/10">
                <Gift className="w-10 h-10 text-yellow-500" />
              </div>
              <h2 className="text-sm font-black text-purple-400 uppercase tracking-[0.2em] mb-2">¡Felicitaciones {nombre.split(' ')[0]}!</h2>
              <div className="bg-white/5 rounded-2xl p-6 mb-8 border border-white/5">
                <p className="text-3xl font-black text-white leading-tight uppercase">
                  {prize.nombre}
                </p>
                {prize.validez && (
                  <p className="text-xs text-gray-500 mt-2 font-medium tracking-widest uppercase">Validez: {prize.validez}</p>
                )}
              </div>

              <div className="space-y-3">
                <button 
                  onClick={handleClaim}
                  className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(37,211,102,0.3)] hover:brightness-110 transition-all border border-white/10"
                >
                  <MessageSquare size={20} /> RECLAMAR EN WHATSAPP
                </button>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                  Se enviará un mensaje automático al comercio
                </p>
              </div>
           </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes scale-in-95 {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .scale-in-95 { animation: scale-in-95 0.3s ease-out; }
      `}</style>
    </main>
  );
}
