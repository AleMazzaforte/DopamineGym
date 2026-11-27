import { useEffect, useState, useMemo, useCallback } from 'react';
import reporteService, { type PanoramaAlumno } from '../../services/ReporteService';
import { mostrarError } from '../../lib/swal';
import HistorialAlumno from './HistorialAlumno';

const formatoMoneda = (v: number | null | undefined): string =>
  `$${Number(v || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

const formatoFecha = (f: string | null | undefined): string => {
  if (!f) return '—';
  const [y, m, d] = String(f).slice(0, 10).split('-');
  if (!y) return '—';
  return `${d}/${m}/${y}`;
};

export default function PanoramaAlumnos() {
  const [alumnos, setAlumnos] = useState<PanoramaAlumno[]>([]);
  const [loading, setLoading] = useState(true);

  const [buscar, setBuscar] = useState('');
  const [buscarDebounce, setBuscarDebounce] = useState('');
  const [soloConDeuda, setSoloConDeuda] = useState(false);
  const [soloProvisorios, setSoloProvisorios] = useState(false);
  const [soloInactivos, setSoloInactivos] = useState(false);
    const [historialDe, setHistorialDe] = useState<{ id: number; nombre: string } | null>(null);

  // Debounce del buscador para no pegar a la BD en cada tecla
  useEffect(() => {
    const t = setTimeout(() => setBuscarDebounce(buscar.trim()), 300);
    return () => clearTimeout(t);
  }, [buscar]);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const data = await reporteService.getPanoramaAlumnos({
        buscar: buscarDebounce || undefined,
        solo_con_deuda: soloConDeuda,
        solo_provisorios: soloProvisorios,
        solo_inactivos: soloInactivos,
      });
      setAlumnos(data);
    } catch (error: unknown) {
      mostrarError('Error', error instanceof Error ? error.message : 'No se pudo cargar el panorama');
    } finally {
      setLoading(false);
    }
  }, [buscarDebounce, soloConDeuda, soloProvisorios, soloInactivos]);

  useEffect(() => { cargar(); }, [cargar]);

  // Resumen de la lista actual
  const resumen = useMemo(() => {
    const total = alumnos.length;
    const activos = alumnos.filter(a => a.estado === 'ACTIVO').length;
    const provisorios = alumnos.filter(a => a.estado === 'ACTIVO PROVISORIO').length;
    const conDeudaVencida = alumnos.filter(a => Number(a.deuda_vencida) > 0).length;
    const montoDeudaVencida = alumnos.reduce((acc, a) => acc + Number(a.deuda_vencida || 0), 0);
    const montoDeudaTotal = alumnos.reduce((acc, a) => acc + Number(a.deuda_total || 0), 0);
    return { total, activos, provisorios, conDeudaVencida, montoDeudaVencida, montoDeudaTotal };
  }, [alumnos]);

  const colorEstado = (estado: string) => {
    switch (estado) {
      case 'ACTIVO': return 'bg-green-100 text-green-800 border-green-300';
      case 'ACTIVO PROVISORIO': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'BAJA': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* RESUMEN */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-xs text-gray-500 uppercase font-semibold">Total alumnos</p>
          <p className="text-2xl font-extrabold text-gray-800">{resumen.total}</p>
          <p className="text-xs text-gray-400">{resumen.activos} activos · {resumen.provisorios} provisorios</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
          <p className="text-xs text-gray-500 uppercase font-semibold">Con deuda vencida</p>
          <p className="text-2xl font-extrabold text-red-700">{resumen.conDeudaVencida}</p>
          <p className="text-xs text-gray-400">{formatoMoneda(resumen.montoDeudaVencida)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-amber-500">
          <p className="text-xs text-gray-500 uppercase font-semibold">Deuda total</p>
          <p className="text-2xl font-extrabold text-amber-700">{formatoMoneda(resumen.montoDeudaTotal)}</p>
          <p className="text-xs text-gray-400">Vencida + futura comprometida</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-xs text-gray-500 uppercase font-semibold">Alumnos al día</p>
          <p className="text-2xl font-extrabold text-green-700">{resumen.activos - resumen.conDeudaVencida}</p>
          <p className="text-xs text-gray-400">Sin deuda ni vencida ni futura</p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-lg shadow space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label htmlFor="pa-buscar" className="block text-xs font-semibold text-gray-600 mb-1">Buscar por nombre, apellido o DNI</label>
            <input
              id="pa-buscar"
              type="text"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Ej: Gómez, 12345678..."
              className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div className="md:col-span-2 flex items-end gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={soloConDeuda} onChange={(e) => setSoloConDeuda(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded focus:ring-red-500" />
              Solo con deuda
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={soloProvisorios} onChange={(e) => setSoloProvisorios(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500" />
              Solo provisorios
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={soloInactivos} onChange={(e) => setSoloInactivos(e.target.checked)}
                className="w-4 h-4 text-gray-600 rounded focus:ring-gray-500" />
              Solo inactivos / bajas
            </label>
          </div>
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 animate-pulse">Cargando alumnos…</div>
        ) : alumnos.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay alumnos que coincidan con los filtros.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-4 py-3">DNI</th>
                  <th className="px-4 py-3">Apellido, Nombre</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Plan vigente</th>
                  <th className="px-4 py-3">Vence</th>
                  <th className="px-4 py-3 text-right">Deuda vencida</th>
                  <th className="px-4 py-3 text-right">Deuda total</th>
                  <th className="px-4 py-3 text-right">Último pago</th>
                  <th className="px-4 py-3 text-right">Compras</th>
                  <th className="px-4 py-3 text-right">Historial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {alumnos.map((a) => (
                  <tr key={a.persona_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 font-mono">{a.dni}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{a.apellido}, {a.nombre}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorEstado(a.estado)}`}>
                        {a.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{a.plan_nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatoFecha(a.cobertura_fin)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${Number(a.deuda_vencida) > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {formatoMoneda(a.deuda_vencida)}
                      {Number(a.cantidad_coberturas_vencidas) > 0 && (
                        <span className="block text-[10px] font-normal text-red-500">
                          {a.cantidad_coberturas_vencidas} cobert. vencida{Number(a.cantidad_coberturas_vencidas) > 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${Number(a.deuda_total) > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
                        {formatoMoneda(a.deuda_total)}
                        {Number(a.deuda_total) > 0 && a.primera_deuda_vence && (
                        <span className="block text-[10px] font-normal text-amber-600">
                          {Number(a.coberturas_con_deuda) > 1 ? `${a.coberturas_con_deuda} coberturas · ` : ''}
                          vence {formatoFecha(a.primera_deuda_vence)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {a.ultimo_pago_fecha ? (
                        <>
                          <div>{formatoFecha(a.ultimo_pago_fecha)}</div>
                          <div className="text-xs text-gray-500">{formatoMoneda(a.ultimo_pago_monto)}</div>
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {a.cantidad_compras > 0 ? (
                        <>
                          <div>{a.cantidad_compras} venta{a.cantidad_compras > 1 ? 's' : ''}</div>
                          <div className="text-xs text-gray-500">{formatoMoneda(a.total_compras)}</div>
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setHistorialDe({ id: a.persona_id, nombre: `${a.apellido}, ${a.nombre}` })}
                        className="text-blue-600 hover:text-blue-800 font-semibold text-xs bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded transition-colors"
                        title="Ver historial de períodos, pagos y estados"
                      >
                        📜 Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        <HistorialAlumno
        open={historialDe !== null}
        personaId={historialDe?.id ?? null}
        nombre={historialDe?.nombre ?? ''}
        onClose={() => setHistorialDe(null)}
      />
    </div>
  );
}