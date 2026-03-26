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

  // Use a ref for playNotificationSound so the Supabase channel callback
  // always calls the latest version (avoids stale closure bug)
  const playNotificationSoundRef = useRef<() => void>(() => {});

  // PERSISTENT AUDIO CONTEXT
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // SHARED AUDIO ELEMENT for persistent playback
  const audioTagRef = useRef<HTMLAudioElement | null>(null);

  // Ref for notification permission
  const notifPermissionRef = useRef<NotificationPermission>("default");

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      notifPermissionRef.current = Notification.permission;
      console.log("[NotificationContext] Permiso de notificaciones:", notifPermissionRef.current);
    }
    
    // Create hidden audio tag
    const audio = document.createElement("audio");
    audio.style.display = "none";
    document.body.appendChild(audio);
    audioTagRef.current = audio;

    return () => {
      if (audioTagRef.current) {
        document.body.removeChild(audioTagRef.current);
      }
    };
  }, []);

  // Visual flash effect to confirm receipt
  const triggerFlash = useCallback(() => {
    setFlash(true);
    setTimeout(() => setFlash(false), 1000);
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const panelSettings = panelSettingsRef.current;
      const soundEnabled = panelSettings?.notificacion_sonora !== false;

      if (!soundEnabled) {
          console.log("[NotificationContext] Sonido deshabilitado en ajustes");
          return;
      }

      const customSoundUrl = panelSettings?.sonido_notificacion === "custom"
        ? panelSettings?.sonido_notificacion_custom_url
        : null;
      const predefinedSound = panelSettings?.sonido_notificacion || "campana_1";

      console.log("[NotificationContext] Solicitud de sonido:", predefinedSound);
      triggerFlash();

      if (customSoundUrl && panelSettings?.sonido_notificacion === "custom") {
        console.log("[NotificationContext] Reproduciendo desde URL:", customSoundUrl);
        if (audioTagRef.current) {
          audioTagRef.current.src = customSoundUrl;
          audioTagRef.current.volume = 1.0;
          audioTagRef.current.play().catch(e => {
            console.warn("[NotificationContext] Error .play() desde URL:", e.message);
            playPredefinedChime("campana_1");
          });
        }
        return;
      }

      playPredefinedChime(predefinedSound);
    } catch (e) {
      console.warn("[NotificationContext] playNotificationSound error general:", e);
    }
  }, [triggerFlash]);

  // Helper to play synthesized sounds with higher volume and persistence
  const playPredefinedChime = async (type: string) => {
    try {
      console.log("[NotificationContext] Generando tono sintético:", type);
      
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
      
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      if (ctx.state !== "running") {
        console.warn("[NotificationContext] No se pudo activar el motor de audio. Estado:", ctx.state);
        return;
      }

      const playTone = (freq: number, start: number, duration: number, vol: number, wave: OscillatorType = "sine") => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = wave;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        
        // Linear fade is often more audible and predictable
        gain.gain.setValueAtTime(vol, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
        
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration + 0.1);
      };

      if (type === "campana_2") {
        playTone(523.25, 0, 0.4, 0.8, "triangle"); // C5
        playTone(659.25, 0.5, 0.8, 0.6, "triangle"); // E5
      } else if (type === "burbuja") {
        playTone(1500, 0, 0.1, 0.5, "sine");
        playTone(2000, 0.05, 0.1, 0.5, "sine");
      } else {
        // High frequency chime (campana_1/fallback)
        // More aggressive tones to ensure audibility
        playTone(1000, 0, 1.0, 1.0, "triangle"); 
        playTone(1500, 0.1, 0.8, 0.7, "triangle");
      }
    } catch (e) {
      console.warn("[NotificationContext] playPredefinedChime error:", e);
    }
  };

  useEffect(() => {
    playNotificationSoundRef.current = playNotificationSound;
  }, [playNotificationSound]);

  const enableAudio = async () => {
    console.log("[NotificationContext] Inicializando Audio por interacción del usuario...");
    setAudioEnabled(true);

    try {
      // 1. Prime AudioContext
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (AudioCtx) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioCtx();
        }
        await audioContextRef.current.resume();
        console.log("[NotificationContext] AudioContext: UNLOCKED (" + audioContextRef.current.state + ")");
      }
      
      // 2. Prime Audio Tag
      if (audioTagRef.current) {
        // Play a silence to "prime" the browser media session
        audioTagRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAD";
        await audioTagRef.current.play().catch(() => {});
        console.log("[NotificationContext] AudioTag: PRIMED");
      }

      // 3. Test sound to confirm it's working
      playNotificationSound();
    } catch (e) {
      console.warn("[NotificationContext] Error en inicialización:", e);
    }

    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      Notification.requestPermission().then(p => {
          notifPermissionRef.current = p;
          console.log("[NotificationContext] Notificaciones permiso:", p);
      });
    }
  };

  const showSystemNotification = (pedido: any) => {
    if (typeof Notification === "undefined" || notifPermissionRef.current !== "granted") return;

    try {
      const tipo =
        pedido?.tipo === "delivery" ? "🏍️ Delivery" :
        pedido?.tipo === "takeaway" ? "🥡 Take Away" :
        pedido?.tipo === "salon"    ? "🍽️ Salón"    : "📦 Nuevo";

      const notif = new Notification("🔔 ¡Nuevo Pedido!", {
        body: `${tipo} · ${pedido?.cliente_nombre || "Cliente"} · $${pedido?.total || ""}`,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `pedido-${pedido?.id}`,
        requireInteraction: true,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      
      setTimeout(() => notif.close(), 60000);
    } catch (e) {
      console.warn("[NotificationContext] System Notification error:", e);
    }
  };

  useEffect(() => {
    if (!sucursalId) return;

    const fetchCurrentIds = async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id")
        .eq("sucursal_id", sucursalId)
        .in("estado", ["pendiente", "confirmado"])
        .order("created_at", { ascending: false })
        .limit(30);

      if (data) knownIdsRef.current = new Set(data.map(p => p.id));
      firstLoadRef.current = false;
      console.log("[NotificationContext] Inicializado para sucursal:", sucursalId);
    };

    const fetchSettings = async () => {
      const { data } = await supabase.from("config_sucursal").select("panel_settings").eq("sucursal_id", sucursalId).limit(1).maybeSingle();
      if (data) panelSettingsRef.current = data.panel_settings;
    };

    fetchCurrentIds();
    fetchSettings();

    const channel = supabase
      .channel(`rt-pedidos-${sucursalId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos", filter: `sucursal_id=eq.${sucursalId}` }, (payload) => {
        if (!firstLoadRef.current) {
          const newPedido = payload.new;
          if (!knownIdsRef.current.has(newPedido.id)) {
            console.log("[NotificationContext] NUEVO PEDIDO detectado:", newPedido.id);
            knownIdsRef.current.add(newPedido.id);

            // Trigger both visual and audio
            showSystemNotification(newPedido);
            playNotificationSoundRef.current();
          }
        }
      })
      .subscribe();

    const settingsChannel = supabase
      .channel(`rt-settings-${sucursalId}`)
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
      {/* Flash overlay confirming event receipt */}
      {flash && (
          <div className="fixed inset-0 z-[9999] pointer-events-none bg-blue-500/10 animate-pulse border-4 border-blue-500 rounded-3xl" />
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
