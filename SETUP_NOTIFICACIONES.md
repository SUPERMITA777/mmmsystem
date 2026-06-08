# Configuración de Notificaciones Push PWA para Soporte Técnico (Superadmin)

Este documento detalla los pasos para configurar, desplegar y probar el sistema de notificaciones push en tiempo real para el módulo de soporte de **MMM System**.

---

## 1. Arquitectura del Sistema

El flujo de notificaciones push se compone de los siguientes elementos:
1. **Cliente Web (PWA)**: Registra un Service Worker (`public/sw.js`) y genera una suscripción push usando la clave pública VAPID.
2. **Supabase Database**: Almacena las suscripciones push vinculadas a los usuarios administradores en la tabla `push_subscriptions`.
3. **Database Webhook**: Gatilla una llamada HTTP POST a la API `/api/support/notify` ante cualquier inserción de un nuevo mensaje en `support_messages`.
4. **API Endpoint (`/api/support/notify`)**: Valida la firma del secreto del webhook, obtiene las suscripciones push de los administradores y envía las notificaciones usando `web-push`.

---

## 2. Variables de Entorno

Asegúrate de agregar las siguientes variables en el archivo `.env` de producción (por ejemplo, en Vercel):

```env
# Claves VAPID para Web Push (Generadas con: npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BCYYvg9zmeTphX5dSogsBBPNDZm-Yikrbl9rP4HRlfDL-K519ODfNVNGiwsIozOeXWSLLPGeIAeaPGzCNvKjdEk
VAPID_PRIVATE_KEY=B4z4y0S7lpxr7vOzviUfCiw52_JW2kHu_uqO13DzKus
VAPID_SUBJECT=mailto:admin@mmm-system.com

# Secreto de seguridad para llamadas de Webhook (Supabase -> API)
SUPPORT_WEBHOOK_SECRET=webhook_secret_support_9988776655
```

> [!WARNING]
> La variable `VAPID_PRIVATE_KEY` y `SUPPORT_WEBHOOK_SECRET` **nunca** deben incluirse en el repositorio de Git ni exponerse en el frontend.

---

## 3. Configuración del Webhook en Supabase

Para que las notificaciones funcionen de forma automática cuando un tenant escribe un mensaje de soporte, debes configurar un webhook de base de datos en Supabase:

1. Ve a tu **Supabase Dashboard** -> **Database** -> **Webhooks**.
2. Haz clic en **Create a new Webhook**.
3. Rellena los campos con los siguientes valores:
   - **Name**: `send_support_push`
   - **Table**: `support_messages`
   - **Events**: Marca únicamente `Insert` (INSERT).
   - **Type**: `HTTP Post`
   - **URL**: `https://TU_DOMINIO.vercel.app/api/support/notify`
   - **HTTP Headers**:
     - Nombre: `x-support-webhook-secret`
     - Valor: `webhook_secret_support_9988776655` (o tu valor personalizado en `SUPPORT_WEBHOOK_SECRET`).
4. Haz clic en **Save**.

---

## 4. Instalación de PWA y Activación

Para probar las notificaciones en tu celular o computadora:

1. Entra a la aplicación usando **HTTPS** (o `localhost` en desarrollo).
2. Instala la aplicación (haz clic en el icono de instalación de PWA en la barra de navegación del navegador o la opción "Añadir a la pantalla de inicio" en móviles).
3. Inicia sesión con un usuario que tenga el rol de `super_admin`.
4. Dirígete a la sección de **Soporte** (`/[tenant]/admin/soporte`).
5. En la parte superior, verás el panel de control de notificaciones. Haz clic en **Activar Notificaciones**.
6. Concede los permisos de notificación que solicitará el navegador.
7. ¡Listo! El indicador cambiará a **Notificaciones Activas** (color verde).

---

## 5. Pruebas y Depuración

Para comprobar que las notificaciones llegan con la aplicación cerrada:

1. Registra tu suscripción de super_admin tal como se describe en el apartado anterior.
2. Cierra la pestaña del navegador donde tienes la aplicación abierta.
3. Desde otra ventana o dispositivo (iniciando sesión como un tenant normal), entra a la sección de soporte y crea un ticket o envía un mensaje nuevo.
4. En pocos segundos, deberías recibir una notificación flotante en tu escritorio o celular con el contenido del mensaje.
5. Al hacer clic en la notificación, se abrirá la aplicación en la pestaña de soporte mostrando el chat con el ticket seleccionado automáticamente.
