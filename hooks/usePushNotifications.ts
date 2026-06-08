"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/admin/AuthProvider";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  const getSubscription = useCallback(async (registration: ServiceWorkerRegistration) => {
    try {
      const sub = await registration.pushManager.getSubscription();
      return sub;
    } catch (err) {
      console.error("Error al obtener suscripción:", err);
      return null;
    }
  }, []);

  const checkSubscription = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setLoading(false);
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await getSubscription(reg);
      setPermission(Notification.permission);
      
      if (sub && user?.id) {
        // Verificar en Supabase si esta suscripción está registrada para este usuario
        const { data, error: dbErr } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("usuario_id", user.id)
          .eq("activo", true)
          .single();

        if (data && !dbErr) {
          setIsSubscribed(true);
        } else {
          // Si no está en Supabase pero sí en browser, o dio error, consideramos no suscrito localmente
          setIsSubscribed(false);
        }
      } else {
        setIsSubscribed(false);
      }
    } catch (err: any) {
      console.error("Error comprobando suscripción push:", err);
      setError(err.message || "Error al comprobar estado de suscripción");
    } finally {
      setLoading(false);
    }
  }, [user?.id, getSubscription]);

  // Ejecutar verificación inicial si el usuario está logueado y es super_admin
  useEffect(() => {
    if (user && user.rol === "super_admin") {
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, [user, checkSubscription]);

  const subscribe = async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("Las notificaciones push no son compatibles con este navegador.");
    }

    if (!user) {
      throw new Error("Debes iniciar sesión para activar las notificaciones.");
    }

    if (user.rol !== "super_admin") {
      throw new Error("Solo los administradores de soporte pueden activar notificaciones.");
    }

    setLoading(true);
    setError(null);

    try {
      // Pedir permiso
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        throw new Error("Permiso de notificaciones denegado por el usuario.");
      }

      const reg = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error("La clave pública VAPID no está configurada.");
      }

      const convertedKey = urlBase64ToUint8Array(publicKey);
      
      // Suscribirse en PushManager
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });

      const subscriptionJson = sub.toJSON();

      // Guardar en la tabla push_subscriptions
      const { error: dbErr } = await supabase
        .from("push_subscriptions")
        .insert({
          usuario_id: user.id,
          subscription_json: subscriptionJson,
          activo: true
        });

      if (dbErr) {
        throw dbErr;
      }

      setIsSubscribed(true);
    } catch (err: any) {
      console.error("Error al suscribirse a notificaciones push:", err);
      setError(err.message || "Error al suscribirse");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    if (!user) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        // Guardar JSON de la suscripción para buscar y desactivar en Supabase
        const subJson = sub.toJSON();

        // 1. Eliminar o desactivar de Supabase
        const { error: dbErr } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("usuario_id", user.id)
          .eq("subscription_json->>endpoint", sub.endpoint);

        if (dbErr) {
          console.error("Error eliminando suscripción de la base de datos:", dbErr);
        }

        // 2. Desuscribirse del navegador
        await sub.unsubscribe();
      }

      setIsSubscribed(false);
    } catch (err: any) {
      console.error("Error al desactivar notificaciones push:", err);
      setError(err.message || "Error al desactivar las notificaciones");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    isSubscribed,
    loading,
    error,
    permission,
    subscribe,
    unsubscribe,
    supported: typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
  };
}
