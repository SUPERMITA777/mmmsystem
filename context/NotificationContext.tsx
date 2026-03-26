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

  const playNotificationSound = useCallback(() => {
    try {
      const panelSettings = panelSettingsRef.current;
      if (panelSettings?.notificacion_sonora === false) return;

      const customSoundUrl = panelSettings?.sonido_notificacion === "custom" ? panelSettings?.sonido_notificacion_custom_url : null;
      const predefinedSound = panelSettings?.sonido_notificacion || "campana_1";

      if (customSoundUrl && panelSettings?.sonido_notificacion === "custom") {
        const audio = new Audio(customSoundUrl);
        audio.play().catch(e => console.warn("Error playing custom sound:", e));
        return;
      }

      // Predefined sounds Fallback/Default
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

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

  const enableAudio = () => {
    setAudioEnabled(true);
    // Play a silent sound to unlock audio
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
    if (AudioCtx) {
      const ctx = new AudioCtx();
      ctx.resume();
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
        filter: `sucursal_id=eq.${sucursalId}` 
      }, (payload) => {
        if (!firstLoadRef.current) {
          const newPedido = payload.new;
          if (!knownIdsRef.current.has(newPedido.id)) {
            knownIdsRef.current.add(newPedido.id);
            // Use ref to avoid stale closure — always calls the latest function
            playNotificationSoundRef.current();
          }
        }
      })
      .subscribe();

    // Listener for settings changes
    const settingsChannel = supabase
      .channel("global-settings-rt")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "config_sucursal",
        filter: `sucursal_id=eq.${sucursalId}`
      }, (payload) => {
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
