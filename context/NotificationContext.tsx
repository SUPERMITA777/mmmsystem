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

  const playNotificationSoundRef = useRef<() => void>(() => {});
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioTagRef = useRef<HTMLAudioElement | null>(null);
  const notifPermissionRef = useRef<NotificationPermission>("default");

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      notifPermissionRef.current = Notification.permission;
      console.log("[NotificationContext] 📊 Permiso Notif:", notifPermissionRef.current);
    }
    
    const audio = document.createElement("audio");
    audio.style.display = "none";
    audio.id = "system-notif-audio";
    document.body.appendChild(audio);
    audioTagRef.current = audio;

    // EXPOSE TO CONSOLE FOR DIRECT TESTING
    (window as any).__TEST_SOUND__ = () => {
      console.log("[NotificationContext] 🛠️ Ejecutando TEST manual desde consola...");
      if (playNotificationSoundRef.current) playNotificationSoundRef.current();
    };

    return () => {
      if (audioTagRef.current) {
        document.body.removeChild(audioTagRef.current);
      }
      delete (window as any).__TEST_SOUND__;
    };
  }, []);

  const triggerFlash = useCallback(() => {
    setFlash(true);
    setTimeout(() => setFlash(false), 1000);
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const panelSettings = panelSettingsRef.current;
      const soundEnabled = panelSettings?.notificacion_sonora !== false;
      const visibility = document.visibilityState;
      const userActive = (navigator as any).userActivation?.isActive ?? "unknown";

      console.group("[NotificationContext] 🔊 Intento de reproducción");
      console.log("- Visibilidad:", visibility);
      console.log("- User Active:", userActive);
      console.log("- Ajustes cargados:", !!panelSettings);
      console.log("- Sonido habilitado en ajustes:", soundEnabled);
      console.log("- Sucursal ID en Context:", sucursalId);

      if (!soundEnabled) {
          console.log("❌ Cancelado: Sonido deshabilitado en ajustes");
          console.groupEnd();
          return;
      }

      const customSoundUrl = panelSettings?.sonido_notificacion === "custom"
        ? panelSettings?.sonido_notificacion_custom_url
        : null;
      const predefinedSound = panelSettings?.sonido_notificacion || "campana_1";

      triggerFlash();

      if (customSoundUrl && panelSettings?.sonido_notificacion === "custom") {
        console.log("- Modo: CUSTOM (URL:", customSoundUrl + ")");
        if (audioTagRef.current) {
          const tag = audioTagRef.current;
          tag.src = customSoundUrl;
          tag.volume = 1.0;
          tag.play()
            .then(() => console.log("✅ Playback iniciado exitosamente (URL)"))
            .catch(e => {
              console.warn("⚠️ Error .play() URL. Motivo:", e.message);
              console.log("🔄 Fallback a tono sintético...");
              playPredefinedChime("campana_1");
            });
        }
      } else {
        console.log("- Modo: SINTÉTICO (Tipo:", predefinedSound + ")");
        playPredefinedChime(predefinedSound);
      }
      console.groupEnd();
    } catch (e) {
      console.warn("[NotificationContext] Error crítico en playNotificationSound:", e);
      console.groupEnd();
    }
  }, [triggerFlash, sucursalId]);

  const playPredefinedChime = async (type: string) => {
    try {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtx) {
          console.error("❌ AudioContext no soportado en este navegador");
          return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
        console.log("🆕 AudioContext creado");
      }

      const ctx = audioContextRef.current;
      console.log("- Estado AudioContext:", ctx.state);
      
      if (ctx.state === "suspended") {
        console.log("⏳ Resumiendo AudioContext...");
        await ctx.resume();
        console.log("- Nuevo Estado:", ctx.state);
      }

      if (ctx.state !== "running") {
        console.error("❌ Context no pudo pasar a 'running'. Bloqueado por navegador.");
        return;
      }

      const playTone = (freq: number, start: number, duration: number, vol: number, wave: OscillatorType = "sine") => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = wave;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(vol, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration + 0.1);
        console.log(`🎶 Tone: ${freq}Hz (${wave}) - Vol: ${vol}`);
      };

      if (type === "campana_2") {
        playTone(523.25, 0, 0.4, 0.9, "triangle"); 
        playTone(659.25, 0.5, 0.8, 0.7, "triangle");
      } else if (type === "burbuja") {
        playTone(1500, 0, 0.1, 0.6, "sine");
        playTone(2000, 0.05, 0.1, 0.6, "sine");
      } else {
        // Tono Campana 1 (Fallback LOUD)
        playTone(1000, 0, 1.0, 1.0, "square"); 
        playTone(1500, 0.1, 0.8, 0.8, "square");
      }
    } catch (e) {
      console.warn("[NotificationContext] Error en síntesis:", e);
    }
  };

  useEffect(() => {
    playNotificationSoundRef.current = playNotificationSound;
  }, [playNotificationSound]);

  const enableAudio = async () => {
    console.group("[NotificationContext] 🖱️ Activación Iniciada");
    setAudioEnabled(true);

    try {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (AudioCtx) {
        if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
        await audioContextRef.current.resume();
        console.log("AudioContext state:", audioContextRef.current.state);
      }
      
      if (audioTagRef.current) {
        audioTagRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAD";
        await audioTagRef.current.play().then(() => console.log("Tag Primed")).catch(() => console.log("Tag Priming blocked"));
      }

      console.log("📢 Disparando sonido de prueba...");
      playNotificationSound();
    } catch (e) {
      console.warn("Error inicialización:", e);
    }
    console.groupEnd();

    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      Notification.requestPermission().then(p => {
          notifPermissionRef.current = p;
      });
    }
  };

  const showSystemNotification = (pedido: any) => {
    if (typeof Notification === "undefined" || notifPermissionRef.current !== "granted") return;
    try {
      const tipo = pedido?.tipo === "delivery" ? "🏍️ Delivery" : pedido?.tipo === "takeaway" ? "🥡 Take Away" : pedido?.tipo === "salon" ? "🍽️ Salón" : "📦 Nuevo";
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
      console.log("[NotificationContext] IDs conocidos listos:", knownIdsRef.current.size);
    };

    const fetchSettings = async () => {
      const { data } = await supabase.from("config_sucursal").select("panel_settings").eq("sucursal_id", sucursalId).limit(1).maybeSingle();
      if (data) {
        panelSettingsRef.current = data.panel_settings;
        console.log("[NotificationContext] Panel settings loaded for:", sucursalId);
      }
    };

    fetchCurrentIds();
    fetchSettings();

    const channel = supabase
      .channel(`rt-orders-${sucursalId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos", filter: `sucursal_id=eq.${sucursalId}` }, (payload) => {
        console.log("[NotificationContext] 🔔 EVENTO RECIBIDO:", payload.new.id);
        if (!firstLoadRef.current) {
          const newPedido = payload.new;
          if (!knownIdsRef.current.has(newPedido.id)) {
            console.log("➡️ Pedido nuevo real descubierto");
            knownIdsRef.current.add(newPedido.id);
            showSystemNotification(newPedido);
            if (playNotificationSoundRef.current) playNotificationSoundRef.current();
          } else {
            console.log("⏩ ID duplicado, ignorando");
          }
        } else {
          console.log("⏩ Carga inicial, ignorando");
        }
      })
      .subscribe((status) => console.log("[NotificationContext] Supabase Channel:", status));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sucursalId]);

  return (
    <NotificationContext.Provider value={{ playNotificationSound, enableAudio, audioEnabled, flash }}>
      {children}
      {flash && (
          <div className="fixed inset-0 z-[9999] pointer-events-none bg-blue-500/20 border-[20px] border-blue-500 animate-ping" />
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
