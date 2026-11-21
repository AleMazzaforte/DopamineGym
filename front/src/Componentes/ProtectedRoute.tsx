// front/src/Componentes/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type React from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        Cargando sesión...
      </div>
    );
  }

  // 1. Si no está autenticado -> al Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 2. Si hay restricción de roles y el rol del usuario no está permitido
  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    // Redirección segura según el rol actual del usuario
    if (user.rol === 'ALUMNO') {
      return <Navigate to="/mi-panel" replace />;
    }
    return <Navigate to="/asistencias" replace />;
  }

  return children;
}