import { useEffect, useState, useCallback } from 'react';
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

const mesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const nombreMes = (periodo: string) => {
  const [y, m] = periodo.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
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

export default function ReportesPage() {
  const [tabActiva, setTabActiva] = useState<'mensual' | 'alumnos'>('mensual');
  const [periodo, setPeriodo] = useState(mesActual);
  const [reporte, setReporte] = useState<ReporteMensual | null>(null);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async (p: string) => {
    try {
      setLoading(true);
      const data = await reporteService.getMensual(p);
      setReporte(data);
    } catch (error: unknown) {
      mostrarError('Error', error instanceof Error ? error.message : 'No se pudo cargar el reporte');
      setReporte(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(periodo); }, [periodo, cargar]);

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
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Reporte Mensual</h1>
              <p className="text-sm text-gray-500 capitalize">{nombreMes(periodo)}</p>
            </div>
            <div className="flex items-end gap-3">
              <div>
                <label htmlFor="periodo" className="block text-xs font-semibold text-gray-600 mb-1">Período</label>
                <input
                  id="periodo"
                  type="month"
                  value={periodo}
                  max={mesActual()}
                  onChange={(e) => setPeriodo(e.target.value || mesActual())}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              {reporte?.es_admin && !reporte.cerrado && (
                <button
                  onClick={handleContabilizar}
                  disabled={procesando || loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg shadow text-sm"
                >
                  {procesando ? 'Procesando…' : '🔒 Contabilizar mes'}
                </button>
              )}
              {reporte?.es_admin && reporte.cerrado && (
                <button
                  onClick={handleReabrir}
                  disabled={procesando || loading}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 font-bold rounded-lg text-sm"
                >
                  {procesando ? 'Procesando…' : '🔓 Reabrir mes'}
                </button>
              )}
            </div>
          </div>
        
      {/* ESTADO DEL MES */}
      {reporte?.cerrado ? (
        <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-800 text-sm rounded-r-lg">
          ✅ Mes <strong>contabilizado</strong> por {reporte.cierre?.cerrado_por}. Sus movimientos están bloqueados contra edición.
        </div>
      ) : (
        <div className="p-4 bg-amber-50 border-l-4 border-amber-400 text-amber-800 text-sm rounded-r-lg">
          ⚠️ Mes <strong>abierto</strong>. Los totales pueden cambiar si se registran o anulan movimientos.
        </div>
      )}

      {reporte && reporte.sesiones_sin_arqueo > 0 && (
        <div className="p-4 bg-gray-50 border-l-4 border-gray-400 text-gray-700 text-sm rounded-r-lg">
          ℹ️ {reporte.sesiones_sin_arqueo} de {reporte.sesiones_cerradas} jornadas de este mes se cerraron
          antes de implementar el arqueo, así que no tienen diferencias registradas. El neto de
          diferencias solo refleja las jornadas medidas.
        </div>
      )}

      {loading ? (
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500 animate-pulse">Calculando reporte…</div>
      ) : !reporte ? (
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-400">No hay datos para este período.</div>
      ) : (
        <>
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
            <Fila label="Facturado en efectivo" valor={reporte.conciliacion.facturado_efectivo} />
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
  )
}