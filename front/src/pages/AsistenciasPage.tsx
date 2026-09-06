// AsistenciasPage.tsx

import { useState } from 'react';
import { type PersonaConEstado } from '../services/PersonaService';
import BuscadorAlumno from '../Componentes/utils/BuscadorAlumnos';
import { mostrarError, mostrarExito } from '../lib/swal';
import asistenciaService, { type Asistencia } from '../services/AsistenciaService';


export default function AsistenciasPage() {
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<PersonaConEstado | null>(null);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  
  const [loadingAsistencias, setLoadingAsistencias] = useState(false);
  const [guardandoAsistencia, setGuardandoAsistencia] = useState(false);

  // Seleccionar alumno y cargar su historial de asistencias
  const handleSeleccionarAlumno = (alumno: PersonaConEstado) => {
    setAlumnoSeleccionado(alumno);
    cargarAsistenciasAlumno(alumno.id);
  };

  // Cargar historial de asistencias del alumno
  const cargarAsistenciasAlumno = async (personaId: number) => {
    try {
      setLoadingAsistencias(true);
      const data = await asistenciaService.getByPersonaId(personaId);
      setAsistencias(data);
    } catch (error: any) {
      const msg = error.response?.data?.error || 'No se pudieron cargar las asistencias';
      mostrarError('Error', msg);
    } finally {
      setLoadingAsistencias(false);
    }
  };

  // Registrar asistencia
  const handleRegistrarAsistencia = async () => {
    if (!alumnoSeleccionado) return;

    try {
      setGuardandoAsistencia(true);
      await asistenciaService.create(alumnoSeleccionado.id);
      
      mostrarExito('¡Asistencia registrada!', `Presente marcado para ${alumnoSeleccionado.nombre}`);
      await cargarAsistenciasAlumno(alumnoSeleccionado.id);
    } catch (error: any) {
      mostrarError('Error', error.message || 'No se pudo registrar la asistencia');
    } finally {
      setGuardandoAsistencia(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Control de Asistencias</h1>
          <p className="text-sm text-gray-500">Busca un alumno para registrar su ingreso diario</p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold border border-blue-200 self-start sm:self-auto">
          📅 {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Buscador Reutilizable */}
      <BuscadorAlumno 
        onSeleccionar={handleSeleccionarAlumno} 
        autoFocus
      />

{/* AVISO DE FILTRO ACTIVO */}
      {alumnoSeleccionado && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-sm text-blue-800">
          <span>🔍 Mostrando resultado individual de la búsqueda.</span>
          <button
            onClick={() => setAlumnoSeleccionado(null)}
            className="font-bold underline hover:text-blue-900 ml-2"
          >
            Volver a la lista completa
          </button>
        </div>
      )}

      {/* PANEL PRINCIPAL: FICHA DEL ALUMNO + HISTORIAL */}
      {alumnoSeleccionado ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUMNA IZQUIERDA: TARJETA DEL ALUMNO Y ACCIÓN RÁPIDA */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-blue-600">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {alumnoSeleccionado.apellido}, {alumnoSeleccionado.nombre}
                  </h2>
                  <p className="text-sm text-gray-500">DNI: {alumnoSeleccionado.dni}</p>
                </div>
                <button 
                  onClick={() => setAlumnoSeleccionado(null)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                >
                  Cambiar ✕
                </button>
              </div>

              {/* BADGE DE ESTADO */}
              <div className="mb-4">
                <span className="text-xs font-semibold uppercase text-gray-400 block mb-1">Estado Actual</span>
                <span className={`px-3 py-1.5 rounded-md text-sm font-bold inline-block w-full text-center ${
                  alumnoSeleccionado.estado === 'ACTIVO' ? 'bg-green-100 text-green-800 border border-green-300' :
                  alumnoSeleccionado.estado === 'ACTIVO PROVISORIO' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                  alumnoSeleccionado.estado === 'BAJA' ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-gray-100 text-gray-800'
                }`}>
                  {alumnoSeleccionado.estado || 'INACTIVO'}
                </span>
              </div>

              {/* ALERTA EN CASO DE ESTADO PROVISORIO O INACTIVO */}
              {alumnoSeleccionado.estado === 'ACTIVO PROVISORIO' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 mb-4">
                  ⚠️ <strong>Alumno Provisorio:</strong> Registrar ingreso con compromiso de pago.
                </div>
              )}

              {alumnoSeleccionado.estado === 'INACTIVO' && (
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-xs text-gray-700 mb-4">
                  🛑 <strong>Alumno Inactivo:</strong> Se recomienda regularizar la cuota.
                </div>
              )}

              {/* DATOS DE CONTACTO RÁPIDOS */}
              <div className="space-y-2 text-sm text-gray-600 pt-2 border-t border-gray-100 mb-6">
                <p>📞 <span className="font-medium">{alumnoSeleccionado.telefono || 'Sin teléfono'}</span></p>
                {alumnoSeleccionado.contacto_emergencia && (
                  <p>🚑 Emergencia: <span className="font-medium">{alumnoSeleccionado.contacto_emergencia} ({alumnoSeleccionado.telefono_familiar || 'S/T'})</span></p>
                )}
              </div>

              {/* BOTÓN PRINCIPAL MARCAR PRESENTE */}
              <button
                onClick={handleRegistrarAsistencia}
                disabled={guardandoAsistencia || alumnoSeleccionado.estado === 'BAJA'}
                className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
              >
                <span>🟢</span>
                {guardandoAsistencia ? 'Registrando...' : 'Marcar Presente'}
              </button>
            </div>
          </div>

          {/* COLUMNA DERECHA: HISTORIAL / GRILLA DE ASISTENCIAS */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center justify-between border-b pb-2">
                <span>📋 Historial de Asistencias</span>
                <span className="text-xs font-normal text-gray-500">Últimos registros</span>
              </h3>

              {loadingAsistencias ? (
                <div className="p-8 text-center text-gray-500">Cargando historial de asistencias...</div>
              ) : asistencias.length === 0 ? (
                <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  Sin asistencias registradas aún. Haz clic en "Marcar Presente" para guardar el ingreso de hoy.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                      <tr>
                        <th className="px-4 py-2">Fecha</th>
                        <th className="px-4 py-2">Hora</th>
                        <th className="px-4 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {asistencias.map((asist) => {
                        const fechaObj = new Date(asist.fecha_hora);
                        return (
                          <tr key={asist.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {fechaObj.toLocaleDateString('es-AR')}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                            </td>
                            <td className="px-4 py-3">
                              <span className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded font-medium border border-green-200">
                                Presente
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      ) : (
        /* PANTALLA VACÍA / INICIAL CUANDO NO HAY SELECCIÓN */
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <div className="text-5xl mb-3">🔍</div>
          <p className="text-lg font-medium text-gray-600">No hay ningún alumno seleccionado</p>
          <p className="text-sm text-gray-400 mt-1">Utiliza la barra de búsqueda superior para encontrar al alumno por DNI o Nombre.</p>
        </div>
      )}
    </div>
  );
}