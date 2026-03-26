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

      console.log("[NotificationContext] Reproduciendo sonido:", predefinedSound, customSoundUrl ? "(custom)" : "");

      if (customSoundUrl && panelSettings?.sonido_notificacion === "custom") {
        const audio = new Audio(customSoundUrl);
        audio.play().catch(e => {
          console.warn("[NotificationContext] Error reproduciendo audio custom:", e);
          // Si falla el audio custom, intentamos el de fallback
          playPredefinedTone("campana_1");
        });
        return;
      }

      playPredefinedTone(predefinedSound);
    } catch (e) {
      console.warn("[NotificationContext] Audio notification error:", e);
    }
  }, []);

  // Helper to play predefined sounds using the persistent AudioContext
  const playPredefinedTone = (type: string) => {
    try {
      // Ensure context exists and is running
      if (!audioContextRef.current) {
        const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
        if (!AudioCtx) return;
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
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
        // Default campana_1
        playTone(880, 0, 1.2, 0.4);
        playTone(1760, 0.05, 0.8, 0.2);
      }
    } catch (e) {
      console.warn("[NotificationContext] playPredefinedTone error:", e);
    }
  };

  // Keep the ref always pointing to the latest version
  useEffect(() => {
    playNotificationSoundRef.current = playNotificationSound;
  }, [playNotificationSound]);

  const enableAudio = async () => {
    console.log("[NotificationContext] Habilitando audio y notificaciones...");
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
        console.log("[NotificationContext] AudioContext activado:", ctx.state);

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
      console.warn("[NotificationContext] Error activando AudioContext:", e);
    }

    // Request Web Notifications permission so we can alert even when in background
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      try {
        const permission = await Notification.requestPermission();
        notifPermissionRef.current = permission;
        console.log("[NotificationContext] Permiso de notificaciones obtenido:", permission);
        if (permission !== "granted") {
          console.warn("[NotificationContext] Notificaciones no permitidas por el usuario.");
        }
      } catch (e) {
        console.warn("[NotificationContext] Error solicitando permiso de notificaciones:", e);
      }
    }
  };

  // Show a system notification — works even when the tab is in the background
  const showSystemNotification = (pedido: any) => {
    if (typeof Notification === "undefined") return;
    if (notifPermissionRef.current !== "granted") {
      console.log("[NotificationContext] No se muestra notificación (sin permiso):", notifPermissionRef.current);
      return;
    }

    console.log("[NotificationContext] Mostrando notificación de sistema para pedido:", pedido.id);

    const tipo =
      pedido?.tipo === "delivery" ? "🏍️ Delivery" :
      pedido?.tipo === "takeaway" ? "🥡 Take Away" :
      pedido?.tipo === "salon"    ? "🍽️ Salón"    : "📦 Nuevo";

    const nombre = pedido?.cliente_nombre || "Cliente";
    const total  = pedido?.total != null ? ` — $${pedido.total}` : "";

    try {
      const notif = new Notification("🔔 ¡Nuevo Pedido!", {
        body: `${tipo} · ${nombre}${total}\nMMM System`,
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
      console.warn("[NotificationContext] Error creando notificación:", e);
    }
  };

  useEffect(() => {
    if (!sucursalId) return;

    const fetchCurrentIds = async () => {
      console.log("[NotificationContext] Cargando IDs de pedidos actuales...");
      const { data } = await supabase
        .from("pedidos")
        .select("id")
        .eq("sucursal_id", sucursalId)
        .in("estado", ["pendiente", "confirmado"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        knownIdsRef.current = new Set(data.map(p => p.id));
        console.log("[NotificationContext] IDs cargados:", knownIdsRef.current.size);
      }
      firstLoadRef.current = false;
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
      .channel(`pedidos-notif-${sucursalId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "pedidos",
        filter: `sucursal_id=eq.${sucursalId}`,
      }, (payload) => {
        console.log("[NotificationContext] REALTIME: Nuevo registro detectado");
        if (!firstLoadRef.current) {
          const newPedido = payload.new;
          if (!knownIdsRef.current.has(newPedido.id)) {
            console.log("[NotificationContext] Pedido nuevo confirmado:", newPedido.id);
            knownIdsRef.current.add(newPedido.id);

            const soundEnabled = panelSettingsRef.current?.notificacion_sonora !== false;
            
            // Disparamos notificación visual siempre (si hay permiso)
            showSystemNotification(newPedido);

            // Disparamos sonido si está habilitado
            if (soundEnabled) {
              playNotificationSoundRef.current();
            }
          } else {
            console.log("[NotificationContext] Pedido ya conocido, ignorando sonido.");
          }
        } else {
          console.log("[NotificationContext] Carga inicial, ignorando sonidos previos.");
        }
      })
      .subscribe((status) => {
        console.log("[NotificationContext] Canal pedidos status:", status);
      });

    // Listener for real-time settings changes
    const settingsChannel = supabase
      .channel(`settings-notif-${sucursalId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "config_sucursal",
        filter: `sucursal_id=eq.${sucursalId}`,
      }, (payload) => {
        console.log("[NotificationContext] Ajustes actualizados vía Realtime");
        panelSettingsRef.current = payload.new.panel_settings;
      })
      .subscribe();

    return () => {
      console.log("[NotificationContext] Cerrando canales...");
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
