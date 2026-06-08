# MMM SYSTEM - Gastronomic POS & Delivery Platform

Sistema POS completo en la nube diseñado para la gestión de locales gastronómicos: pedidos de delivery, take away y salón, con capacidades de sincronización offline local y despacho de comandas.

---

## 🚀 Características Principales

- 🛒 **Gestión de Pedidos:** Flujos de trabajo optimizados para Delivery, Take Away y Salón.
- 💳 **Punto de Venta (POS):** Facturación y despacho en tiempo real.
- 📊 **Dashboard:** Analíticas e informes de ventas de las sucursales.
- 👥 **Clientes:** Agenda unificada e historial de consumo.
- 🍽️ **Mesas & Salón:** Distribución visual y control de ocupación.
- 📦 **Productos e Inventario:** Recetarios, fichas técnicas y control de stock.
- 🔔 **Notificaciones en Tiempo Real:** Canales WebSockets de Supabase Realtime con fallback de polling inteligente y alertas de voz TTS.
- ⚡ **Modo Offline Híbrido:** Persistencia local mediante Dexie (IndexedDB) para seguir operando sin internet y sincronizar automáticamente al recuperar señal.
- 🔌 **Impresión Local:** Puente de impresión local (`printer-bridge.js`) para ticketeadoras térmicas de cocina y caja.
- 📲 **WhatsApp Integration:** Agente local integrado para despachar confirmaciones automáticas de pedidos.

---

## 📁 Estructura del Proyecto y Arquitectura

```text
├── app/                      # Next.js App Router (Rutas de la aplicación)
│   ├── [tenant]/             # Rutas con aislamiento multi-tenant por comercio
│   │   ├── admin/            # Panel de control del comercio
│   │   └── camarero/         # Interfaz para camareros y pedidos de mesa
│   ├── api/                  # Endpoints del lado del servidor (backend)
│   └── page.tsx              # Landing page principal
├── components/               # Componentes de React
│   ├── admin/                # Paneles del backend administrativo
│   ├── menu/                 # Editores y clasificadores de carta gastronómica
│   ├── settings/             # Módulos de configuración (Cajas, Horarios, etc.)
│   └── ui/                   # Componentes visuales genéricos e interactivos
├── context/                  # Contextos globales de React (Admin UI, Carrito, Alertas, Permisos)
├── docs/                     # Documentación y scripts de despliegue local
│   └── local-setup/          # Utilidades .bat para terminales físicas
├── hooks/                    # Hooks personalizados (Sincronización Supabase/Dexie, Pedidos Híbridos)
├── lib/                      # Clientes de base de datos, constantes y manejo de errores
│   ├── supabaseClient.ts     # Cliente de Supabase para Frontend (con RLS)
│   ├── supabaseAdmin.ts      # Cliente de Supabase para Servidor (Bypassa RLS)
│   ├── constants.ts          # Constantes del negocio (Estados de pedidos, Roles, Modalidades)
│   └── errors.ts             # Manejo centralizado de excepciones y mapeador DB
├── supabase/
│   └── migrations/           # Esquemas y migraciones PostgreSQL/Supabase
└── scripts/                  # Scripts útiles de administración y base de datos
```

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Vanilla CSS, Lucide React.
- **Base de Datos & Tiempo Real:** Supabase (PostgreSQL, Realtime, Auth, Storage).
- **Base de Datos Local:** Dexie.js (Wrapper optimizado de IndexedDB).
- **Red:** Fetch APIs integradas, REST.

---

## 🔧 Configuración del Entorno de Desarrollo

### 1. Requisitos Previos
- Node.js 18 o superior instalado.
- Un proyecto de Supabase configurado.
- API Key de Google Maps (requerido para geolocalización y mapas de zonas).

### 2. Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto basándote en `.env.example`:

