// front/src/pages/PanelAlumnoPage.tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface Periodo {
  id: number;
  fecha_inicio: string;
  fecha_vencimiento: string;
  estado: string;
  plan_nombre?: string;
}

interface Asistencia {
  id: number;
  fecha_hora: string;
}

interface Cobro {
  id: number;
  fecha_cobro: string;
  monto: number;
  metodo_pago: string;
  concepto?: string;
}

export default function PanelAlumnoPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [periodoActivo, setPeriodoActivo] = useState<Periodo | null>(null);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [historialCobros, setHistorialCobros] = useState<Cobro[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user?.persona_id) {
      cargarDatosAlumno(user.persona_id);
    }
  }, [user]);

  const cargarDatosAlumno = async (personaId: number) => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // Ejecutamos las peticiones permitidas para el alumno en paralelo
      const [resPeriodo, resSaldo, resAsistencias, resCobros] = await Promise.allSettled([
        api.get(`/periodos/activo/${personaId}`),
        api.get(`/alumnos/${personaId}/saldo`),
        api.get(`/asistencias/persona/${personaId}`),
        api.get(`/cobros/persona/${personaId}`),
      ]);

      if (resPeriodo.status === 'fulfilled') setPeriodoActivo(resPeriodo.value);
      if (resSaldo.status === 'fulfilled') setSaldo(resSaldo.value?.saldo ?? 0);
      if (resAsistencias.status === 'fulfilled') setAsistencias(resAsistencias.value || []);
      if (resCobros.status === 'fulfilled') setHistorialCobros(resCobros.value || []);
    } catch (err: any) {
      console.error('Error al cargar datos del alumno:', err);
      setErrorMsg('Ocurrió un error al cargar la información de tu cuenta.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 font-medium">Cargando tu información...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* CABECERA / SALUDO */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            ¡Hola, {user?.nombre} {user?.apellido}! 👋
          </h1>
          <p className="text-blue-100 text-sm mt-1">
            Bienvenido a tu portal personal. Aquí puedes consultar el estado de tu suscripción y asistencias.
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider text-blue-100 border border-white/20">
          Rol: Alumno
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}

      {/* TARJETAS RESUMEN DE ESTADO DE CUOTA Y SALDO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PERÍODO / SUSCRIPCIÓN ACTIVA */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <span>📅</span> Estado de Tu Cuota
            </h2>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                periodoActivo?.estado === 'ACTIVO'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {periodoActivo?.estado || 'SIN PERÍODO ACTIVO'}
            </span>
          </div>

          {periodoActivo ? (
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <strong>Plan:</strong>{' '}
                <span className="text-gray-800 font-semibold">
                  {periodoActivo.plan_nombre || 'Pase Regular'}
                </span>
              </p>
              <p>
                <strong>Fecha de Inicio:</strong>{' '}
                {new Date(periodoActivo.fecha_inicio).toLocaleDateString('es-AR')}
              </p>
              <p>
                <strong>Vencimiento:</strong>{' '}
                <span className="text-blue-600 font-bold">
                  {new Date(periodoActivo.fecha_vencimiento).toLocaleDateString('es-AR')}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">
              No registras un período de membresía activo en este momento. Consulta en recepción para renovar.
            </p>
          )}
        </div>

        {/* BALANCE Y SALDO */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <span>💳</span> Saldo de Cuenta
            </h2>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase font-semibold">Balance Actual</p>
            <div className="text-3xl font-extrabold text-gray-800">
              ${saldo !== null ? saldo.toLocaleString('es-AR') : '0'}
            </div>
            <p className="text-xs text-gray-400">
              {saldo && saldo < 0
                ? '⚠️ Tienes un saldo pendiente de pago.'
                : 'Al día con la administración.'}
            </p>
          </div>
        </div>
      </div>

      {/* SECCIÓN DE HISTORIALES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TABLA DE ASISTENCIAS */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <span>💪</span> Mis Entrenamientos ({asistencias.length})
            </h3>
          </div>

          {asistencias.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400 bg-gray-50 rounded-lg border border-dashed">
              Aún no registras ingresos al gimnasio.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {asistencias.map((asist) => {
                    const fecha = new Date(asist.fecha_hora);
                    return (
                      <tr key={asist.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {fecha.toLocaleDateString('es-AR')}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TABLA DE COBROS / PAGOS */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <span>🧾</span> Historial de Pagos ({historialCobros.length})
            </h3>
          </div>

          {historialCobros.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400 bg-gray-50 rounded-lg border border-dashed">
              No hay pagos registrados.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Método</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historialCobros.map((cobro) => (
                    <tr key={cobro.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-800 font-medium">
                        {new Date(cobro.fecha_cobro).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 uppercase">
                        {cobro.metodo_pago}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-green-700">
                        ${cobro.monto.toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN DE RUTINAS (PLACEHOLDER FUTURO) */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-base font-bold text-indigo-900 flex items-center justify-center sm:justify-start gap-2">
            <span>🏋️‍♂️</span> Mis Rutinas Personalizadas
          </h3>
          <p className="text-xs text-indigo-700">
            Próximamente podrás consultar tus rutinas diarias y seguimiento de ejercicios directamente desde esta sección.
          </p>
        </div>
        <button
          disabled
          className="px-4 py-2 bg-indigo-200 text-indigo-500 rounded-lg text-xs font-semibold cursor-not-allowed whitespace-nowrap"
        >
          Próximamente
        </button>
      </div>
    </div>
  );
}