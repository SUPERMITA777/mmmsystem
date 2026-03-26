"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";

interface NotificationContextType {
  playNotificationSound: () => void;
  enableAudio: () => void;
  audioEnabled: boolean;
  flash: boolean;
  isAudioContextSuspended: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { sucursalId } = useTenant();
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [flash, setFlash] = useState(false);
  const [isAudioContextSuspended, setIsAudioContextSuspended] = useState(false);

  // Persistence of audioEnabled
  useEffect(() => {
    const saved = localStorage.getItem("MMM_AUDIO_ENABLED");
    if (saved === "true") {
      setAudioEnabled(true);
      console.log("[NotificationContext] 🔄 Recordando estado de audio: ACTIVADO");
      
      // Inicializar AudioContext si ya estaba habilitado
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (AudioCtx && !audioContextRef.current) {
          audioContextRef.current = new AudioCtx();
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("MMM_AUDIO_ENABLED", audioEnabled ? "true" : "false");
  }, [audioEnabled]);
  
  // REFS
  const panelSettingsRef = useRef<any>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const notifPermissionRef = useRef<NotificationPermission>("default");
  const playNotificationSoundRef = useRef<() => void>(() => {});

  // SYNC REF TO AVOID STALE CLOSURES IN SUPABASE SUBSCRIPTIONS
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      notifPermissionRef.current = Notification.permission;
      console.log("[NotificationContext] 📊 Permiso Notif:", notifPermissionRef.current);
    }
    
    // EXPOSE TO CONSOLE FOR DIRECT TESTING
    (window as any).__TEST_SOUND__ = () => {
      console.log("[NotificationContext] 🛠️ TEST MANUAL de sonido y voz...");
      if (playNotificationSoundRef.current) playNotificationSoundRef.current();
    };

    const handleGlobalClick = () => {
      if (audioEnabled && audioContextRef.current && audioContextRef.current.state === "suspended") {
        console.log("[NotificationContext] 🖱️ Autoresumiendo AudioContext por interacción global...");
        audioContextRef.current.resume().then(() => {
          setIsAudioContextSuspended(false);
          // Opcional: pequeño tono de confirmación al desbloquear
          if (playNotificationSoundRef.current) {
             console.log("[NotificationContext] ✅ Audio desbloqueado");
             // trigger a small test sound to confirm
             playNotificationSoundRef.current();
          }
        });
      }
    };

    window.addEventListener("click", handleGlobalClick);

    return () => {
      delete (window as any).__TEST_SOUND__;
      window.removeEventListener("click", handleGlobalClick);
    };
  }, [audioEnabled]);

  // Monitor AudioContext state
  useEffect(() => {
    const checkState = () => {
      if (audioContextRef.current) {
        setIsAudioContextSuspended(audioContextRef.current.state === "suspended");
      }
    };
    const timer = setInterval(checkState, 2000);
    return () => clearInterval(timer);
  }, []);

  const triggerFlash = useCallback(() => {
    setFlash(true);
    setTimeout(() => setFlash(false), 1000);
  }, []);

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

  const playOscillatorTone = useCallback(async (type: string) => {
    try {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtx) return;

      if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
      const ctx = audioContextRef.current;
      
      if (ctx.state === "suspended") await ctx.resume();
      if (ctx.state !== "running") {
          console.warn("⚠️ AudioContext not running. Status:", ctx.state);
          setIsAudioContextSuspended(true);
          return;
      }
      setIsAudioContextSuspended(false);

      const playTone = (freq: number, start: number, duration: number, vol: number, oscType: OscillatorType) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = oscType;
          osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
          gain.gain.setValueAtTime(vol * 1.5, ctx.currentTime + start); // Aumentar volumen un 50%
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + duration);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + duration + 0.1);
      };

      if (type === "campana_2") {
          // Campana doble más brillante
          playTone(880, 0, 0.6, 0.6, "triangle");
          playTone(1108.73, 0.2, 0.6, 0.6, "triangle");
      } else if (type === "burbuja") {
          playTone(1800, 0, 0.1, 0.4, "sine");
          playTone(2200, 0.05, 0.1, 0.4, "sine");
      } else {
          // Tono de alerta más penetrante (campana_1 o default)
          playTone(1200, 0, 0.8, 1.0, "square");
          playTone(1500, 0.1, 0.8, 0.8, "square");
          playTone(1000, 0.2, 0.8, 0.8, "square");
      }
    } catch (e) {
      console.warn("Oscillator error:", e);
    }
  }, []);

  const playNotificationSound = useCallback((force = false) => {
    try {
      const panelSettings = panelSettingsRef.current;
      const soundEnabled = panelSettings?.notificacion_sonora !== false;

      console.group("[NotificationContext] 🔊 Alerta activada");

      // Re-asegurar que el AudioContext esté activo
      if (audioContextRef.current?.state === "suspended") {
          console.log("🔄 Reanudando AudioContext...");
          audioContextRef.current.resume();
      }

      if (!soundEnabled && !force) {
          console.log("❌ Cancelado por ajustes (notificacion_sonora: false)");
          console.groupEnd();
          return;
      }

      if (!audioEnabled && !force) {
          console.log("❌ Cancelado: El usuario no ha habilitado el audio");
          console.groupEnd();
          return;
      }

      triggerFlash();

      const customSoundUrl = panelSettings?.sonido_notificacion === "custom" || panelSettings?.sonido_notificacion_custom_url
        ? panelSettings?.sonido_notificacion_custom_url
        : null;
      const predefinedSound = panelSettings?.sonido_notificacion || "campana_1";

      if (customSoundUrl) {
          console.log("🎵 Cargando sonido personalizado:", customSoundUrl);
          // Cache busting para evitar ERR_CACHE_OPERATION_NOT_SUPPORTED
          const audioUrl = `${customSoundUrl}${customSoundUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
          const audio = new Audio(audioUrl);
          audio.volume = 1.0;
          audio.play().catch(e => {
              console.warn("⚠️ Audio element failed, falling back to oscillator:", e.message);
              playOscillatorTone(predefinedSound);
          });
      } else {
          playOscillatorTone(predefinedSound);
      }

      speakNotification("Nuevo pedido recibido");
      console.groupEnd();
    } catch (e) {
      console.error("[NotificationContext] Error en alerta:", e);
      console.groupEnd();
    }
  }, [triggerFlash, speakNotification, playOscillatorTone, audioEnabled]);

  // UPDATE REF FOR SUPABASE CHANNELS
  useEffect(() => {
    playNotificationSoundRef.current = playNotificationSound;
  }, [playNotificationSound]);

  const enableAudio = useCallback(() => {
    setAudioEnabled(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("MMM_AUDIO_ENABLED", "true");
      
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (AudioCtx && !audioContextRef.current) {
          audioContextRef.current = new AudioCtx();
          console.log("[NotificationContext] 🎹 AudioContext inicializado");
      }

      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume().then(() => {
              console.log("[NotificationContext] 🎹 AudioContext reanudado");
              setIsAudioContextSuspended(false);
          });
      }
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        speakNotification("Audio habilitado");
    }

    playNotificationSound(true); // Forzar sonido inicial

    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      Notification.requestPermission().then(p => {
        notifPermissionRef.current = p;
      });
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

    const setupRealtime = () => {
      if (!sucursalId) return;

      console.log(`[NotificationContext] 📡 Iniciando suscripción Realtime para: ${sucursalId}`);

      const channel = supabase
        .channel(`rt-ord-notif-${sucursalId}`)
        .on("postgres_changes", { 
          event: "INSERT", 
          schema: "public", 
          table: "pedidos", 
          filter: `sucursal_id=eq.${sucursalId}` 
        }, (payload) => {
          console.log("[NotificationContext] 🔔 NUEVO PEDIDO DETECTADO:", payload.new.id);
          if (!firstLoadRef.current) {
            const newPedido = payload.new;
            if (!knownIdsRef.current.has(newPedido.id)) {
              knownIdsRef.current.add(newPedido.id);
              showSystemNotification(newPedido);
              if (playNotificationSoundRef.current) {
                  console.log("[NotificationContext] 🔊 Ejecutando alerta sonora");
                  playNotificationSoundRef.current();
              }
            }
          }
        })
        .subscribe(async (status) => {
            console.log(`[NotificationContext] 📡 Estado suscripción real-time: ${status}`);
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                console.log("[NotificationContext] 🔄 Error detectado, reiniciando canal en 5s...");
                setTimeout(() => {
                    supabase.removeChannel(channel);
                    setupRealtime();
                }, 5000);
            }
        });
      
      return channel;
    };

    const channel = setupRealtime();

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
    <NotificationContext.Provider value={{ playNotificationSound, enableAudio, audioEnabled, flash, isAudioContextSuspended }}>
      {children}
      {flash && (
          <div className="fixed inset-0 z-[9999] pointer-events-none bg-blue-500/30 border-[15px] border-blue-500 animate-pulse" />
      )}
      {audioEnabled && isAudioContextSuspended && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] bg-orange-500 text-white px-6 py-3 rounded-full shadow-2xl font-bold animate-bounce flex items-center gap-3">
          <span className="text-xl">🔔</span>
          Haga clic en cualquier lugar para activar el sonido
        </div>
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
