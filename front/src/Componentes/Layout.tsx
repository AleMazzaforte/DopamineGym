import { Link, useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

// Define la estructura de navegación del sistema
const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/alumnos', label: 'Alumnos', icon: '👥' },
  { path: '/cobros', label: 'Cobros', icon: '💵' },
  { path: '/profesores', label: 'Profesores', icon: '🏋️' },
  { path: '/planes', label: 'Planes', icon: '💳' },
  { path: '/asistencias', label: 'Asistencias', icon: '✅' },
  { path: '/pagos', label: 'Pagos', icon: '💰' },
  { path: '/reportes', label: 'Reportes', icon: '📈' },
  { path: '/caja', label: 'Caja', icon: '🏪' },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Determina el título de la página actual para mostrarlo en el header
  const currentRoute = menuItems.find((item) => item.path === location.pathname);
  const pageTitle = currentRoute ? currentRoute.label : 'Panel';

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: '¿Cerrar sesión?',
      text: 'Vas a salir del sistema',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      // Aquí se integrará la lógica de limpieza de tokens/estado de autenticación
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Contenedor lateral de navegación */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col" aria-label="Menú principal">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold">🏋️ Dopamine Gym</h1>
          <p className="text-xs text-gray-400 mt-1">Sistema de gestión</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                // aria-current indica a los lectores de pantalla cuál es la página activa
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <span className="text-lg" aria-hidden="true">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sección de información del usuario y cierre de sesión */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold" aria-hidden="true">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Administrador</p>
              <p className="text-xs text-gray-400">admin@dopamine.com</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Cerrar sesión del sistema"
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenedor principal de la aplicación */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              {pageTitle}
            </h2>
            <time className="text-sm text-gray-500 capitalize">
              {new Date().toLocaleDateString('es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}