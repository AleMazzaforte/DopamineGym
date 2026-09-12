// CobrosPage.tsx

import { useEffect, useState } from 'react';
import cobroService, { type CobroConAlumno } from '../services/CobroService';
import { type MetodoCobro } from '../services/periodoService';
import { type PersonaConEstado } from '../services/PersonaService';
import BuscadorAlumno from '../Componentes/utils/BuscadorAlumnos';
import ModalCobro from '../Componentes/cobros/ModalCobros';
import { mostrarConfirmacion, mostrarError, mostrarExito } from '../lib/swal';

// Helper para formatear fechas a YYYY-MM-DD respetando zona horaria local
const formatearFechaISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function CobrosPage() {
  const [cobros, setCobros] = useState<CobroConAlumno[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [fechaDesde, setFechaDesde] = useState(() => {
    const hoy = new Date();
    return formatearFechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  });
  const [fechaHasta, setFechaHasta] = useState(() => formatearFechaISO(new Date()));
  const [metodoFiltro, setMetodoFiltro] = useState<MetodoCobro | 'TODOS'>('TODOS');
  const [alumnoFiltro, setAlumnoFiltro] = useState<PersonaConEstado | null>(null);
  const [verBajas, setVerBajas] = useState(false);
  const [buscadorKey, setBuscadorKey] = useState(0);

  // Modales y estados de cobro
  const [modalCobroOpen, setModalCobroOpen] = useState(false);
  const [cobroEditando, setCobroEditando] = useState<CobroConAlumno | null>(null);
  const [alumnoCobrando, setAlumnoCobrando] = useState<PersonaConEstado | null>(null);

  // Cargar Cobros desde Backend
  const cargarCobros = async () => {
    try {
      setLoading(true);
      const datos: CobroConAlumno[] = await cobroService.getAll();
      setCobros(datos);
    } catch (error: any) {
      mostrarError('Error', error.message || 'No se pudieron cargar los cobros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCobros();
  }, []);

  // Manejadores de Alumno
  const handleSeleccionarAlumno = (alumno: PersonaConEstado) => {
    setAlumnoFiltro(alumno);

    // Ajustar fechas a 6 meses atrás desde hoy
    const hoy = new Date();
    const hace6Meses = new Date(hoy.getFullYear(), hoy.getMonth() - 6, hoy.getDate());

    setFechaDesde(formatearFechaISO(hace6Meses));
    setFechaHasta(formatearFechaISO(hoy));
  };
  
  const handleLimpiarFiltroAlumno = () => {
    setAlumnoFiltro(null);
    setBuscadorKey((prev) => prev + 1);

    // Restablecer rango por defecto (mes actual)
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    setFechaDesde(formatearFechaISO(inicioMes));
    setFechaHasta(formatearFechaISO(hoy));
  };

  // FILTRADO LOCAL
  const cobrosFiltrados = (() => {
    let lista = cobros.filter((cobro) => {
      if (metodoFiltro !== 'TODOS' && cobro.metodo_cobro !== metodoFiltro) {
        return false;
      }
      return true;
    });

    if (alumnoFiltro) {
      return lista.filter((cobro) => {
        const personaIdCobro = cobro.persona_id || cobro.periodo_alumno?.persona_id;
        return personaIdCobro === alumnoFiltro.id;
      });
    }

    const cobrosOrdenados = [...lista].sort((a, b) => {
      const fechaA = new Date(a.fecha_cobro).getTime();
      const fechaB = new Date(b.fecha_cobro).getTime();
      if (fechaB !== fechaA) return fechaB - fechaA;
      return b.id - a.id;
    });

    const ultimosCobrosMap = new Map<number, CobroConAlumno>();

    for (const cobro of cobrosOrdenados) {
      const personaId = cobro.persona_id || cobro.periodo_alumno?.persona_id;

      if (personaId && !ultimosCobrosMap.has(personaId)) {
        const estaActivo =
          (cobro as any).persona_activo ??
          (cobro.periodo_alumno?.persona as { activo?: boolean } | undefined)?.activo ??
          true;

        if (verBajas || estaActivo) {
          ultimosCobrosMap.set(personaId, cobro);
        }
      }
    }

    return Array.from(ultimosCobrosMap.values());
  })();

  // Arqueo de Caja
  const totalRecaudado = cobrosFiltrados.reduce((acc, item) => acc + Number(item.monto || 0), 0);
  const totalEfectivo = cobrosFiltrados
    .filter((c) => c.metodo_cobro === 'efectivo')
    .reduce((acc, item) => acc + Number(item.monto || 0), 0);
  const totalTransferencia = cobrosFiltrados
    .filter((c) => c.metodo_cobro === 'transferencia')
    .reduce((acc, item) => acc + Number(item.monto || 0), 0);

  // Handlers CRUD
  const handleNuevoCobro = () => {
    setAlumnoCobrando(alumnoFiltro);
    setModalCobroOpen(true);
    setCobroEditando(null);
   
  };

  const handleEditarCobro = (cobro: CobroConAlumno) => {
    setCobroEditando(cobro);
    setAlumnoCobrando(null);
    setModalCobroOpen(true);
  };

  const handleEliminarCobro = async (cobro: CobroConAlumno) => {
    const confirmado = await mostrarConfirmacion(
      '¿Anular Cobro?',
      'Esta acción eliminará el registro de cobro y dará de baja el período asociado si corresponde.'
    );

    if (!confirmado) return;

    try {
      await cobroService.delete(cobro.id);
      mostrarExito('Cobro anulado', 'El registro ha sido eliminado correctamente');
      cargarCobros();
    } catch (error: any) {
      mostrarError('Error al anular', error.message || 'No se pudo eliminar el cobro');
    }
  };

  // Helpers
  const getNombreAlumno = (c: CobroConAlumno) => {
    if (c.nombre || c.apellido) return `${c.apellido || ''}, ${c.nombre || ''}`;
    if (c.periodo_alumno?.persona) {
      return `${c.periodo_alumno.persona.apellido}, ${c.periodo_alumno.persona.nombre}`;
    }
    return 'Alumno Desconocido';
  };

  const getDniAlumno = (c: CobroConAlumno) => {
    return c.dni || c.periodo_alumno?.persona?.dni || 'S/D';
  };

  const getNombrePlan = (c: CobroConAlumno) => {
    return c.plan_nombre || c.descripcion || 'Sin especificación';
  };

  return (
    <div className="space-y-6">
      {/* CABECERA */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Caja y Cobros</h1>
          <p className="text-sm text-gray-500">
            {alumnoFiltro
              ? `Historial completo de pagos de ${alumnoFiltro.nombre} ${alumnoFiltro.apellido}`
              : 'Último cobro registrado de cada alumno'}
          </p>
        </div>
                <button
          onClick={handleNuevoCobro}
            disabled={!alumnoFiltro} // 👈 CAMBIO CLAVE: Se deshabilita si no hay alumno seleccionado
            title={!alumnoFiltro ? "Debes seleccionar un alumno en el buscador primero" : ""}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow transition-colors ${
              !alumnoFiltro 
                ? "bg-gray-300 text-gray-500 cursor-not-allowed" // Estilo deshabilitado
                : "bg-green-600 hover:bg-green-700 text-white"   // Estilo habilitado
            }`
          }
        >
          💰 Registrar Nuevo Cobro
        </button>
      </div>

      {/* TARJETAS DE ARQUEO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-xs font-semibold text-gray-500 uppercase">Total Recaudado</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            ${totalRecaudado.toLocaleString('es-AR')}
          </p>
          <p className="text-xs text-gray-400 mt-1">{cobrosFiltrados.length} pagos listados</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-xs font-semibold text-gray-500 uppercase">Efectivo en Caja</p>
          <p className="text-2xl font-extrabold text-blue-700 mt-1">
            ${totalEfectivo.toLocaleString('es-AR')}
          </p>
          <p className="text-xs text-gray-400 mt-1">Cobros presenciales</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-xs font-semibold text-gray-500 uppercase">Transferencias / Digital</p>
          <p className="text-2xl font-extrabold text-purple-700 mt-1">
            ${totalTransferencia.toLocaleString('es-AR')}
          </p>
          <p className="text-xs text-gray-400 mt-1">Pagos bancarios / MP</p>
        </div>
      </div>

      {/* FILTROS DE BÚSQUEDA */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-col sm:flex-row gap-4 ">
        <div className="w-full md:w-2/3">
          <BuscadorAlumno
            key={buscadorKey}
            onSeleccionar={handleSeleccionarAlumno}
            mostrarFiltroBajas={true}
            verBajas={verBajas}
            onVerBajasChange={(checked) => setVerBajas(checked)}
          />
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        {alumnoFiltro && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 text-sm">
            <span className="text-gray-500">Filtrando por:</span>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium text-xs flex items-center gap-2">
              👤 {alumnoFiltro.apellido}, {alumnoFiltro.nombre} (DNI: {alumnoFiltro.dni})
              <button
                onClick={handleLimpiarFiltroAlumno}
                className="hover:text-blue-950 font-bold ml-1 text-sm"
                title="Quitar filtro"
              >
                ✕
              </button>
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-2 border-t border-gray-100">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Método de Pago</label>
            <select
              value={metodoFiltro}
              onChange={(e) => setMetodoFiltro(e.target.value as MetodoCobro | 'TODOS')}
              className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="TODOS">Todos los métodos</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="DEBITO">Débito</option>
              <option value="CREDITO">Crédito</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLA DE COBROS */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando historial de cobros...</div>
        ) : cobrosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No se encontraron cobros registrados con los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Alumno</th>
                  <th className="px-6 py-3">Plan</th>
                  <th className="px-6 py-3">Método</th>
                  <th className="px-6 py-3 text-right">Monto</th>
                  <th className="px-6 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {cobrosFiltrados.map((cobro) => {
                  const fechaObj = new Date(cobro.fecha_cobro);

                  return (
                    <tr key={cobro.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700 font-medium">
                        {fechaObj.toLocaleDateString('es-AR')}
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{getNombreAlumno(cobro)}</div>
                        <div className="text-xs text-gray-400">DNI: {getDniAlumno(cobro)}</div>
                      </td>

                      <td className="px-6 py-4 text-gray-700 font-medium">
                        {getNombrePlan(cobro)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                            cobro.metodo_cobro === 'efectivo'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : cobro.metodo_cobro === 'transferencia'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {cobro.metodo_cobro}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap font-bold text-gray-900 text-base">
                        ${Number(cobro.monto).toLocaleString('es-AR')}
                      </td>

                      <td className="px-6 py-4 text-center whitespace-nowrap space-x-2">
                        <button
                          onClick={() => handleEditarCobro(cobro)}
                          className="text-blue-600 hover:text-blue-800 font-semibold text-xs bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded transition-colors"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleEliminarCobro(cobro)}
                          className="text-red-600 hover:text-red-800 font-semibold text-xs bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded transition-colors"
                        >
                          🗑️ Anular
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL COBRO INTEGRADO CORRECTAMENTE */}
      <ModalCobro
        key={alumnoCobrando?.id || 'nuevo'}
        open={modalCobroOpen}
        cobro={cobroEditando}
        alumnoPreseleccionado={alumnoCobrando}
        onClose={() => {
          setModalCobroOpen(false);
          setCobroEditando(null);
          setAlumnoCobrando(null);
        }}
        onCobroGuardado={() => {
          setModalCobroOpen(false);
          setCobroEditando(null);
          setAlumnoCobrando(null);
          cargarCobros();
        }}
      />
    </div>
  );
}