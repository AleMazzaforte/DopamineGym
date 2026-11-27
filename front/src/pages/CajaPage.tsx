import { useState } from 'react';
import { useCaja } from '../hooks/useCaja';
import { formatearHoraAR, formatearFechaHoraAR } from '../Componentes/utils/NormalizadorHorario';
import type { MetodoPago, TipoMovimiento } from '../services/CajaService';
import BuscadorAlumno from '../Componentes/utils/BuscadorAlumnos';
import ModalCobro from '../Componentes/modales/cobros/ModalCobros';
import { mostrarError } from '../lib/swal';
import { useCajaGlobal } from '../contexts/CajaContext';
import ModalVenta from '../Componentes/modales/ventas/ModalVenta';
import ModalFiado from '../Componentes/modales/ventas/ModalFiado';

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const formatoMoneda = (valor: number): string =>
  `$${Number(valor || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjetas', label: 'Tarjeta (Débito/Crédito)' },
  { value: 'QR', label: 'QR' },
  { value: 'debito_automatico', label: 'Débito automático' },
];

type ModalCaja = 'APERTURA' | 'CIERRE' | 'EGRESO' | 'RETIRO' | null;

export default function CajaPage() {
  const {
    loading, isSubmitting, movimientosFiltrados, estadoCaja, sesion, arqueo,
    esAdmin, remanenteAnterior,
    fechaFiltro, setFechaFiltro, tipoFiltro, setTipoFiltro, metodoFiltro, setMetodoFiltro,
    abrirCaja, cerrarCaja, registrarEgreso, registrarRetiro, refetch
  } = useCaja();

    const { refetchEstado } = useCajaGlobal();

  const [modal, setModal] = useState<ModalCaja>(null);

  // Apertura
  const [aporte, setAporte] = useState('0');

  // Cierre
  const [contado, setContado] = useState('');
  const [retiroCierre, setRetiroCierre] = useState('0');
  const [motivoRetiroCierre, setMotivoRetiroCierre] = useState('');
  const [obsDiferencia, setObsDiferencia] = useState('');

  // Retiro durante jornada
  const [retiroJornada, setRetiroJornada] = useState({ monto: '', motivo: '' });

  // Egreso
  const [egreso, setEgreso] = useState({ concepto: '', monto: '', metodo: 'efectivo' as MetodoPago });

  // Cobro rápido
  const [alumnoCobrando, setAlumnoCobrando] = useState<any>(null);
  const [modalCobroOpen, setModalCobroOpen] = useState(false);

  const [modalVentaOpen, setModalVentaOpen] = useState(false);
    const [modalFiadoOpen, setModalFiadoOpen] = useState(false);

  const aporteNum = round2(Number(aporte || 0));
  const inicialPreview = round2(remanenteAnterior + aporteNum);

  const contadoNum = round2(Number(contado || 0));
  const retiroCierreNum = round2(Number(retiroCierre || 0));
  const diferencia = round2(contadoNum - arqueo.efectivoCalculado);
  const remanentePreview = round2(contadoNum - retiroCierreNum);

  /* ---------------- Handlers ---------------- */

  const handleAbrir = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!Number.isFinite(aporteNum) || aporteNum < 0) {
      mostrarError('Atención', 'El cambio a agregar debe ser positivo o cero');
      return;
    }
    if (await abrirCaja(aporteNum)) {
      setModal(null);
      setAporte('0');
      await refetchEstado();
    }
  };

  const handleCerrar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!estadoCaja.id) return;

    if (contado.trim() === '' || !Number.isFinite(contadoNum) || contadoNum < 0) {
      mostrarError('Atención', 'Ingresá el efectivo que contaste en el cajón');
      return;
    }
    if (retiroCierreNum < 0 || retiroCierreNum > contadoNum) {
      mostrarError('Atención', 'El retiro no puede ser negativo ni mayor a lo que contaste');
      return;
    }
    if (retiroCierreNum > 0 && !motivoRetiroCierre.trim()) {
      mostrarError('Atención', 'Indicá el motivo del retiro');
      return;
    }
    if (diferencia !== 0 && !obsDiferencia.trim()) {
      mostrarError('Atención', `Hay una diferencia de ${formatoMoneda(diferencia)}. Explicala antes de cerrar.`);
      return;
    }

    const r = await cerrarCaja(estadoCaja.id, {
      efectivo_contado: contadoNum,
      monto_retirado: retiroCierreNum,
      motivo_retiro: motivoRetiroCierre.trim() || undefined,
      observaciones_diferencia: obsDiferencia.trim() || undefined
    });

    if (r) {
      setModal(null);
      setContado('');
      setRetiroCierre('0');
      setMotivoRetiroCierre('');
      setObsDiferencia('');
      await refetchEstado();
    }
  };

  const handleRetiroJornada = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const monto = round2(Number(retiroJornada.monto));
    if (!Number.isFinite(monto) || monto <= 0) {
      mostrarError('Atención', 'El monto del retiro debe ser mayor a cero');
      return;
    }
    if (!retiroJornada.motivo.trim()) {
      mostrarError('Atención', 'Indicá el motivo del retiro');
      return;
    }
    if (monto > arqueo.efectivoCalculado) {
      mostrarError('Atención', `No hay tanto efectivo. Disponible: ${formatoMoneda(arqueo.efectivoCalculado)}`);
      return;
    }
    if (await registrarRetiro(monto, retiroJornada.motivo.trim())) {
      setModal(null);
      setRetiroJornada({ monto: '', motivo: '' });
      await refetchEstado();
    }
  };

  const abrirModalCierre = () => {
    setContado(arqueo.efectivoCalculado.toFixed(2));
    setRetiroCierre('0');
    setMotivoRetiroCierre('');
    setObsDiferencia('');
    setModal('CIERRE');
  };





  const handleEgreso = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const monto = round2(Number(egreso.monto));
    if (!egreso.concepto.trim() || !Number.isFinite(monto) || monto <= 0) {
      mostrarError('Atención', 'Ingresá concepto y monto válido');
      return;
    }
    if (await registrarEgreso(egreso.concepto.trim(), monto, egreso.metodo)) {
      setModal(null);
      setEgreso({ concepto: '', monto: '', metodo: 'efectivo' });
    }
  };

  const handleSeleccionarAlumno = (alumno: any) => {
    if (!estadoCaja.abierta) {
      mostrarError('Caja Cerrada', 'Abrí la caja antes de registrar un cobro.');
      return;
    }
    setAlumnoCobrando(alumno);
    setModalCobroOpen(true);
  };

  const claseMovimiento = (tipo: TipoMovimiento) => {
    if (tipo === 'INGRESO') return { badge: 'bg-blue-100 text-blue-800', monto: 'text-green-600', signo: '+' };
    if (tipo === 'RETIRO') return { badge: 'bg-amber-100 text-amber-800', monto: 'text-amber-700', signo: '−' };
    return { badge: 'bg-red-100 text-red-800', monto: 'text-red-600', signo: '−' };
  };

  /* ---------------- Render ---------------- */

  return (
    <div className="space-y-6">

      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Control de Caja Diario</h1>
          <p className="text-sm text-gray-500">
            {estadoCaja.abierta
              ? `Jornada abierta por ${estadoCaja.usuario_apertura ?? '—'} · ${estadoCaja.fecha_apertura ? formatearFechaHoraAR(estadoCaja.fecha_apertura) : '—'}`
              : 'Flujo consolidado de cobros, ventas, retiros y gastos.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
                    <button
            onClick={() => setModalVentaOpen(true)}
            disabled={!estadoCaja.abierta || isSubmitting}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold rounded-lg shadow transition-colors text-sm"
          >
            🛒 Ventas
          </button>

          <button
            onClick={() => setModalFiadoOpen(true)}
            disabled={isSubmitting}
            className="relative px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-bold rounded-lg shadow transition-colors text-sm"
            title="Ver y cobrar ventas fiadas"
          >
            💳 Fiados
            {estadoCaja.fiados_cantidad > 0 && (
              <span className="absolute -top-2 -right-2 bg-white text-amber-700 border border-amber-600 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow">
                {estadoCaja.fiados_cantidad} · {formatoMoneda(estadoCaja.fiados_total)}
              </span>
            )}
          </button>
          {esAdmin && (
            <button
              onClick={() => setModal('RETIRO')}
              disabled={!estadoCaja.abierta || isSubmitting}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-bold rounded-lg shadow transition-colors text-sm"
            >
              🏦 Retirar Efectivo
            </button>
          )}

          <button
            onClick={() => setModal('EGRESO')}
            disabled={!estadoCaja.abierta || isSubmitting}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold rounded-lg shadow transition-colors text-sm"
          >
            💸 Registrar Gasto
          </button>

          {estadoCaja.abierta ? (
            <button
              onClick={abrirModalCierre}
              disabled={isSubmitting}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-bold rounded-lg shadow transition-colors text-sm"
            >
              🔒 Cerrar Caja
            </button>
          ) : (
            <button
              onClick={() => { setAporte('0'); setModal('APERTURA'); }}
              disabled={isSubmitting}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-lg shadow transition-colors text-sm"
            >
              🔓 Abrir Caja
            </button>
          )}
        </div>
      </div>

      {/* ALERTA */}
      {!estadoCaja.abierta ? (
        <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-800 text-sm rounded-r-lg font-medium">
          ⚠️ La caja está <strong>CERRADA</strong>. Abrila para habilitar cobros, gastos y retiros.
        </div>
      ) : (
        <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 text-sm rounded-r-lg font-medium">
          ⚠️ La caja está <strong>ABIERTA</strong>. Podés registrar operaciones.
        </div>
      )}

      {/* ARQUEO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-gray-400">
          <p className="text-xs font-semibold text-gray-500 uppercase">Monto Inicial</p>
          <p className="text-2xl font-extrabold mt-1 text-gray-700">{formatoMoneda(arqueo.ingresosEfectivo >= 0 ? (sesion?.monto_inicial ?? estadoCaja.monto_inicial) : 0)}</p>
          <p className="text-xs text-gray-400 mt-1">Remanente + cambio aportado</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-xs font-semibold text-gray-500 uppercase">Efectivo Calculado</p>
          <p className="text-2xl font-extrabold mt-1 text-green-700">{formatoMoneda(arqueo.efectivoCalculado)}</p>
          <p className="text-xs text-gray-400 mt-1">
           Inicial + entradas − gastos − retiros ({formatoMoneda(arqueo.retirosEfectivo)})
          </p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-xs font-semibold text-gray-500 uppercase">Cobros Digitales</p>
          <p className="text-2xl font-extrabold mt-1 text-purple-700">{formatoMoneda(arqueo.totalDigital)}</p>
          <p className="text-xs text-gray-400 mt-1">Transferencia / Tarjeta / QR</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-blue-600">
          <p className="text-xs font-semibold text-gray-500 uppercase">Total Consolidado</p>
          <p className="text-2xl font-extrabold mt-1 text-blue-800">{formatoMoneda(arqueo.totalConsolidado)}</p>
          <p className="text-xs text-gray-400 mt-1">Efectivo en caja + digitales</p>
        </div>
      </div>

      {/* COBRO RÁPIDO */}
      <div className="bg-white p-4 rounded-lg shadow border border-blue-100">
        <p className="text-xs font-semibold text-blue-800 mb-2 uppercase">⚡ Seleccioná un alumno</p>
        <BuscadorAlumno
          key={`caja-buscador-${fechaFiltro}`}
          onSeleccionar={handleSeleccionarAlumno}
          mostrarFiltroBajas={false}
          verBajas={false}
          onVerBajasChange={() => {}}
        />
      </div>

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label htmlFor="f-fecha" className="block text-xs font-semibold text-gray-600 mb-1">Fecha del libro de caja</label>
            <input id="f-fecha" type="date" value={fechaFiltro} onChange={(e) => setFechaFiltro(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label htmlFor="f-tipo" className="block text-xs font-semibold text-gray-600 mb-1">Tipo de movimiento</label>
            <select id="f-tipo" value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as TipoMovimiento | 'TODOS')}
              className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <option value="TODOS">Todos</option>
              <option value="INGRESO">Ingresos (+)</option>
              <option value="EGRESO">Gastos (−)</option>
              <option value="RETIRO">Retiros (−)</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-metodo" className="block text-xs font-semibold text-gray-600 mb-1">Método de pago</label>
            <select id="f-metodo" value={metodoFiltro} onChange={(e) => setMetodoFiltro(e.target.value as MetodoPago | 'TODOS')}
              className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <option value="TODOS">Todos los métodos</option>
              {METODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 animate-pulse">Cargando movimientos de caja…</div>
        ) : movimientosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay movimientos para esta fecha o filtros.</div>
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
                {movimientosFiltrados.map((mov) => {
                  const est = claseMovimiento(mov.tipo);
                  return (
                    <tr key={`${mov.tipo}-${mov.id}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium text-xs">{formatearHoraAR(mov.fecha)} hs</td>
                      <td className="px-6 py-4 font-semibold text-gray-800">{mov.concepto}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${est.badge}`}>
                          {(mov.categoria || 'GENERAL').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap capitalize text-xs text-gray-600">{mov.metodo_pago.replace(/_/g, ' ')}</td>
                      <td className={`px-6 py-4 text-right whitespace-nowrap font-extrabold text-base ${est.monto}`}>
                        {est.signo} {formatoMoneda(Number(mov.monto))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL APERTURA */}
      {modal === 'APERTURA' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handleAbrir} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">🔓 Abrir Caja del Día</h3>

            <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1 text-gray-600 border">
              <p className="flex justify-between">
                <span>Remanente de la jornada anterior:</span>
                <strong className="text-gray-800">{formatoMoneda(remanenteAnterior)}</strong>
              </p>
              <p className="text-[11px] text-gray-400">Este valor no se puede editar.</p>
            </div>

            <div>
              <label htmlFor="aporte" className="block text-xs font-bold text-gray-700 mb-1">Agregar cambio ($)</label>
              <input id="aporte" type="number" inputMode="decimal" min="0" step="0.01"
                value={aporte} onChange={(e) => setAporte(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" required />
              <p className="text-[11px] text-gray-400 mt-1">Solo valores positivos. Es plata que agregás al cajón.</p>
            </div>

            <div className="p-2.5 bg-green-50 border border-green-200 rounded-md text-xs font-bold flex justify-between text-green-800">
              <span>La caja abre con:</span>
              <span>{formatoMoneda(inicialPreview)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setModal(null)} disabled={isSubmitting}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={isSubmitting}
                className="px-4 py-2 text-sm font-bold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-md shadow">
                {isSubmitting ? 'Abriendo…' : 'Confirmar Apertura'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CIERRE */}
      {modal === 'CIERRE' && estadoCaja.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handleCerrar} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">🔒 Arqueo y Cierre de Caja</h3>

            <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1 text-gray-600 border">
              <p className="flex justify-between"><span>Efectivo calculado por el sistema:</span>
                <strong className="text-gray-800">{formatoMoneda(arqueo.efectivoCalculado)}</strong></p>
              <p className="flex justify-between"><span>Retiros ya hechos en la jornada:</span>
                <strong className="text-gray-800">{formatoMoneda(arqueo.retirosEfectivo)}</strong></p>
              <p className="flex justify-between"><span>Cobros digitales:</span>
                <strong className="text-gray-800">{formatoMoneda(arqueo.totalDigital)}</strong></p>
            </div>

            <div>
              <label htmlFor="contado" className="block text-xs font-bold text-gray-700 mb-1">Efectivo existente en el cajón ($)</label>
              <input id="contado" type="number" inputMode="decimal" min="0" step="0.01" placeholder="Contá los billetes y cargá el total"
                value={contado} onChange={(e) => setContado(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-gray-700 focus:outline-none" required />
            </div>

            {contado.trim() !== '' && (
              <div className={`p-2.5 rounded-md text-xs font-bold flex justify-between ${
                diferencia === 0 ? 'bg-gray-100 text-gray-700'
                  : diferencia > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                <span>{diferencia === 0 ? 'Sin diferencias' : diferencia > 0 ? 'Sobrante' : 'Faltante'}:</span>
                <span>{formatoMoneda(diferencia)}</span>
              </div>
            )}

            {diferencia !== 0 && (
              <div>
                <label htmlFor="obs-dif" className="block text-xs font-bold text-gray-700 mb-1">
                  Explicación de la diferencia <span className="text-red-600">*</span>
                </label>
                <textarea id="obs-dif" rows={2} value={obsDiferencia} onChange={(e) => setObsDiferencia(e.target.value)}
                  placeholder="Ej: se dio mal el cambio en un cobro"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:outline-none resize-none" required />
              </div>
            )}

            {esAdmin ? (
              <>
                <div>
                  <label htmlFor="retiro-cierre" className="block text-xs font-bold text-gray-700 mb-1">Retiro de efectivo ($)</label>
                  <input id="retiro-cierre" type="number" inputMode="decimal" min="0" step="0.01"
                    value={retiroCierre} onChange={(e) => setRetiroCierre(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                  <p className="text-[11px] text-gray-400 mt-1">Se resta de lo que contaste, no del calculado.</p>
                </div>

                {retiroCierreNum > 0 && (
                  <div>
                    <label htmlFor="motivo-retiro" className="block text-xs font-bold text-gray-700 mb-1">
                      Motivo del retiro <span className="text-red-600">*</span>
                    </label>
                    <input id="motivo-retiro" type="text" maxLength={255} value={motivoRetiroCierre}
                      onChange={(e) => setMotivoRetiroCierre(e.target.value)} placeholder="Ej: depósito bancario"
                      className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" required />
                  </div>
                )}

                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-md text-xs font-bold flex justify-between text-blue-800">
                  <span>Queda para la próxima apertura:</span>
                  <span>{formatoMoneda(remanentePreview)}</span>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-gray-500 italic">
                Solo un administrador puede retirar efectivo. Vas a cerrar sin retiro.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setModal(null)} disabled={isSubmitting}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={isSubmitting}
                className="px-4 py-2 text-sm font-bold bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white rounded-md shadow">
                {isSubmitting ? 'Cerrando…' : 'Confirmar Cierre'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL RETIRO DURANTE JORNADA */}
      {modal === 'RETIRO' && esAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handleRetiroJornada} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">🏦 Retirar Efectivo</h3>

            <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600 border flex justify-between">
              <span>Efectivo disponible según sistema:</span>
              <strong className="text-gray-800">{formatoMoneda(arqueo.efectivoCalculado)}</strong>
            </div>

            <div>
              <label htmlFor="r-monto" className="block text-xs font-bold text-gray-700 mb-1">Monto a retirar ($)</label>
              <input id="r-monto" type="number" inputMode="decimal" min="0.01" step="0.01"
                value={retiroJornada.monto} onChange={(e) => setRetiroJornada({ ...retiroJornada, monto: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" required />
            </div>

            <div>
              <label htmlFor="r-motivo" className="block text-xs font-bold text-gray-700 mb-1">Motivo</label>
              <input id="r-motivo" type="text" maxLength={255} placeholder="Ej: pago a proveedor, depósito"
                value={retiroJornada.motivo} onChange={(e) => setRetiroJornada({ ...retiroJornada, motivo: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" required />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setModal(null)} disabled={isSubmitting}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={isSubmitting}
                className="px-4 py-2 text-sm font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-md shadow">
                {isSubmitting ? 'Registrando…' : 'Confirmar Retiro'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL EGRESO */}
      {modal === 'EGRESO' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handleEgreso} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">💸 Registrar Gasto</h3>
            <div>
              <label htmlFor="e-concepto" className="block text-xs font-bold text-gray-700 mb-1">Concepto</label>
              <input id="e-concepto" type="text" maxLength={255} placeholder="Ej: insumos de limpieza"
                value={egreso.concepto} onChange={(e) => setEgreso({ ...egreso, concepto: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:outline-none" required />
            </div>
            <div>
              <label htmlFor="e-monto" className="block text-xs font-bold text-gray-700 mb-1">Monto ($)</label>
              <input id="e-monto" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00"
                value={egreso.monto} onChange={(e) => setEgreso({ ...egreso, monto: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:outline-none" required />
            </div>
            <div>
              <label htmlFor="e-metodo" className="block text-xs font-bold text-gray-700 mb-1">Medio de pago</label>
              <select id="e-metodo" value={egreso.metodo} onChange={(e) => setEgreso({ ...egreso, metodo: e.target.value as MetodoPago })}
                className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-red-500 focus:outline-none">
                {METODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setModal(null)} disabled={isSubmitting}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={isSubmitting}
                className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-md shadow">
                {isSubmitting ? 'Guardando…' : 'Guardar Egreso'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* COBRO REUTILIZADO */}
      <ModalCobro
        key={alumnoCobrando ? `cobro-caja-${alumnoCobrando.id}` : 'cobro-caja-nuevo'}
        open={modalCobroOpen}
        cobro={null}
        alumnoPreseleccionado={alumnoCobrando}
        onClose={() => { setModalCobroOpen(false); setAlumnoCobrando(null); }}
        onCobroGuardado={() => {
          setModalCobroOpen(false);
          setAlumnoCobrando(null);
          refetch();
        }}
      />

      <ModalVenta
        open={modalVentaOpen}
        onClose={() => setModalVentaOpen(false)}
        onVentaGuardada={refetch}
      />

      <ModalFiado
        open={modalFiadoOpen}
        cajaAbierta={estadoCaja.abierta}
        onClose={() => setModalFiadoOpen(false)}
        onCobrado={refetch}
      />
    </div>
  );
}