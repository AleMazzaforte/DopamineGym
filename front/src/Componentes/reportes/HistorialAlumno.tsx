import { useEffect, useState, useCallback } from 'react';
import reporteService, {
  type HistorialAlumnoResponse, type CoberturaHistorial
} from '../../services/ReporteService';
import { mostrarError } from '../../lib/swal';
import { useModalA11y } from '../../Hooks/useModalA11y';
import { getFechaLocal } from '../utils/dateUtils';

interface Props {
  open: boolean;
  personaId: number | null;
  nombre: string;
  onClose: () => void;
}

type Tab = 'periodos' | 'pagos' | 'estados' | 'compras';

const money = (v: number) => `$${Number(v || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

const fecha = (f: string | null | undefined) => {
  if (!f) return '—';
  const [y, m, d] = String(f).slice(0, 10).split('-');
  return y ? `${d}/${m}/${y}` : '—';
};

const estadoChip = (estado: string) => {
  switch (estado) {
    case 'ACTIVO': return 'bg-green-100 text-green-800 border-green-300';
    case 'ACTIVO PROVISORIO': return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'BAJA': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-gray-100 text-gray-700 border-gray-300';
  }
};

function CoberturaCard({ c, hoy }: { c: CoberturaHistorial; hoy: string }) {
  const estado = c.fecha_fin < hoy ? 'VENCIDA' : c.fecha_inicio > hoy ? 'FUTURA' : 'VIGENTE';
  const chip = estado === 'VIGENTE'
    ? 'bg-green-100 text-green-800 border-green-300'
    : estado === 'FUTURA'
      ? 'bg-blue-100 text-blue-800 border-blue-300'
      : 'bg-gray-100 text-gray-600 border-gray-300';

  const acordado = c.precio_aplicado + c.saldo_pendiente;
  const diff = c.precio_lista !== null ? acordado - c.precio_lista : null;

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-semibold text-gray-800 text-sm">{c.plan_nombre ?? `Plan #${c.plan_id}`}</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${chip}`}>{estado}</span>
      </div>
      <p className="text-xs text-gray-500">
        {fecha(c.fecha_inicio)} → {fecha(c.fecha_fin)}
        {c.duracion_meses ? ` · ${c.duracion_meses} mes${c.duracion_meses > 1 ? 'es' : ''}` : ''}
      </p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="block text-gray-400">Pagado</span>
          <span className="font-semibold text-gray-800">{money(c.precio_aplicado)}</span>
        </div>
        <div>
          <span className="block text-gray-400">Saldo</span>
          <span className={`font-semibold ${c.saldo_pendiente > 0 ? 'text-red-600' : 'text-gray-800'}`}>
            {money(c.saldo_pendiente)}
          </span>
        </div>
        <div>
          <span className="block text-gray-400">Acordado</span>
          <span className="font-semibold text-gray-800">{money(acordado)}</span>
        </div>
      </div>
      {diff !== null && diff !== 0 && (
        <p className={`text-[11px] font-semibold ${diff < 0 ? 'text-green-700' : 'text-amber-700'}`}>
          {diff < 0 ? `Descuento de ${money(Math.abs(diff))} sobre precio de lista` : `Recargo de ${money(diff)} sobre precio de lista`}
        </p>
      )}
    </div>
  );
}

