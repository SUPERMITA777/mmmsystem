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

  // Ref for notification permission — avoids stale closures without re-subscribing channels
  const notifPermissionRef = useRef<NotificationPermission>("default");

  // Sync permission ref on mount and after changes
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      notifPermissionRef.current = Notification.permission;
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const panelSettings = panelSettingsRef.current;
      if (panelSettings?.notificacion_sonora === false) return;

      const customSoundUrl = panelSettings?.sonido_notificacion === "custom"
        ? panelSettings?.sonido_notificacion_custom_url
        : null;
      const predefinedSound = panelSettings?.sonido_notificacion || "campana_1";

      if (customSoundUrl && panelSettings?.sonido_notificacion === "custom") {
        const audio = new Audio(customSoundUrl);
        audio.play().catch(e => console.warn("Error playing custom sound:", e));
        return;
      }

      // Predefined sounds via Web Audio API
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") ctx.resume();

      const playTone = (freq: number, start: number, duration: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = predefinedSound === "burbuja" ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        osc.frequency.exponentialRampToValueAtTime(freq / 2, ctx.currentTime + start + duration);
        gain.gain.setValueAtTime(vol, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration + 0.1);
      };

      if (predefinedSound === "campana_2") {
        playTone(440, 0, 0.5, 0.3);
        playTone(440, 0.6, 0.5, 0.3);
      } else if (predefinedSound === "burbuja") {
        playTone(1200, 0, 0.1, 0.2);
        playTone(1500, 0.05, 0.1, 0.2);
      } else {
        // Default campana_1
        playTone(880, 0, 1.2, 0.4);
        playTone(1760, 0.05, 0.8, 0.2);
      }
    } catch (e) {
      console.warn("Audio notification error:", e);
    }
  }, []);

  // Keep the ref always pointing to the latest version
  useEffect(() => {
    playNotificationSoundRef.current = playNotificationSound;
  }, [playNotificationSound]);

  const enableAudio = async () => {
    setAudioEnabled(true);

    // Unlock Web Audio context (requires user gesture)
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
    if (AudioCtx) {
      const ctx = new AudioCtx();
      ctx.resume();
    }

    // Request Web Notifications permission so we can alert even when in background
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      try {
        const permission = await Notification.requestPermission();
        notifPermissionRef.current = permission;
        if (permission !== "granted") {
          console.warn("Notificaciones del sistema no permitidas. Solo sonido cuando la pestaña esté activa.");
        }
      } catch (e) {
        console.warn("Error solicitando permiso de notificaciones:", e);
      }
    }
  };

  // Show a system notification — works even when the tab is in the background
  const showSystemNotification = (pedido: any) => {
    if (typeof Notification === "undefined") return;
    if (notifPermissionRef.current !== "granted") return;

    const tipo =
      pedido?.tipo === "delivery" ? "🏍️ Delivery" :
      pedido?.tipo === "takeaway" ? "🥡 Take Away" :
      pedido?.tipo === "salon"    ? "🍽️ Salón"    : "📦 Nuevo";

    const nombre = pedido?.cliente_nombre || "Cliente";
    const total  = pedido?.total != null ? ` — $${pedido.total}` : "";

    const notif = new Notification("🔔 ¡Nuevo Pedido!", {
      body: `${tipo} · ${nombre}${total}`,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      // Unique tag per order prevents duplicate pop-ups
      tag: `pedido-${pedido?.id || Date.now()}`,
      // requireInteraction keeps the notification visible until the user acts on it
      requireInteraction: true,
    });

    // Clicking the notification focuses the tab
    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    // Auto-dismiss after 60 seconds as a safety net
    setTimeout(() => notif.close(), 60000);
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
      }
    };

    fetchCurrentIds();
    fetchSettings();

    const channel = supabase
      .channel("global-pedidos-rt")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "pedidos",
        filter: `sucursal_id=eq.${sucursalId}`,
      }, (payload) => {
        if (!firstLoadRef.current) {
          const newPedido = payload.new;
          if (!knownIdsRef.current.has(newPedido.id)) {
            knownIdsRef.current.add(newPedido.id);

            const soundEnabled = panelSettingsRef.current?.notificacion_sonora !== false;
            if (!soundEnabled) return;

            // Always show a system notification — it works even in background
            // and also appears as a banner/alert in the OS task bar
            showSystemNotification(newPedido);

            // Play audio — browsers allow this when the page is focused.
            // When in background it may be silently blocked, but the system
            // notification above covers that case visually + audibly (OS sound).
            playNotificationSoundRef.current();
          }
        }
      })
      .subscribe();

    // Listener for real-time settings changes
    const settingsChannel = supabase
      .channel("global-settings-rt")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "config_sucursal",
        filter: `sucursal_id=eq.${sucursalId}`,
      }, (payload) => {
        panelSettingsRef.current = payload.new.panel_settings;
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(settingsChannel);
    };
  }, [sucursalId]); // stable — no function dependencies needed since we use refs

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
