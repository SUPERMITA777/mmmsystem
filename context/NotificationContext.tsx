"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";

interface NotificationContextType {
  playNotificationSound: () => void;
  enableAudio: () => void;
  audioEnabled: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { sucursalId } = useTenant();
  const [audioEnabled, setAudioEnabled] = useState(false);
  const panelSettingsRef = useRef<any>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  // Use a ref for playNotificationSound so the Supabase channel callback
  // always calls the latest version (avoids stale closure bug)
  const playNotificationSoundRef = useRef<() => void>(() => {});

  // PERSISTENT AUDIO CONTEXT — One engine to rule them all
  const audioContextRef = useRef<AudioContext | null>(null);

  // Ref for notification permission — avoids stale closures without re-subscribing channels
  const notifPermissionRef = useRef<NotificationPermission>("default");

  // Sync permission ref on mount and after changes
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      notifPermissionRef.current = Notification.permission;
      console.log("[NotificationContext] Permiso inicial:", notifPermissionRef.current);
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const panelSettings = panelSettingsRef.current;
      if (panelSettings?.notificacion_sonora === false) {
        console.log("[NotificationContext] Sonido desactivado en ajustes");
        return;
      }

      const customSoundUrl = panelSettings?.sonido_notificacion === "custom"
        ? panelSettings?.sonido_notificacion_custom_url
        : null;
      const predefinedSound = panelSettings?.sonido_notificacion || "campana_1";

      console.log("[NotificationContext] Intento de sonido:", predefinedSound);

      if (customSoundUrl && panelSettings?.sonido_notificacion === "custom") {
        console.log("[NotificationContext] Intentando audio custom URL:", customSoundUrl);
        const audio = new Audio(customSoundUrl);
        
        audio.oncanplaythrough = () => {
          console.log("[NotificationContext] Audio custom cargado y listo");
        };

        audio.onerror = (e) => {
          console.warn("[NotificationContext] Error cargando audio custom (URL inválida o CORS):", e);
          playPredefinedTone("campana_1");
        };

        audio.play().then(() => {
          console.log("[NotificationContext] Audio custom iniciado con éxito");
        }).catch(e => {
          console.warn("[NotificationContext] Audio custom bloqueado/error:", e.message);
          // Fallback al tono de sistema si el MP3 falla
          playPredefinedTone("campana_1");
        });
        return;
      }

