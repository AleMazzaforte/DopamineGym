// front/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './Componentes/ProtectedRoute';
import { Layout } from './Componentes/Layout';
import { AuthProvider } from './contexts/AuthContext';

// Páginas
import DashboardPage from './pages/DashboardPage';
import AlumnosPage from './pages/AlumnosPage';
import ProfesoresPage from './pages/ProfesoresPage';
import PlanesPage from './pages/PlanesPage';
import AsistenciasPage from './pages/AsistenciasPage';
import ReportesPage from './pages/Reportespage';
import CobrosPage from './pages/CobrosPage';
import PanelAlumnoPage from './pages/PanelAlumnoPage'; 
import CajaPage from './pages/CajaPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta pública */}
          <Route path="/login" element={<LoginPage />} />

          {/* DASHBOARD: ADMIN, COLABORADOR, PROFESOR */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'COLABORADOR', 'PROFESOR']}>
                <Layout>
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* GESTIÓN DE ALUMNO: ADMIN, COLABORADOR, PROFESOR */}
          <Route
            path="/alumnos"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'COLABORADOR', 'PROFESOR']}>
                <Layout>
                  <AlumnosPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* COBROS Y CAJA: ADMIN, COLABORADOR */}
          <Route
            path="/cobros"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'COLABORADOR']}>
                <Layout>
                  <CobrosPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* PROFESORES Y STAFF: ADMIN */}
          <Route
            path="/profesores"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <Layout>
                  <ProfesoresPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* PLANES Y PRECIOS: ADMIN */}
          <Route
            path="/planes"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <Layout>
                  <PlanesPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* ASISTENCIAS: ADMIN, COLABORADOR, PROFESOR */}
          <Route
            path="/asistencias"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'COLABORADOR', 'PROFESOR']}>
                <Layout>
                  <AsistenciasPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* REPORTES: ADMIN, COLABORADOR */}
          <Route
            path="/reportes"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'COLABORADOR']}>
                <Layout>
                  <ReportesPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* PORTAL EXCLUSIVO PARA EL ALUMNO */}
          <Route
            path="/mi-panel"
            element={
              <ProtectedRoute allowedRoles={['ALUMNO']}>
                <Layout>
                  <PanelAlumnoPage />
                </Layout>
              </ProtectedRoute>
            }
          />

           {/* PORTAL PARA CAJA */}
          <Route
            path="/caja"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'COLABORADOR', 'PROFESOR']}>
                <Layout>
                  <CajaPage />
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