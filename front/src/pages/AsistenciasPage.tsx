import { useEffect, useState } from 'react';
import { type PersonaConEstado } from '../services/PersonaService';
import BuscadorAlumno from '../Componentes/utils/BuscadorAlumnos';
import { mostrarError, mostrarExito, mostrarConfirmacion } from '../lib/swal';
import asistenciaService, {
  type Asistencia,
  type AsistenciaHoy,
} from '../services/AsistenciaService';

import { formatearFechaAR, formatearHoraAR } from '../Componentes/utils/NormalizadorHorario';

export default function AsistenciasPage() {
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<PersonaConEstado | null>(null);
  const [asistenciasAlumno, setAsistenciasAlumno] = useState<Asistencia[]>([]);
  const [asistenciasHoy, setAsistenciasHoy] = useState<AsistenciaHoy[]>([]);

  const [loadingAsistencias, setLoadingAsistencias] = useState(false);
  const [loadingHoy, setLoadingHoy] = useState(false);
  const [guardandoAsistencia, setGuardandoAsistencia] = useState(false);

  useEffect(() => {
    cargarAsistenciasHoy();
  }, []);

  const cargarAsistenciasHoy = async () => {
    try {
      setLoadingHoy(true);
      const data = await asistenciaService.getHoy();
      setAsistenciasHoy(data);
    } catch (error: any) {
      console.error('Error al cargar presentes de hoy:', error);
    } finally {
      setLoadingHoy(false);
    }
  };

  const handleSeleccionarAlumno = (alumno: PersonaConEstado) => {
    setAlumnoSeleccionado(alumno);
    cargarAsistenciasAlumno(alumno.id);
  };

  const cargarAsistenciasAlumno = async (personaId: number) => {
    try {
      setLoadingAsistencias(true);
      const data = await asistenciaService.getByPersonaId(personaId);
      setAsistenciasAlumno(data);
    } catch (error: any) {
      const msg = error.response?.data?.error || 'No se pudieron cargar las asistencias';
      mostrarError('Error', msg);
    } finally {
      setLoadingAsistencias(false);
    }
  };

  // --- Reglas de bloqueo, todas del lado del front ---
  const estadoAlumno = alumnoSeleccionado?.estado ?? '';
  const estadoBloqueante =
    estadoAlumno === 'BAJA' || estadoAlumno === 'INACTIVO' || estadoAlumno === 'SIN ESTADO';

  // Si ya figura en la lista de hoy, no se deja marcar dos veces
  const presenteHoy = alumnoSeleccionado
    ? asistenciasHoy.find(a => a.persona_id === alumnoSeleccionado.id)
    : undefined;
  const yaMarcadoHoy = Boolean(presenteHoy);

  const motivoBloqueo = estadoBloqueante
    ? 'No se permite registrar asistencia a alumnos Inactivos, de Baja o sin estado'
    : yaMarcadoHoy
      ? 'Este alumno ya tiene un presente registrado hoy'
      : '';

  const handleRegistrarAsistencia = async () => {
    if (!alumnoSeleccionado) return;

    if (estadoBloqueante) {
      mostrarError(
        'Acción no permitida',
        'No se puede registrar asistencia. El alumno debe estar ACTIVO o ACTIVO PROVISORIO.'
      );
      return;
    }

    if (yaMarcadoHoy) {
      mostrarError(
        'Presente duplicado',
        `${alumnoSeleccionado.nombre} ${alumnoSeleccionado.apellido} ya fue marcado hoy a las ${formatearHoraAR(presenteHoy!.fecha_hora)} hs.`
      );
      return;
    }

    try {
      setGuardandoAsistencia(true);
      await asistenciaService.create(alumnoSeleccionado.id);

      mostrarExito(
        '¡Presente Registrado!',
        `Asistencia guardada correctamente para ${alumnoSeleccionado.nombre} ${alumnoSeleccionado.apellido}`
      );

      // Recarga la recepción y cierra la ficha individual (vuelve a la vista general)
      await cargarAsistenciasHoy();
      setAlumnoSeleccionado(null);
      setAsistenciasAlumno([]);
    } catch (error: any) {
      mostrarError('Error', error.message || 'No se pudo registrar la asistencia');
    } finally {
      setGuardandoAsistencia(false);
    }
  };

  const handleEliminarAsistencia = async (asistenciaId: number, nombreCompleto: string) => {
    const ok = await mostrarConfirmacion(
      '¿Anular presente?',
      `Se va a eliminar el ingreso de ${nombreCompleto}.`
    );
    if (!ok) return;

    try {
      await asistenciaService.delete(asistenciaId);
      mostrarExito('Asistencia anulada', 'El registro ha sido eliminado.');

      if (alumnoSeleccionado) {
        cargarAsistenciasAlumno(alumnoSeleccionado.id);
      }
      cargarAsistenciasHoy();
    } catch (error: any) {
      mostrarError('Error', error.message || 'No se pudo eliminar la asistencia');
    }
  };

  const renderDiasPreferidos = (dias: any) => {
    if (!dias) return null;
    let arreglo: string[] = [];
    if (typeof dias === 'string') {
      try {
        arreglo = JSON.parse(dias);
      } catch {
        arreglo = [dias];
      }
    } else if (Array.isArray(dias)) {
      arreglo = dias;
    }
    return arreglo.length > 0 ? arreglo.join(', ') : null;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Control de Asistencias</h1>
          <p className="text-sm text-gray-500">
            Registra el ingreso de alumnos y monitorea la recepción en vivo
          </p>
        </div>
        
      </div>

      {/* BUSCADOR DE ALUMNO */}
      <BuscadorAlumno onSeleccionar={handleSeleccionarAlumno} autoFocus />

      {/* AVISO DE FILTRO ACTIVO */}
      {alumnoSeleccionado && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-sm text-blue-800">
          <span>🔍 Viendo ficha individual del alumno buscado.</span>
          <button
            onClick={() => setAlumnoSeleccionado(null)}
            className="font-bold underline hover:text-blue-900"
          >
            Volver a la vista general de hoy ({asistenciasHoy.length})
          </button>
        </div>
      )}

      {/* MODO 1: ALUMNO SELECCIONADO (FICHA + HISTORIAL) */}
      {alumnoSeleccionado ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* COLUMNA IZQUIERDA: FICHA DEL ALUMNO */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-blue-600 space-y-4">
              <div className="flex justify-between items-start">
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
                  ✕ Cerrar
                </button>
              </div>

              {/* BADGE DE ESTADO */}
              <div>
                <span className="text-xs font-semibold uppercase text-gray-400 block mb-1">
                  Estado Actual
                </span>
                <span
                  className={`px-3 py-1.5 rounded-md text-sm font-bold inline-block w-full text-center ${
                    alumnoSeleccionado.estado === 'ACTIVO'
                      ? 'bg-green-100 text-green-800 border border-green-300'
                      : alumnoSeleccionado.estado === 'ACTIVO PROVISORIO'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : alumnoSeleccionado.estado === 'BAJA'
                          ? 'bg-red-100 text-red-800 border border-red-300'
                          : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {alumnoSeleccionado.estado || 'INACTIVO'}
                </span>
              </div>

              {/* ALERTAS DE ESTADO */}
              {alumnoSeleccionado.estado === 'ACTIVO PROVISORIO' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                  ⚠️ <strong>Alumno Provisorio:</strong> Registrar ingreso bajo promesa de pago.
                </div>
              )}

              {alumnoSeleccionado.estado === 'INACTIVO' && (
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-xs text-gray-700">
                  🛑 <strong>Alumno Inactivo:</strong> Cuota vencida o sin período activo.
                </div>
              )}

              {yaMarcadoHoy && presenteHoy && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
                  ✅ <strong>Ya marcó presente hoy</strong> a las {formatearHoraAR(presenteHoy.fecha_hora)} hs.
                  Para corregirlo, anula el ingreso desde la vista general.
                </div>
              )}

              {/* INFORMACIÓN DE PREFERENCIA DE TURNO */}
              <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1 text-gray-700 border border-gray-200">
                <p>
                  <strong>Turno Preferido:</strong>{' '}
                  <span className="font-semibold text-blue-700">
                    {alumnoSeleccionado.turno_preferido || 'VARIABLE'}
                  </span>
                </p>
                {renderDiasPreferidos(alumnoSeleccionado.dias_preferidos) && (
                  <p>
                    <strong>Días habituales:</strong>{' '}
                    {renderDiasPreferidos(alumnoSeleccionado.dias_preferidos)}
                  </p>
                )}
              </div>

              {/* DATOS DE CONTACTO */}
              <div className="space-y-1 text-sm text-gray-600 pt-2 border-t border-gray-100">
                <p>📞 {alumnoSeleccionado.telefono || 'Sin teléfono'}</p>
                {alumnoSeleccionado.contacto_emergencia && (
                  <p className="text-xs text-gray-500">
                    🚑 Emergencia: {alumnoSeleccionado.contacto_emergencia} (
                    {alumnoSeleccionado.telefono_familiar || 'S/T'})
                  </p>
                )}
              </div>

              {/* BOTÓN REGISTRAR PRESENTE */}
              <button
                onClick={handleRegistrarAsistencia}
                disabled={guardandoAsistencia || estadoBloqueante || yaMarcadoHoy}
                title={motivoBloqueo}
                className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
              >
                <span>🟢</span>
                {guardandoAsistencia
                  ? 'Registrando...'
                  : yaMarcadoHoy
                    ? 'Ya está presente hoy'
                    : 'Marcar Presente'}
              </button>
            </div>
          </div>

          {/* COLUMNA DERECHA: HISTORIAL INDIVIDUAL */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b flex justify-between items-center">
                <span>📋 Historial Personal de Asistencias</span>
                <span className="text-xs text-gray-500 font-normal">
                  Total: {asistenciasAlumno.length} ingresos
                </span>
              </h3>

              {loadingAsistencias ? (
                <div className="p-8 text-center text-gray-500">Cargando historial...</div>
              ) : asistenciasAlumno.length === 0 ? (
                <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  Este alumno no tiene asistencias registradas aún.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Hora</th>
                        <th className="px-4 py-3">Estado Ingreso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {asistenciasAlumno.map((asist) => (
                        <tr key={asist.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {formatearFechaAR(asist.fecha_hora)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatearHoraAR(asist.fecha_hora)} hs
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-full font-semibold">
                              Presente
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* MODO 2: RECEPCIÓN EN VIVO - PRESENTES DE HOY */
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b">
            <div>
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span>Recepción</span>
                <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full">
                  {asistenciasHoy.length} Asistieron hoy
                </span>
              </h3>
              <p className="text-xs text-gray-500">
                Alumnos que han ingresado al gimnasio durante el día de hoy
              </p>
            </div>
            <button
              onClick={cargarAsistenciasHoy}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 self-start sm:self-auto"
            >
              🔄 Actualizar Lista
            </button>
          </div>

          {loadingHoy ? (
            <div className="p-8 text-center text-gray-500">Cargando ingresos de hoy...</div>
          ) : asistenciasHoy.length === 0 ? (
            <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200 space-y-2">
              <div className="text-4xl">🚪</div>
              <p className="text-base font-medium text-gray-600">Aún no hay ingresos hoy</p>
              <p className="text-xs text-gray-400">
                Busca un alumno en la barra superior para registrar su presente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold border-b">
                  <tr>
                    <th className="px-4 py-3">Hora</th>
                    <th className="px-4 py-3">Alumno</th>
                    <th className="px-4 py-3">DNI</th>
                    <th className="px-4 py-3">Turno Hab.</th>
                    <th className="px-4 py-3">Estado Cuota</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {asistenciasHoy.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-blue-600">
                        {formatearHoraAR(a.fecha_hora)} hs
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {a.apellido}, {a.nombre}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{a.dni}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">
                          {a.turno_preferido || 'VARIABLE'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                            a.estado_actual === 'ACTIVO'
                              ? 'bg-green-100 text-green-800'
                              : a.estado_actual === 'ACTIVO PROVISORIO'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {a.estado_actual || 'SIN ESTADO'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() =>
                            handleEliminarAsistencia(a.id, `${a.nombre} ${a.apellido}`)
                          }
                          className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                          title="Anular presente"
                        >
                          Anular
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}