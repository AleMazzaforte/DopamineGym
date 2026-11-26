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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    if (user.rol === 'ALUMNO') {
      return <Navigate to="/mi-panel" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}