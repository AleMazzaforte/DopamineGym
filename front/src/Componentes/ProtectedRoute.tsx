import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import React from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600 text-lg font-medium">Cargando sesión...</p>
      </div>
    );
  }

  // Si no hay usuario en el contexto, lo mandamos al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}