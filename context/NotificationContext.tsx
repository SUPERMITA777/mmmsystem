"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";

interface NotificationContextType {
  playNotificationSound: () => void;
  enableAudio: () => void;
  audioEnabled: boolean;
  flash: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { sucursalId } = useTenant();
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [flash, setFlash] = useState(false);
  const panelSettingsRef = useRef<any>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const audioContextRef = useRef<AudioContext | null>(null);
  const notifPermissionRef = useRef<NotificationPermission>("default");

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      notifPermissionRef.current = Notification.permission;
      console.log("[NotificationContext] 📊 Permiso Notif:", notifPermissionRef.current);
    }

    // EXPOSE TO CONSOLE FOR DIRECT TESTING
    (window as any).__TEST_SOUND__ = () => {
      console.log("[NotificationContext] 🛠️ TEST MANUAL de sonido y voz...");
      playNotificationSound();
    };

    return () => {
      delete (window as any).__TEST_SOUND__;
    };
  }, []);

  const triggerFlash = useCallback(() => {
    setFlash(true);
    setTimeout(() => setFlash(false), 1000);
  }, []);

  // NEW: Speech Synthesis fallback - hard to block once activated
  const speakNotification = useCallback((text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
        console.log("[NotificationContext] 🗣️ Synthesizing speech:", text);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "es-ES";
        utterance.rate = 1.1;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const panelSettings = panelSettingsRef.current;
      const soundEnabled = panelSettings?.notificacion_sonora !== false;

      console.group("[NotificationContext] 🔊 Alerta activada");
      console.log("- Status:", {
          visible: document.visibilityState,
          userActive: (navigator as any).userActivation?.isActive,
          soundEnabled
      });

      if (!soundEnabled) {
          console.log("❌ Cancelado por ajustes");
          console.groupEnd();
          return;
      }

      // 1. Visual
      triggerFlash();

      // 2. Audio (Custom MP3 or Synthesis)
      const customSoundUrl = panelSettings?.sonido_notificacion === "custom"
        ? panelSettings?.sonido_notificacion_custom_url
        : null;
      const predefinedSound = panelSettings?.sonido_notificacion || "campana_1";

      if (customSoundUrl && panelSettings?.sonido_notificacion === "custom") {
          console.log("- Play: HTML Audio (" + customSoundUrl + ")");
          const audio = new Audio(customSoundUrl);
          audio.play().catch(e => {
              console.warn("⚠️ Audio element failed:", e.message);
              playOscillatorTone("campana_1");
          });
      } else {
          playOscillatorTone(predefinedSound);
      }

      // 3. Speech (Safe fallback)
      speakNotification("Nuevo pedido recibido");

      console.groupEnd();
    } catch (e) {
      console.error("[NotificationContext] Error fatal en alerta:", e);
      console.groupEnd();
    }
  }, [triggerFlash, speakNotification]);

  const playOscillatorTone = async (type: string) => {
    try {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtx) return;

      if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
      const ctx = audioContextRef.current;
      
      if (ctx.state === "suspended") await ctx.resume();
      if (ctx.state !== "running") {
          console.warn("⚠️ AudioContext not running. Current state:", ctx.state);
          return;
      }

      const playTone = (freq: number, start: number, duration: number, vol: number, type: OscillatorType) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = type;
          osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
          gain.gain.setValueAtTime(vol, ctx.currentTime + start);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + duration);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + duration + 0.1);
      };

      if (type === "campana_2") {
          playTone(440, 0, 0.5, 0.5, "triangle");
          playTone(554.37, 0.3, 0.5, 0.5, "triangle");
      } else if (type === "burbuja") {
          playTone(1800, 0, 0.1, 0.4, "sine");
          playTone(2200, 0.05, 0.1, 0.4, "sine");
      } else {
          // Campana 1 / Default - AGGRESSIVE
          playTone(1000, 0, 0.8, 1.0, "square");
          playTone(1200, 0.1, 0.8, 0.8, "square");
      }
    } catch (e) {
      console.warn("Oscillator error:", e);
    }
  };

  const enableAudio = async () => {
    setAudioEnabled(true);
    console.log("[NotificationContext] 🖱️ Activado");

    // Prime Web Audio
    try {
        const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
        if (AudioCtx) {
            audioContextRef.current = new AudioCtx();
            await audioContextRef.current.resume();
        }
    } catch (e) {}

    // Prime Speech (often helps just browsing voices)
    if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        speakNotification("Audio habilitado");
    }

    // Manual playback of test sound
    playNotificationSound();

    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      Notification.requestPermission().then(p => notifPermissionRef.current = p);
    }
  };

  const showSystemNotification = (pedido: any) => {
    if (typeof Notification === "undefined" || notifPermissionRef.current !== "granted") return;
    try {
      const tipo = pedido?.tipo === "delivery" ? "🏍️ Delivery" : pedido?.tipo === "takeaway" ? "🥡 Take Away" : pedido?.tipo === "salon" ? "🍽️ Salón" : "📦 Pedido";
      new Notification("🔔 ¡Nuevo Pedido!", {
        body: `${tipo} · ${pedido?.cliente_nombre || "Cliente"} · $${pedido?.total || ""}`,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `pedido-${pedido?.id}`,
        requireInteraction: true,
      }).onclick = () => window.focus();
    } catch (e) {
      console.warn("Notification error:", e);
    }
  };

  useEffect(() => {
    if (!sucursalId) return;

    const fetchCurrentIds = async () => {
      const { data } = await supabase.from("pedidos").select("id").eq("sucursal_id", sucursalId).in("estado", ["pendiente", "confirmado"]).order("created_at", { ascending: false }).limit(30);
      if (data) knownIdsRef.current = new Set(data.map(p => p.id));
      firstLoadRef.current = false;
    };

    const fetchSettings = async () => {
      const { data } = await supabase.from("config_sucursal").select("panel_settings").eq("sucursal_id", sucursalId).limit(1).maybeSingle();
      if (data) panelSettingsRef.current = data.panel_settings;
    };

    fetchCurrentIds();
    fetchSettings();

    const channel = supabase
      .channel(`rt-ord-notif-${sucursalId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos", filter: `sucursal_id=eq.${sucursalId}` }, (payload) => {
        if (!firstLoadRef.current) {
          const newPedido = payload.new;
          if (!knownIdsRef.current.has(newPedido.id)) {
            knownIdsRef.current.add(newPedido.id);
            showSystemNotification(newPedido);
            if (playNotificationSoundRef.current) playNotificationSoundRef.current();
          }
        }
      })
      .subscribe();

    const settingsChannel = supabase
      .channel(`rt-set-notif-${sucursalId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "config_sucursal", filter: `sucursal_id=eq.${sucursalId}` }, (payload) => {
        panelSettingsRef.current = payload.new.panel_settings;
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(settingsChannel);
    };
  }, [sucursalId]);

  return (
    <NotificationContext.Provider value={{ playNotificationSound, enableAudio, audioEnabled, flash }}>
      {children}
      {flash && (
          <div className="fixed inset-0 z-[9999] pointer-events-none bg-blue-500/30 border-[15px] border-blue-500 animate-pulse" />
      )}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
