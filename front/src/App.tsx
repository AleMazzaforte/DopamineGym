import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './Componentes/ProtectedRoute';
import { Layout } from "./Componentes/Layout";


// Páginas
import DashboardPage from './pages/DashboardPage';
import AlumnosPage from './pages/AlumnosPage';
import ProfesoresPage from './pages/ProfesoresPage';
import PlanesPage from './pages/PlanesPage';
import AsistenciasPage from './pages/AsistenciasPage';
import ReportesPage from './pages/Reportespage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta pública: Login */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rutas protegidas con Layout */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/alumnos"
            element={
              <ProtectedRoute>
                <Layout>
                  <AlumnosPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profesores"
            element={
              <ProtectedRoute>
                <Layout>
                  <ProfesoresPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/planes"
            element={
              <ProtectedRoute>
                <Layout>
                  <PlanesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/asistencias"
            element={
              <ProtectedRoute>
                <Layout>
                  <AsistenciasPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/reportes"
            element={
              <ProtectedRoute>
                <Layout>
                  <ReportesPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Redirección por defecto */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;