🏋️ Dopamine Gym - Sistema de Gestión
Sistema de gestión integral para gimnasios desarrollado con React + TypeScript + Supabase.
Tabla de Contenidos
Características
Tecnologías
Instalación
Configuración
Estructura del Proyecto
Funcionalidades Implementadas
Base de Datos
Próximos Pasos
✨ Características
✅ Autenticación segura con Supabase Auth
✅ Gestión de Alumnos: Alta, edición, búsqueda y baja
✅ Gestión de Planes: Creación de planes personalizados
✅ Registro de Cobros: Con generación automática de períodos y coberturas
✅ Control de Acceso: Rutas protegidas por autenticación
✅ Diseño Responsive: Interfaz moderna con Tailwind CSS
✅ Multi-tenant Ready: Preparado para vender a múltiples gimnasios
🛠 Tecnologías
Frontend
React 18 con TypeScript
Vite como bundler
Tailwind CSS v4 para estilos
React Router para navegación
SweetAlert2 para notificaciones
React Hook Form + Zod para validación de formularios
Backend
Supabase (PostgreSQL + Auth + Realtime)
Row Level Security (RLS) desactivado para desarrollo

Estructura del Proyecto

front/
├── src/
│   ├── components/
│   │   ├── Layout.tsx              # Layout principal con Sidebar
│   │   └── ProtectedRoute.tsx      # Protección de rutas
│   ├── contexts/
│   │   └── AuthContext.tsx         # Contexto de autenticación
│   ├── lib/
│   │   └── supabase.ts             # Configuración de Supabase
│   ├── pages/
│   │   ├── LoginPage.tsx           # Login
│   │   ├── DashboardPage.tsx       # Dashboard principal
│   │   ├── AlumnosPage.tsx         # CRUD de Alumnos + Cobros
│   │   ├── ProfesoresPage.tsx      # (Placeholder)
│   │   ├── PlanesPage.tsx          # CRUD de Planes
│   │   ├── AsistenciasPage.tsx     # (Placeholder)
│   │   ├── PagosPage.tsx           # (Placeholder)
│   │   └── ReportesPage.tsx        # (Placeholder)
│   ├── services/
│   │   ├── personaService.ts       # Operaciones de Personas
│   │   ├── planService.ts          # Operaciones de Planes
│   │   └── periodoService.ts       # Operaciones de Períodos/Pagos/Bajas
│   ├── App.tsx                     # Configuración de rutas
│   ├── main.tsx                    # Punto de entrada
│   └── index.css                   # Estilos globales (Tailwind)
├── .env                            # Variables de entorno (NO subir a Git)
├── vite.config.ts                  # Configuración de Vite + Tailwind v4
└── package.json