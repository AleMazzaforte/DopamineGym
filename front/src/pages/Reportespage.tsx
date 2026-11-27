import { useState, useCallback } from 'react';
import reporteService, { type ReporteMensual } from '../services/ReporteService';
import type { MetodoPago } from '../services/CajaService';
import { mostrarError, mostrarExito, mostrarConfirmacion } from '../lib/swal';
import PanoramaAlumnos from '../Componentes/reportes/PanoramaAlumnos';

const formatoMoneda = (v: number): string =>
  `$${Number(v || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

const ETIQUETAS: { key: MetodoPago; label: string }[] = [
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'tarjetas', label: 'Tarjetas' },
  { key: 'QR', label: 'QR / MercadoPago' },
  { key: 'debito_automatico', label: 'Débito automático' },
];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const pad = (n: number) => String(n).padStart(2, '0');
const clave = (anio: number, mesIndex: number) => `${anio}-${pad(mesIndex + 1)}`;

const mesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

const nombreMes = (periodo: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) return '';
  const [y, m] = periodo.split('-').map(Number);
  return `${MESES[m - 1]} de ${y}`;
};

function Fila({ label, valor, destacado = false, negativo = false }: {
  label: string; valor: number; destacado?: boolean; negativo?: boolean;
}) {
  return (
    <div className={`flex justify-between py-2 ${destacado ? 'border-t-2 border-gray-300 mt-1 pt-3 font-extrabold text-base' : 'text-sm'}`}>
      <span className={destacado ? 'text-gray-900' : 'text-gray-600'}>{label}</span>
      <span className={negativo ? 'text-red-600 font-bold' : destacado ? 'text-gray-900' : 'text-gray-800 font-semibold'}>
        {negativo && valor !== 0 ? '− ' : ''}{formatoMoneda(Math.abs(valor))}
      </span>
    </div>
  );
}

/* ============================================================
   Selector de período: cualquier mes de cualquier año
   ============================================================ */

function SelectorPeriodo({ periodo, onElegir, onCerrar, cerrable }: {
  periodo: string;
  onElegir: (p: string) => void;
  onCerrar: () => void;
  cerrable: boolean;
}) {
  const hoy = new Date();
  const actual = mesActual();

  const [anio, setAnio] = useState(() => {
    const y = Number(periodo.slice(0, 4));
    return Number.isInteger(y) && y > 0 ? y : hoy.getFullYear();
  });
  const [manual, setManual] = useState(periodo);

  const anterior = (() => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  })();
  const anioPasado = `${hoy.getFullYear() - 1}-${pad(hoy.getMonth() + 1)}`;

  const submitManual = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(manual)) {
      mostrarError('Atención', 'Elegí un mes y un año válidos.');
      return;
    }
    onElegir(manual);
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      {/* Año */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAnio(a => a - 1)}
            aria-label="Año anterior"
            className="w-9 h-9 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-bold transition-colors"
          >
            ‹
          </button>
          <input
            type="number"
            value={anio}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isInteger(v) && v > 0) setAnio(v);
            }}
            aria-label="Año"
            className="w-24 px-2 py-1.5 text-center text-lg font-extrabold text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setAnio(a => a + 1)}
            aria-label="Año siguiente"
            className="w-9 h-9 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-bold transition-colors"
          >
            ›
          </button>
        </div>

        <p className="text-xs text-gray-500 hidden sm:block">
          Elegí un mes para ver su reporte
        </p>

        {cerrable && (
          <button
            type="button"
            onClick={onCerrar}
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>

      {/* Grilla de meses */}
      <div className="p-5 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {MESES.map((nombre, i) => {
          const valor = clave(anio, i);
          const seleccionado = valor === periodo;
          const esHoy = valor === actual;
          return (
            <button
              key={nombre}
              type="button"
              onClick={() => onElegir(valor)}
              aria-pressed={seleccionado}
              className={`relative px-3 py-3 rounded-lg text-sm font-semibold border transition-colors ${
                seleccionado
                  ? 'bg-blue-600 border-blue-600 text-white shadow'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              {nombre}
              {esHoy && !seleccionado && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* Atajos + entrada manual */}
      <div className="px-5 pb-5 pt-1 flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-t border-gray-100">
        <div className="flex flex-wrap gap-2 pt-4">
          <button
            type="button"
            onClick={() => onElegir(actual)}
            className="px-3 py-1.5 text-xs font-semibold rounded-full border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            Mes actual
          </button>
          <button
            type="button"
            onClick={() => onElegir(anterior)}
            className="px-3 py-1.5 text-xs font-semibold rounded-full border border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            Mes anterior
          </button>
          <button
            type="button"
            onClick={() => onElegir(anioPasado)}
            className="px-3 py-1.5 text-xs font-semibold rounded-full border border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            Mismo mes del año pasado
          </button>
        </div>

        <form onSubmit={submitManual} className="flex items-end gap-2 pt-4">
          <div>
            <label htmlFor="periodo-manual" className="block text-xs font-semibold text-gray-600 mb-1">
              Otro período
            </label>
            <input
              id="periodo-manual"
              type="month"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg text-sm transition-colors"
          >
            Ver
          </button>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   Página
   ============================================================ */

export default function ReportesPage() {
  const [tabActiva, setTabActiva] = useState<'mensual' | 'alumnos'>('mensual');

  const [periodo, setPeriodo] = useState('');
  const [reporte, setReporte] = useState<ReporteMensual | null>(null);
  const [loading, setLoading] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [generado, setGenerado] = useState(false);
  const [selectorAbierto, setSelectorAbierto] = useState(true);

  const cargar = useCallback(async (p: string) => {
    try {
      setLoading(true);
      setGenerado(true);
      const data = await reporteService.getMensual(p);
      setReporte(data);
    } catch (error: unknown) {
      mostrarError('Error', error instanceof Error ? error.message : 'No se pudo cargar el reporte');
      setReporte(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const elegirPeriodo = (p: string) => {
    setPeriodo(p);
    setSelectorAbierto(false);
    cargar(p);
  };

  const handleContabilizar = async () => {
    const ok = await mostrarConfirmacion(
      `¿Contabilizar ${nombreMes(periodo)}?`,
      'Se guardará una foto del mes y sus cobros, ventas y egresos dejarán de poder editarse o anularse.'
    );
    if (!ok) return;

    setProcesando(true);
    try {
      const r = await reporteService.contabilizar(periodo);
      mostrarExito('Mes contabilizado', r.mensaje);
      await cargar(periodo);
    } catch (error: unknown) {
      mostrarError('No se pudo contabilizar', error instanceof Error ? error.message : 'Error');
    } finally {
      setProcesando(false);
    }
  };

  const handleReabrir = async () => {
    const ok = await mostrarConfirmacion(
      `¿Reabrir ${nombreMes(periodo)}?`,
      'Los movimientos de ese mes volverán a ser editables. Usalo solo si cerraste el mes por error.'
    );
    if (!ok) return;

    setProcesando(true);
    try {
      const r = await reporteService.reabrir(periodo);
      mostrarExito('Mes reabierto', r.mensaje);
      await cargar(periodo);
    } catch (error: unknown) {
      mostrarError('No se pudo reabrir', error instanceof Error ? error.message : 'Error');
    } finally {
      setProcesando(false);
    }
  };

  const puedeContabilizar = Boolean(periodo) && periodo <= mesActual();

  return (
    <div className="space-y-6">
      {/* TABS */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Pestañas de reportes">
          <button
            onClick={() => setTabActiva('mensual')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
              tabActiva === 'mensual'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📊 Mensual (Caja)
          </button>
          <button
            onClick={() => setTabActiva('alumnos')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
              tabActiva === 'alumnos'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            👥 Alumnos
          </button>
        </nav>
      </div>

      {tabActiva === 'alumnos' ? (
        <PanoramaAlumnos />
      ) : (
        <>
          {/* CABECERA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Reporte Mensual</h1>
              <p className="text-sm text-gray-500">
                {periodo ? nombreMes(periodo) : 'Elegí el período que querés analizar'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectorAbierto(true)}
                disabled={loading || procesando}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-bold rounded-lg text-sm transition-colors"
              >
                🗓️ {periodo ? 'Cambiar período' : 'Elegir período'}
              </button>

              {reporte?.es_admin && !reporte.cerrado && puedeContabilizar && (
                <button
                  type="button"
                  onClick={handleContabilizar}
                  disabled={procesando || loading}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-bold rounded-lg shadow text-sm transition-colors"
                >
                  {procesando ? 'Procesando…' : '🔒 Contabilizar mes'}
                </button>
              )}
              {reporte?.es_admin && reporte.cerrado && (
                <button
                  type="button"
                  onClick={handleReabrir}
                  disabled={procesando || loading}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 font-bold rounded-lg text-sm transition-colors"
                >
                  {procesando ? 'Procesando…' : '🔓 Reabrir mes'}
                </button>
              )}
            </div>
          </div>

          {/* SELECTOR */}
          {selectorAbierto && (
            <SelectorPeriodo
              key={`selector-${periodo || 'inicial'}`}
              periodo={periodo}
              onElegir={elegirPeriodo}
              onCerrar={() => setSelectorAbierto(false)}
              cerrable={generado || Boolean(periodo)}
            />
          )}

          {/* CARGANDO */}
          {loading && (
            <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500 animate-pulse">
              Calculando el reporte de {nombreMes(periodo)}…
            </div>
          )}

          {/* ERROR */}
          {!loading && generado && !reporte && !selectorAbierto && (
            <div className="bg-white rounded-lg shadow p-8 text-center space-y-3">
              <p className="text-gray-500 text-sm">No se pudo generar el reporte de {nombreMes(periodo)}.</p>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => cargar(periodo)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition-colors"
                >
                  Reintentar
                </button>
                <button
                  type="button"
                  onClick={() => setSelectorAbierto(true)}
                  className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded-lg text-sm transition-colors"
                >
                  Elegir otro período
                </button>
              </div>
            </div>
          )}

          {/* REPORTE */}
          {!loading && reporte && (
            <>
              {reporte.cerrado ? (
                <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-800 text-sm rounded-r-lg">
                  ✅ Mes <strong>contabilizado</strong> por {reporte.cierre?.cerrado_por}. Sus movimientos están bloqueados contra edición.
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border-l-4 border-amber-400 text-amber-800 text-sm rounded-r-lg">
                  ⚠️ Mes <strong>abierto</strong>. Los totales pueden cambiar si se registran o anulan movimientos.
                </div>
              )}

              {reporte.sesiones_sin_arqueo > 0 && (
                <div className="p-4 bg-gray-50 border-l-4 border-gray-400 text-gray-700 text-sm rounded-r-lg">
                  ℹ️ {reporte.sesiones_sin_arqueo} de {reporte.sesiones_cerradas} jornadas de este mes se cerraron
                  antes de implementar el arqueo, así que no tienen diferencias registradas. El neto de
                  diferencias solo refleja las jornadas medidas.
                </div>
              )}

              {/* 1. INGRESOS FACTURADOS */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-sm font-bold text-gray-700 uppercase mb-3 border-b pb-2">
                  1 · Ingresos facturados del mes
                </h2>
                {ETIQUETAS.map((m) => (
                  <Fila key={m.key} label={m.label} valor={reporte.ingresos.por_metodo[m.key]} />
                ))}
                <Fila label="TOTAL FACTURADO" valor={reporte.ingresos.total} destacado />
                <p className="text-xs text-gray-400 mt-3">
                  {reporte.ingresos.cantidad_cobros} cobros de alumnos · {reporte.ingresos.cantidad_ventas} ventas de insumos · {reporte.sesiones_cerradas} jornadas cerradas
                </p>
              </div>

              {/* 2. CONCILIACIÓN DE EFECTIVO */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-sm font-bold text-gray-700 uppercase mb-3 border-b pb-2">
                  2 · Conciliación de efectivo
                </h2>
               <Fila label="Cobrado en efectivo" valor={reporte.conciliacion.facturado_efectivo} />
                <Fila
                  label={reporte.conciliacion.diferencias_netas < 0 ? 'Faltantes netos de arqueo' : 'Sobrantes netos de arqueo'}
                  valor={reporte.conciliacion.diferencias_netas}
                  negativo={reporte.conciliacion.diferencias_netas < 0}
                />
                <Fila label="EFECTIVO REAL CONCILIADO" valor={reporte.conciliacion.efectivo_conciliado} destacado />
                <p className="text-xs text-gray-400 mt-3">
                  Las diferencias salen de los arqueos cerrados en el mes. Un faltante es plata que el sistema esperaba y no estaba.
                </p>
              </div>

              {/* 3. MOVIMIENTO DE EFECTIVO */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-sm font-bold text-gray-700 uppercase mb-3 border-b pb-2">
                  3 · Movimiento de efectivo
                </h2>
                <Fila label="Extracciones del mes (retiros)" valor={reporte.movimiento_efectivo.extracciones} />
                <Fila label="Egresos operativos en efectivo" valor={reporte.movimiento_efectivo.egresos_efectivo} />
                <Fila label="Cambio aportado a la caja" valor={reporte.movimiento_efectivo.aportes_cambio} />
                <Fila label="Efectivo en cajón al cierre del mes" valor={reporte.movimiento_efectivo.remanente_fin_mes} destacado />
                <p className="text-xs text-gray-400 mt-3">
                  Las extracciones no son un gasto: es plata que se movió al banco o a la caja fuerte. La ganancia ya se contabilizó al cobrar.
                </p>
              </div>

              {/* 4. EGRESOS POR MÉTODO */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-sm font-bold text-gray-700 uppercase mb-3 border-b pb-2">
                  4 · Egresos operativos por medio de pago
                </h2>
                {ETIQUETAS.map((m) => (
                  <Fila key={m.key} label={m.label} valor={reporte.egresos.por_metodo[m.key]} />
                ))}
                <Fila label="TOTAL EGRESOS" valor={reporte.egresos.total} destacado />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}