      playPredefinedTone(predefinedSound);
    } catch (e) {
      console.warn("[NotificationContext] Audio notification error general:", e);
    }
  }, []);

  // Helper to play predefined sounds using the persistent AudioContext
  const playPredefinedTone = async (type: string) => {
    try {
      console.log("[NotificationContext] playPredefinedTone:", type);
      
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
        console.log("[NotificationContext] AudioContext creado bajo demanda");
      }

      const ctx = audioContextRef.current;
      
      // Ensure it's running
      if (ctx.state === "suspended") {
        console.log("[NotificationContext] Resumiendo AudioContext...");
        await ctx.resume();
      }

      if (ctx.state !== "running") {
        console.warn("[NotificationContext] AudioContext no está 'running', estado actual:", ctx.state);
        return;
      }

      const playTone = (freq: number, start: number, duration: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = type === "burbuja" ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        osc.frequency.exponentialRampToValueAtTime(freq / 2, ctx.currentTime + start + duration);
        gain.gain.setValueAtTime(vol, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration + 0.1);
      };

      if (type === "campana_2") {
        playTone(440, 0, 0.5, 0.3);
        playTone(440, 0.6, 0.5, 0.3);
      } else if (type === "burbuja") {
        playTone(1200, 0, 0.1, 0.2);
        playTone(1500, 0.05, 0.1, 0.2);
      } else {
        // Default campana_1 (también se usa como fallback para custom)
        playTone(880, 0, 1.2, 0.4);
        playTone(1760, 0.05, 0.8, 0.2);
      }
    } catch (e) {
      console.warn("[NotificationContext] Error en playPredefinedTone:", e);
    }
  };

  // Keep the ref always pointing to the latest version
  useEffect(() => {
    playNotificationSoundRef.current = playNotificationSound;
  }, [playNotificationSound]);

  const enableAudio = async () => {
    console.log("[NotificationContext] Usuario habilitó audio (clic)");
    setAudioEnabled(true);

    // Initialize/Unlock persistent AudioContext
    try {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (AudioCtx) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioCtx();
        }
        const ctx = audioContextRef.current;
        await ctx.resume();
        console.log("[NotificationContext] AudioContext listo. Estado:", ctx.state);

        // Play a quick silent beep to ensure it's "blessed" by user gesture
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001; // extremely silent
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(0);
        osc.stop(0.1);
      }
    } catch (e) {
      console.warn("[NotificationContext] No se pudo activar el AudioContext:", e);
    }

    // Request Web Notifications permission
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      try {
        const permission = await Notification.requestPermission();
        notifPermissionRef.current = permission;
        console.log("[NotificationContext] Permiso de notificaciones ajustado a:", permission);
      } catch (e) {
        console.warn("[NotificationContext] Error pidiendo permiso de notificaciones:", e);
      }
    }
  };

  // Show a system notification
  const showSystemNotification = (pedido: any) => {
    if (typeof Notification === "undefined") return;
    if (notifPermissionRef.current !== "granted") return;

    console.log("[NotificationContext] Lanzando notificación visual para pedido:", pedido.id);

    const tipo =
      pedido?.tipo === "delivery" ? "🏍️ Delivery" :
      pedido?.tipo === "takeaway" ? "🥡 Take Away" :
      pedido?.tipo === "salon"    ? "🍽️ Salón"    : "📦 Nuevo";

    const nombre = pedido?.cliente_nombre || "Cliente";
    const total  = pedido?.total != null ? ` — $${pedido.total}` : "";

    try {
      const notif = new Notification("🔔 ¡Nuevo Pedido!", {
        body: `${tipo} · ${nombre}${total}`,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `pedido-${pedido?.id || Date.now()}`,
        requireInteraction: true, 
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };

      setTimeout(() => notif.close(), 60000);
    } catch (e) {
      console.warn("[NotificationContext] Error lanzando notificación:", e);
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
        .limit(50);

      if (data) {
        knownIdsRef.current = new Set(data.map(p => p.id));
      }
      firstLoadRef.current = false;
      console.log("[NotificationContext] Carga inicial de pedidos completada");
    };

    const fetchSettings = async () => {
      const { data } = await supabase
        .from("config_sucursal")
        .select("panel_settings")
        .eq("sucursal_id", sucursalId)
        .limit(1)
        .maybeSingle();
      if (data) {
        panelSettingsRef.current = data.panel_settings;
        console.log("[NotificationContext] Ajustes de panel cargados");
      }
    };

    fetchCurrentIds();
    fetchSettings();

    const channel = supabase
      .channel(`pedidos-events-${sucursalId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "pedidos",
        filter: `sucursal_id=eq.${sucursalId}`,
      }, (payload) => {
        console.log("[NotificationContext] EVENTO REALTIME insert en pedidos");
        if (!firstLoadRef.current) {
          const newPedido = payload.new;
          if (!knownIdsRef.current.has(newPedido.id)) {
            console.log("[NotificationContext] ¡Es un pedido nuevo!");
            knownIdsRef.current.add(newPedido.id);

            const soundEnabled = panelSettingsRef.current?.notificacion_sonora !== false;
            
            // Visual
            showSystemNotification(newPedido);

            // Audio
            if (soundEnabled) {
              playNotificationSoundRef.current();
            }
          }
        }
      })
      .subscribe((status) => {
        console.log("[NotificationContext] Supabase Status:", status);
      });

    // Listener for real-time settings changes
    const settingsChannel = supabase
      .channel(`settings-updates-${sucursalId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "config_sucursal",
        filter: `sucursal_id=eq.${sucursalId}`,
      }, (payload) => {
        console.log("[NotificationContext] Ajustes actualizados vía Supabase");
        panelSettingsRef.current = payload.new.panel_settings;
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(settingsChannel);
    };
  }, [sucursalId]);

  return (
    <NotificationContext.Provider value={{ playNotificationSound, enableAudio, audioEnabled }}>
      {children}
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
