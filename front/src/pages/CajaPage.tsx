import { useEffect, useState } from 'react';
import cajaService, { 
  type MovimientoCaja, 
  type MetodoPago, 
  type TipoMovimiento, 
  type EstadoCajaResponse 
} from '../services/CajaService';
import { 
  formatearHoraAR, 
  obtenerFechaHoyISO 
} from '../Componentes/utils/NormalizadorHorario';
import { mostrarError, mostrarExito } from '../lib/swal';

export default function CajaPage() {
  const [loading, setLoading] = useState(true);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [estadoCaja, setEstadoCaja] = useState<EstadoCajaResponse>({
    abierta: false,
    monto_inicial: 0
  });

  // Filtros
  const [fechaFiltro, setFechaFiltro] = useState(() => obtenerFechaHoyISO());
  const [tipoFiltro, setTipoFiltro] = useState<TipoMovimiento | 'TODOS'>('TODOS');
  const [metodoFiltro, setMetodoFiltro] = useState<MetodoPago | 'TODOS'>('TODOS');

  // Modales
  const [modalEgresoOpen, setModalEgresoOpen] = useState(false);
  const [modalAperturaOpen, setModalAperturaOpen] = useState(false);
  const [modalCierreOpen, setModalCierreOpen] = useState(false);

  // Inputs
  const [montoInicialInput, setMontoInicialInput] = useState('0');
  const [montoCierreInput, setMontoCierreInput] = useState('0');

  const [nuevoEgreso, setNuevoEgreso] = useState({
    concepto: '',
    monto: '',
    metodo_pago: 'efectivo' as MetodoPago
  });

  // CARGAR DATOS
  const cargarDatosCaja = async () => {
    try {
      setLoading(true);
      const [estado, listaMovimientos] = await Promise.all([
        cajaService.getEstado(),
        cajaService.getMovimientos(fechaFiltro)
      ]);

      setEstadoCaja(estado);
      setMovimientos(listaMovimientos);
    } catch (error: any) {
      mostrarError('Error', error.message || 'No se pudieron cargar los datos de la caja');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatosCaja();
  }, [fechaFiltro]);

  // FILTRADO LOCAL
  const movimientosFiltrados = movimientos.filter((m) => {
    if (tipoFiltro !== 'TODOS' && m.tipo !== tipoFiltro) return false;
    if (metodoFiltro !== 'TODOS' && m.metodo_pago !== metodoFiltro) return false;
    return true;
  });

  // ARQUEO GLOBAL
  const ingresosEfectivo = movimientos
    .filter((m) => m.tipo === 'INGRESO' && m.metodo_pago === 'efectivo')
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);

  const egresosEfectivo = movimientos
    .filter((m) => m.tipo === 'EGRESO' && m.metodo_pago === 'efectivo')
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);

  const ingresosDigitales = movimientos
    .filter((m) => m.tipo === 'INGRESO' && m.metodo_pago !== 'efectivo')
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);

  const egresosDigitales = movimientos
    .filter((m) => m.tipo === 'EGRESO' && m.metodo_pago !== 'efectivo')
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);

  const efectivoEnCajaCalculado = Number(estadoCaja.monto_inicial || 0) + ingresosEfectivo - egresosEfectivo;
  const totalDigital = ingresosDigitales - egresosDigitales;
  const totalGeneralConsolidado = efectivoEnCajaCalculado + totalDigital;

  // HANDLERS
  const handleAbrirCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await cajaService.abrirCaja(Number(montoInicialInput));
      setEstadoCaja({
        id: res.id,
        abierta: true,
        monto_inicial: Number(montoInicialInput)
      });
      mostrarExito('Caja Abierta', 'Se ha iniciado la jornada contable');
      setModalAperturaOpen(false);
      cargarDatosCaja();
    } catch (error: any) {
      mostrarError('Error al abrir caja', error.message);
    }
  };

  const abirModalCierre = () => {
    // Al abrir el modal, precargamos el monto calculado en el input por defecto
    setMontoCierreInput(efectivoEnCajaCalculado.toString());
    setModalCierreOpen(true);
  };

  const handleCerrarCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estadoCaja.id) return;

    try {
      await cajaService.cerrarCaja(estadoCaja.id, {
        monto_final: Number(montoCierreInput)
      });

      mostrarExito('Caja Cerrada', 'El arqueo ha sido finalizado con éxito');
      setModalCierreOpen(false);
      cargarDatosCaja();
    } catch (error: any) {
      mostrarError('Error al cerrar caja', error.message);
    }
  };

  const handleRegistrarEgreso = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nuevoEgreso.concepto || !nuevoEgreso.monto || Number(nuevoEgreso.monto) <= 0) {
      mostrarError('Atención', 'Ingresa un concepto y un monto válido');
      return;
    }

    try {
      await cajaService.registrarEgreso({
        concepto: nuevoEgreso.concepto,
        monto: Number(nuevoEgreso.monto),
        metodo_pago: nuevoEgreso.metodo_pago
      });

      mostrarExito('Gasto Registrado', 'El egreso fue registrado con éxito');
      setModalEgresoOpen(false);
      setNuevoEgreso({ concepto: '', monto: '', metodo_pago: 'efectivo' });
      cargarDatosCaja();
    } catch (error: any) {
      mostrarError('Error', error.message);
    }
  };

  const diferenciaCierre = Number(montoCierreInput || 0) - efectivoEnCajaCalculado;

  return (
    <div className="space-y-6">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Control de Caja Diario</h1>
          <p className="text-sm text-gray-500">
            Flujo consolidado de cobros, ventas y salidas de dinero.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalEgresoOpen(true)}
            disabled={!estadoCaja.abierta}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold rounded-lg shadow transition-colors flex items-center gap-2 text-sm"
          >
            💸 Registrar Gasto
          </button>

          {estadoCaja.abierta ? (
            <button
              onClick={abirModalCierre}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg shadow transition-colors text-sm"
            >
              🔒 Cerrar Caja
            </button>
          ) : (
            <button
              onClick={() => setModalAperturaOpen(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow transition-colors text-sm"
            >
              🔓 Abrir Caja del Día
            </button>
          )}
        </div>
      </div>

      {!estadoCaja.abierta && (
        <div className="p-4 bg-red-50 border-2 border-red-400 text-red-800 text-sm rounded-r-lg font-medium">
          ⚠️ La caja se encuentra <strong>CERRADA</strong>. Abre la caja para poder habilitar los gastos y operaciones.
        </div>
      )}

      {estadoCaja.abierta && (
        <div className="p-4 bg-yellow-50 border-2 border-yellow-400 text-yellow-800 text-sm rounded-r-lg font-medium">
          ⚠️ La caja se encuentra <strong>ABIERTA</strong>. Puedes registrar gastos y operaciones.
        </div>
      )}

      {/* TARJETAS DE ARQUEO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-gray-400">
          <p className="text-xs font-semibold text-gray-500 uppercase">Monto Inicial</p>
          <p className="text-2xl font-extrabold text-gray-700 mt-1">
            ${Number(estadoCaja.monto_inicial || 0).toLocaleString('es-AR')}
          </p>
          <p className="text-xs text-gray-400 mt-1">Base de cambio en billetes</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-xs font-semibold text-gray-500 uppercase">Efectivo Físico Calculado</p>
          <p className="text-2xl font-extrabold text-green-700 mt-1">
            ${efectivoEnCajaCalculado.toLocaleString('es-AR')}
          </p>
          <p className="text-xs text-gray-400 mt-1">Inicial + Entradas - Salidas</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-xs font-semibold text-gray-500 uppercase">Cobros Electrónicos</p>
          <p className="text-2xl font-extrabold text-purple-700 mt-1">
            ${totalDigital.toLocaleString('es-AR')}
          </p>
          <p className="text-xs text-gray-400 mt-1">Transferencia / Débito / Crédito</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-blue-600">
          <p className="text-xs font-semibold text-gray-500 uppercase">Total General Consolidado</p>
          <p className="text-2xl font-extrabold text-blue-800 mt-1">
            ${totalGeneralConsolidado.toLocaleString('es-AR')}
          </p>
          <p className="text-xs text-gray-400 mt-1">Efectivo en caja + Digitales</p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha</label>
            <input
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo Movimiento</label>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value as TipoMovimiento | 'TODOS')}
              className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="TODOS">Todos</option>
              <option value="INGRESO">Ingresos (+)</option>
              <option value="EGRESO">Egresos (-)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Método de Pago</label>
            <select
              value={metodoFiltro}
              onChange={(e) => setMetodoFiltro(e.target.value as MetodoPago | 'TODOS')}
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

      {/* TABLA DE MOVIMIENTOS */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando movimientos de caja...</div>
        ) : movimientosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No hay movimientos registrados para la fecha o filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-3">Hora</th>
                  <th className="px-6 py-3">Concepto</th>
                  <th className="px-6 py-3">Categoría</th>
                  <th className="px-6 py-3">Método</th>
                  <th className="px-6 py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {movimientosFiltrados.map((mov) => (
                  <tr key={mov.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium text-xs">
                      {formatearHoraAR(mov.fecha)} hs
                    </td>

                    <td className="px-6 py-4 font-semibold text-gray-800">
                      {mov.concepto}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          mov.tipo === 'INGRESO'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {(mov.categoria || 'GENERAL').replace('_', ' ')}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap capitalize text-xs text-gray-600">
                      {mov.metodo_pago}
                    </td>

                    <td
                      className={`px-6 py-4 text-right whitespace-nowrap font-extrabold text-base ${
                        mov.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {mov.tipo === 'INGRESO' ? '+' : '-'} ${Number(mov.monto).toLocaleString('es-AR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL APERTURA DE CAJA */}
      {modalAperturaOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">
              🔓 Abrir Caja del Día
            </h3>
            <form onSubmit={handleAbrirCaja} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Monto Inicial en Efectivo ($)
                </label>
                <input
                  type="number"
                  value={montoInicialInput}
                  onChange={(e) => setMontoInicialInput(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setModalAperturaOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold bg-green-600 hover:bg-green-700 text-white rounded-md shadow"
                >
                  Confirmar Apertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CIERRE DE CAJA */}
      {modalCierreOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">
              🔒 Arqueo y Cierre de Caja
            </h3>

            <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1 text-gray-600 border">
              <p className="flex justify-between">
                <span>Efectivo en caja (Calculado):</span>
                <strong className="text-gray-800">${efectivoEnCajaCalculado.toLocaleString('es-AR')}</strong>
              </p>
              <p className="flex justify-between">
                <span>Cobros digitales del día:</span>
                <strong className="text-gray-800">${totalDigital.toLocaleString('es-AR')}</strong>
              </p>
            </div>

            <form onSubmit={handleCerrarCaja} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Monto Real en Cajón ($) / Dejado para la siguiente apertura
                </label>
                <input
                  type="number"
                  value={montoCierreInput}
                  onChange={(e) => setMontoCierreInput(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-gray-700 focus:outline-none"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Podés modificar este valor si retirás dinero o dejás un cambio diferente.
                </p>
              </div>

              {diferenciaCierre !== 0 && (
                <div
                  className={`p-2.5 rounded-md text-xs font-bold flex justify-between ${
                    diferenciaCierre > 0
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  <span>Sobrante / Faltante registrado:</span>
                  <span>{diferenciaCierre > 0 ? '+' : ''}${diferenciaCierre.toLocaleString('es-AR')}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setModalCierreOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold bg-gray-800 hover:bg-gray-900 text-white rounded-md shadow"
                >
                  Confirmar Cierre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRO DE EGRESO */}
      {modalEgresoOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">
              💸 Registrar Salida de Dinero
            </h3>

            <form onSubmit={handleRegistrarEgreso} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Concepto</label>
                <input
                  type="text"
                  placeholder="Ej: Insumos de limpieza, reparación..."
                  value={nuevoEgreso.concepto}
                  onChange={(e) => setNuevoEgreso({ ...nuevoEgreso, concepto: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Monto ($)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={nuevoEgreso.monto}
                  onChange={(e) => setNuevoEgreso({ ...nuevoEgreso, monto: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Medio de Pago</label>
                <select
                  value={nuevoEgreso.metodo_pago}
                  onChange={(e) => setNuevoEgreso({ ...nuevoEgreso, metodo_pago: e.target.value as MetodoPago })}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="DEBITO">Débito</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setModalEgresoOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-md shadow"
                >
                  Guardar Egreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}