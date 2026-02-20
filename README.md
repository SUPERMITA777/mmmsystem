# MMM SYSTEM DELIVERY

Sistema POS completo en la nube para delivery, take away y salón.

## 🚀 Características Principales

- 🛒 **Pedidos**: Delivery, Take Away y Salón
- 💳 **POS**: Punto de venta completo
- 📊 **Dashboard**: Estadísticas en tiempo real
- 👥 **Clientes**: Base de datos completa
- 🍽️ **Mesas**: Control de estado
- 📦 **Productos**: Catálogo con categorías
- 🔔 **Tiempo Real**: WebSocket con Supabase Realtime
- 🔐 **Multi-usuario**: Roles y permisos
- 💰 **Cajas**: Control de transacciones
- 📱 **WhatsApp**: Integración para confirmaciones

## 🛠️ Tecnologías

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Realtime + Auth)
- **Estado**: TanStack Query (React Query)
- **Iconos**: Lucide React

## 📋 Requisitos Previos

- Node.js 18+ instalado
- Cuenta de Supabase (gratuita)
- Credenciales de Supabase configuradas en `.env`

## 🔧 Instalación

1. **Clonar e instalar dependencias**:
```bash
npm install
```

2. **Configurar variables de entorno**:
Crea un archivo `.env` en la raíz del proyecto con:
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
SUPABASE_SECRET_KEY=tu_secret_key
```

3. **Configurar la base de datos**:
   - Ve a [Supabase Dashboard](https://supabase.com/dashboard)
   - Selecciona tu proyecto
   - Ve a **SQL Editor**
   - Ejecuta los archivos en `supabase/migrations/` en orden:
     - `001_initial_schema.sql` - Crea todas las tablas
     - `002_rls_policies.sql` - Configura Row Level Security

4. **Iniciar el servidor de desarrollo**:
```bash
npm run dev
```

5. **Abrir en el navegador**:
```
http://localhost:3000
```

## 📁 Estructura del Proyecto

```
├── app/                    # Next.js App Router
│   ├── admin/             # Panel de administración
│   │   ├── settings/      # Configuraciones
│   │   ├── menu/          # Gestión de menú
│   │   └── panel-pedidos/ # Panel de pedidos
│   └── page.tsx           # Landing page
├── components/
│   ├── admin/             # Componentes del admin
│   ├── settings/          # Componentes de configuraciones
│   └── ui/                # Componentes UI reutilizables
├── lib/
│   ├── supabaseClient.ts  # Cliente público de Supabase
│   └── supabaseAdmin.ts   # Cliente administrativo
├── supabase/
│   └── migrations/        # Migraciones SQL
└── scripts/               # Scripts de utilidad
```

## 🗄️ Esquema de Base de Datos

El sistema incluye las siguientes tablas principales:

- **sucursales** - Información de locales/sucursales
- **usuarios** - Usuarios del sistema con roles
- **productos** - Catálogo de productos
- **categorias** - Categorías de productos
- **pedidos** - Pedidos del sistema
- **pedido_items** - Items de cada pedido
- **clientes** - Base de datos de clientes
- **mesas** - Mesas para salón
- **cajas** - Control de cajas y transacciones
- **metodos_pago** - Métodos de pago disponibles
- **zonas_entrega** - Zonas de delivery
- **repartidores** - Repartidores
- **config_sucursal** - Configuración por sucursal
- **horarios_sucursal** - Horarios de atención
- **ingredientes** - Materia prima
- **recetas** - Recetas de productos
- **movimientos_stock** - Movimientos de inventario
- **descuentos** - Promociones y descuentos

Ver `supabase/migrations/001_initial_schema.sql` para el esquema completo.

## 🔐 Seguridad

- **Row Level Security (RLS)** habilitado en todas las tablas
- Cliente público (`supabaseClient.ts`) respeta RLS
- Cliente administrativo (`supabaseAdmin.ts`) solo para servidor
- Variables de entorno privadas protegidas

## 📝 Uso de los Clientes de Supabase

### Cliente Público (Frontend)
```typescript
import { supabase } from "@/lib/supabaseClient";

// Usar en Client Components, Server Components, API Routes
const { data } = await supabase.from('productos').select('*');
```

### Cliente Administrativo (Backend)
```typescript
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// SOLO usar en Server Components, API Routes, Server Actions
const { data } = await supabaseAdmin.from('usuarios').select('*');
```

Ver `lib/README.md` para más detalles.

## 🎨 Página de Configuraciones

La página `/admin/settings` incluye tabs para:

- **Modalidades**: Activar/desactivar Delivery, Take Away, Salón
- **Pedidos**: Configuración de pedidos, notificaciones, montos mínimos
- **Horarios**: Horarios de atención por día de la semana
- **Métodos de Pago**: Gestionar métodos de pago disponibles
- **Zonas de Entrega**: (Próximamente)
- **WhatsApp**: (Próximamente)
- **Facturación**: (Próximamente)

## 🚧 Próximas Funcionalidades

- [ ] Panel de pedidos en tiempo real
- [ ] Gestión completa de menú
- [ ] Control de inventario
- [ ] Dashboard con estadísticas
- [ ] Integración con WhatsApp
- [ ] Facturación electrónica (ARCA/AFIP)
- [ ] Integraciones con PedidosYa, Rappi, etc.
- [ ] Monitor de cocina (KDS)
- [ ] Sistema de reportes

## 📚 Scripts Disponibles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Compilar para producción
npm run start    # Servidor de producción
npm run lint     # Ejecutar ESLint
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y de uso interno.

## 🆘 Soporte

Para problemas o preguntas, contacta al equipo de desarrollo.

## 🚀 Despliegue en Vercel

Este proyecto está optimizado para desplegarse en [Vercel](https://vercel.com). Sigue estos pasos:

### 1. Preparar GitHub
Si aún no lo has hecho, inicializa git y sube el código a tu repositorio:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/SUPERMITA777/mmmsystem
git push -u origin main
```

### 2. Importar a Vercel
1. Ve a [Vercel](https://vercel.com/new).
2. Importa tu repositorio de GitHub.
3. En la sección **Environment Variables**, agrega las siguientes (usa los valores de tu `.env`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_SECRET_KEY`

### 3. Deploy
Haz clic en **Deploy**. Vercel detectará automáticamente que es un proyecto de Next.js y realizará el build.

---

**Desarrollado con ❤️ para MMM SYSTEM**
