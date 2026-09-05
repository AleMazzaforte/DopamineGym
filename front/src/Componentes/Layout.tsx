
import { Link, useLocation, useNavigate } from 'react-router-dom';
//import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

// Definimos los items del menú
const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/alumnos', label: 'Alumnos', icon: '👥' },
  { path: '/profesores', label: 'Profesores', icon: '🏋️' },
  { path: '/planes', label: 'Planes', icon: '💳' },
  { path: '/asistencias', label: 'Asistencias', icon: '✅' },
  { path: '/pagos', label: 'Pagos', icon: '💰' },
  { path: '/reportes', label: 'Reportes', icon: '📈' },
];

export default function Layout({ children }: LayoutProps) {
  // const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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
      // // await signOut();
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* ========== SIDEBAR ========== */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold">🏋️ Dopamine Gym</h1>
          <p className="text-xs text-gray-400 mt-1">Sistema de gestión</p>
        </div>

        {/* Menú de navegación */}
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Info del usuario */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold">
              
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">John Doe</p>
              <p className="text-xs text-gray-400">Administrador</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ========== CONTENIDO PRINCIPAL ========== */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              {menuItems.find((item) => item.path === location.pathname)?.label || 'Panel'}
            </h2>
            <div className="text-sm text-gray-500">
              {new Date().toLocaleDateString('es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </header>

        {/* Contenido de la página */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
export {Layout};