export default function HistorialAlumno({ open, personaId, nombre, onClose }: Props) {
  const { dialogRef, handleBackdropClick } = useModalA11y({ open, onClose });

  const [data, setData] = useState<HistorialAlumnoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('periodos');

  const cargar = useCallback(async (id: number) => {
    try {
      setLoading(true);
      const r = await reporteService.getHistorialAlumno(id);
      setData(r);
    } catch (error: unknown) {
      mostrarError('Error', error instanceof Error ? error.message : 'No se pudo cargar el historial');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && personaId) {
      setTab('periodos');
      cargar(personaId);
    } else if (!open) {
      setData(null);
    }
  }, [open, personaId, cargar]);

  if (!open) return null;

  const hoy = getFechaLocal();
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'periodos', label: 'Períodos', count: data?.periodos.length ?? 0 },
    { key: 'pagos', label: 'Pagos', count: data?.pagos.length ?? 0 },
    { key: 'estados', label: 'Estados', count: data?.estados.length ?? 0 },
    { key: 'compras', label: 'Compras', count: data?.compras.length ?? 0 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="historial-title"
        tabIndex={-1}
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden outline-none"
      >
        {/* CABECERA */}
        <div className="bg-gray-800 text-white p-5 flex justify-between items-start gap-4">
          <div>
            <h2 id="historial-title" className="text-lg font-bold">
              📜 {data ? `${data.alumno.apellido}, ${data.alumno.nombre}` : nombre}
            </h2>
            <p className="text-xs text-gray-300 mt-0.5">
              {data ? `DNI ${data.alumno.dni}` : 'Cargando historial…'}
            </p>
            {data && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${estadoChip(data.alumno.estado)}`}>
                  {data.alumno.estado}
                </span>
                {Number(data.alumno.deuda_total) > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                    Deuda {money(Number(data.alumno.deuda_total))}
                  </span>
                )}
                {data.alumno.cobertura_fin && (
                  <span className="text-[11px] text-gray-300">Cubierto hasta {fecha(data.alumno.cobertura_fin)}</span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold leading-none" aria-label="Cerrar">
            ×
          </button>
        </div>

        {/* TABS */}
        <div className="border-b border-gray-200 px-5">
          <nav className="-mb-px flex gap-5" aria-label="Secciones del historial">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`py-2.5 px-1 border-b-2 text-sm font-semibold transition-colors ${
                  tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label} <span className="text-xs text-gray-400">({t.count})</span>
              </button>
            ))}
          </nav>
        </div>

        {/* CONTENIDO */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-10 text-center text-gray-500 animate-pulse">Cargando historial…</div>
          ) : !data ? (
            <div className="py-10 text-center text-gray-400 text-sm">No se pudo cargar el historial.</div>
          ) : tab === 'periodos' ? (
            <div className="space-y-4">
              {data.periodos.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Este alumno todavía no tiene membresías registradas.</p>
              ) : data.periodos.map(p => (
                <div key={p.periodo_id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-800">
                      Membresía #{p.periodo_id} · {fecha(p.fecha_inicio)} → {p.fecha_cierre ? fecha(p.fecha_cierre) : 'activa'}
                    </span>
                    {p.motivo_cierre && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                        {p.motivo_cierre}
                      </span>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    {p.coberturas.length === 0 ? (
                      <p className="text-xs text-gray-400">Sin coberturas cargadas.</p>
                    ) : p.coberturas.map(c => <CoberturaCard key={c.cobertura_id} c={c} hoy={hoy} />)}
                    {p.observaciones && <p className="text-xs text-gray-500 italic">{p.observaciones}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : tab === 'pagos' ? (
            <div className="overflow-x-auto">
              {data.pagos.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Sin pagos registrados.</p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-gray-500 uppercase text-xs border-b">
                    <tr>
                      <th className="py-2 pr-3">Fecha</th>
                      <th className="py-2 pr-3">Método</th>
                      <th className="py-2 pr-3">Descripción</th>
                      <th className="py-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.pagos.map(pg => (
                      <tr key={pg.id}>
                        <td className="py-2 pr-3 whitespace-nowrap text-gray-700">{fecha(pg.fecha_cobro)}</td>
                        <td className="py-2 pr-3 capitalize text-gray-600">{pg.metodo_cobro.replace(/_/g, ' ')}</td>
                        <td className="py-2 pr-3 text-gray-500 text-xs">{pg.descripcion ?? '—'}</td>
                        <td className="py-2 text-right font-bold text-green-700">{money(Number(pg.monto))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : tab === 'estados' ? (
            <div className="space-y-2">
              {data.estados.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Sin cambios de estado registrados.</p>
              ) : data.estados.map(e => {
                const promesaVencida = e.estado === 'ACTIVO PROVISORIO' && e.fecha_promesa_pago && e.fecha_promesa_pago < hoy;
                return (
                  <div key={e.id} className="border border-gray-200 rounded-lg p-3 flex items-start gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${estadoChip(e.estado)}`}>
                      {e.estado}
                    </span>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <p className="font-semibold text-gray-800">{fecha(e.fecha_cambio)} · {e.motivo}</p>
                      {e.observaciones && <p className="italic">{e.observaciones}</p>}
                      {e.fecha_promesa_pago && (
                        <p className={promesaVencida ? 'text-red-600 font-semibold' : 'text-amber-700'}>
                          Promesa de pago: {fecha(e.fecha_promesa_pago)}{promesaVencida ? ' (vencida)' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center space-y-2">
              <div className="text-4xl" aria-hidden="true">🛒</div>
              <p className="text-sm text-gray-500">Las compras aparecerán acá cuando se implemente la venta de productos con comprador.</p>
            </div>
          )}
        </div>

        {/* PIE */}
        <div className="bg-gray-50 border-t border-gray-200 p-4 flex justify-between items-center">
          <button
            type="button"
            onClick={() => personaId && cargar(personaId)}
            disabled={loading}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            ↻ Actualizar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-800 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}