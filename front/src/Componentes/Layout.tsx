import { Link, useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import type { ReactNode } from 'react';
import { CajaProvider, useCajaGlobal } from '../contexts/CajaContext';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

type Rol = 'ADMIN' | 'COLABORADOR' | 'PROFESOR' | 'ALUMNO';

const menuItems: { path: string; label: string; icon: string; roles: Rol[] }[] = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['ADMIN', 'COLABORADOR', 'PROFESOR'] },
  { path: '/alumnos', label: 'Alumnos', icon: '👥', roles: ['ADMIN', 'COLABORADOR', 'PROFESOR'] },
  { path: '/cobros', label: 'Cobros', icon: '💵', roles: ['ADMIN', 'COLABORADOR'] },
  { path: '/profesores', label: 'Profesores', icon: '🏋️', roles: ['ADMIN'] },
  { path: '/planes', label: 'Planes', icon: '💳', roles: ['ADMIN'] },
  { path: '/asistencias', label: 'Asistencias', icon: '✅', roles: ['ADMIN', 'COLABORADOR', 'PROFESOR'] },
  { path: '/reportes', label: 'Reportes', icon: '📈', roles: ['ADMIN', 'COLABORADOR'] },
  { path: '/caja', label: 'Caja', icon: '🏪', roles: ['ADMIN', 'COLABORADOR', 'PROFESOR'] },
  { path: '/mi-panel', label: 'Mi Panel', icon: '🎽', roles: ['ALUMNO'] },
];

const ETIQUETA_ROL: Record<string, string> = {
  ADMIN: 'Administrador',
  COLABORADOR: 'Colaborador',
  PROFESOR: 'Profesor',
  ALUMNO: 'Alumno',
};

function EstadoCajaBadge() {
  const { isCajaAbierta, cargandoEstado } = useCajaGlobal();

  if (cargandoEstado) {
    return (
      <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-500">
        Verificando caja…
      </span>
    );
  }

  return (
    <Link
      to="/caja"
      className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
        isCajaAbierta
          ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
          : 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
      }`}
      title={isCajaAbierta ? 'La caja está abierta' : 'La caja está cerrada. Hacé clic para abrirla.'}
    >
      {isCajaAbierta ? '🟢 Caja abierta' : '🔴 Caja cerrada'}
    </Link>
  );
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const rol = (user?.rol ?? '') as Rol;
  const esAlumno = rol === 'ALUMNO';
  const items = menuItems.filter((i) => i.roles.includes(rol));
  const currentRoute = items.find((i) => i.path === location.pathname);
  const pageTitle = currentRoute ? currentRoute.label : 'Panel';

  const iniciales = `${user?.nombre?.[0] ?? ''}${user?.apellido?.[0] ?? ''}`.toUpperCase() || 'U';

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
      logout();
      navigate('/login');
    }
  };

  const contenido = (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-gray-900 text-white flex flex-col" aria-label="Menú principal">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold">🏋️ Dopamine Gym</h1>
          <p className="text-xs text-gray-400 mt-1">Sistema de gestión</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {items.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="text-lg" aria-hidden="true">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold" aria-hidden="true">
              {iniciales}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user ? `${user.nombre} ${user.apellido}` : 'Usuario'}
              </p>
              <p className="text-xs text-gray-400">{ETIQUETA_ROL[rol] ?? rol}</p>
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

      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-gray-800">{pageTitle}</h2>
            <div className="flex items-center gap-4" aria-live="polite">
              {!esAlumno && <EstadoCajaBadge />}
              <time className="text-sm text-gray-500 capitalize hidden sm:block">
                {new Date().toLocaleDateString('es-AR', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </time>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto" role="main">
          {children}
        </main>
      </div>
    </div>
  );

  // El alumno no necesita el estado de caja: no montamos el provider ni el badge.
  return esAlumno ? contenido : <CajaProvider>{contenido}</CajaProvider>;
}