```env
# Credenciales Públicas de Supabase (Accesibles desde el Frontend)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key

# Credenciales de Administrador (Servidor únicamente - NUNCA exponer en Frontend)
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
SUPABASE_SECRET_KEY=tu-service-role-key # Clave alternativa usada en scripts

# Google Maps API (Requerida para geocodificación de clientes y reparto)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu-google-maps-api-key
```

### 3. Inicialización
```bash
# 1. Instalar dependencias del proyecto
npm install

# 2. Levantar el servidor Next.js de desarrollo
npm run dev
```
La aplicación estará disponible en `http://localhost:3000`.

---

## 📦 Separación de Módulos Auxiliares

### 🔌 Extensión de PedidosYa (`/pedidosya-extension/`)
Esta carpeta contiene una extensión de Chrome estática sin dependencias directas de Node.js. 
- **Función:** Extrae y automatiza la entrada de pedidos entrantes desde el portal de socios de PedidosYa y los publica en el POS del comercio.
- **Configuración local:**
  1. Abre Google Chrome e ingresa a `chrome://extensions/`.
  2. Activa el **Modo desarrollador** (esquina superior derecha).
  3. Haz clic en **Cargar descomprimida** (Load unpacked).
  4. Selecciona la carpeta `pedidosya-extension` del proyecto.
- **Separación de Repositorio:** Debido a que no posee dependencias Node y opera de forma autónoma, puede ser extraída fácilmente copiando la carpeta a un nuevo directorio independiente e inicializando un repositorio Git separado (`git init`).

### 📲 Agente de WhatsApp (`/local-agent/`)
Herramienta de escritorio empaquetada para el envío automatizado de notificaciones de WhatsApp.
- **Función:** Se comunica con el backend de Supabase y automatiza envíos de estado mediante `whatsapp-web.js`.
- **Estructura:** Contiene su propia compilación (`.exe`), dependencias (`package.json`) y configuraciones en su subdirectorio. Está configurada en `.gitignore` para omitir archivos compilados pesados en el repositorio del POS principal.

### 🛠️ Carpeta de MCPS (`/mcps/`)
Contiene integraciones personalizadas de desarrollo mediante servidores MCP (Model Context Protocol) para asistencia AI en Cursor e IDEs locales. No forma parte del bundle productivo del sistema.

---

## 🖥️ Configuración de Terminales Físicas y POS (`/docs/local-setup/`)

El sistema incluye asistentes batch (`.bat`) para facilitar la configuración en PCs y tablets locales de los comercios físicos. Se localizan en `docs/local-setup/` y corren de forma relativa a la raíz:

1. **`configurar_terminal.bat`:** Valida la versión de Node.js e instala todas las dependencias requeridas del proyecto en una terminal nueva.
2. **`INSTALAR_HUB_Y_SISTEMA.bat`:** Configura el arranque automático en Windows para el puente de impresión local (`printer-bridge.js`), crea los accesos directos al panel POS en el escritorio y expone la IP local de la máquina para que las tablets de camareros se enlacen directamente al puente.
3. **`iniciar_sistema.bat`:** Lanza de forma paralela el servidor de Next.js (`npm run dev`) y el puente de impresión de comandas térmicas (`node scripts/printer-bridge.js`), abriendo finalmente el sistema en el navegador.

---

## 📝 Normas de Refactorización y Seguridad

- **Seguridad en Supabase:** `supabaseClient.ts` debe emplearse en componentes frontend. `supabaseAdmin.ts` nunca debe importarse del lado del cliente, ya que utiliza la clave del rol de servicio (`service_role`) omitiendo por completo RLS.
- **Manejo de Errores:** Todos los endpoints de API deben encapsular sus consultas con `try/catch` y utilizar el manejador centralizado de errores `handleApiError(error)` importado de `@/lib/errors` para retornar formatos de error homogéneos y tipados.
- **Consistencia de Negocio:** Siempre que se manipulen estados de pedidos, roles o modalidades, evítense strings hardcodeados y utilícense las constantes importadas de `@/lib/constants`.
