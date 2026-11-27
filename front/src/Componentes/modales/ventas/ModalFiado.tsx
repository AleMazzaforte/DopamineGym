import { useEffect, useState, useMemo, useCallback } from 'react';
import ventaService, {
  type VentaListado, type VentaDetalleResponse
} from '../../../services/VentaService';
import type { MetodoPago } from '../../../services/CajaService';
import { mostrarError, mostrarExito } from '../../../lib/swal';
import { useModalA11y } from '../../../hooks/useModalA11y';

interface Props {
  open: boolean;
  cajaAbierta: boolean;
  onClose: () => void;
  onCobrado: () => void;
}

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjetas', label: 'Tarjetas' },
  { value: 'QR', label: 'QR / MercadoPago' },
  { value: 'debito_automatico', label: 'Débito automático' },
];

const money = (v: number) => `$${Number(v || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const fechaCorta = (f: string | null | undefined) => {
  if (!f) return '—';
  const [y, m, d] = String(f).slice(0, 10).split('-');
  return y ? `${d}/${m}/${y}` : '—';
};

export default function ModalFiado({ open, cajaAbierta, onClose, onCobrado }: Props) {
  const { dialogRef, handleBackdropClick } = useModalA11y({ open, onClose });

  const [ventas, setVentas] = useState<VentaListado[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscar, setBuscar] = useState('');

  const [cobrandoId, setCobrandoId] = useState<number | null>(null);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [enviando, setEnviando] = useState(false);

  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<VentaDetalleResponse | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ventaService.getAll(true);
      setVentas(data);
    } catch (error: unknown) {
      mostrarError('Error', error instanceof Error ? error.message : 'No se pudieron cargar los fiados');
      setVentas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setVentas([]); setBuscar(''); setCobrandoId(null);
      setDetalleId(null); setDetalle(null);
      return;
    }
    cargar();
  }, [open, cargar]);

  useEffect(() => {
    if (!open || detalleId === null) return;
    let vivo = true;
    setCargandoDetalle(true);
    ventaService.getById(detalleId)
      .then(d => { if (vivo) setDetalle(d); })
      .catch(() => { if (vivo) setDetalle(null); })
      .finally(() => { if (vivo) setCargandoDetalle(false); });
    return () => { vivo = false; };
  }, [detalleId, open]);

  const filtradas = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    if (!t) return ventas;
    return ventas.filter(v =>
      (v.comprador ?? '').toLowerCase().includes(t) || String(v.id).includes(t)
    );
  }, [ventas, buscar]);

  const totalAdeudado = useMemo(
    () => round2(ventas.reduce((a, v) => a + Number(v.saldo_pendiente), 0)),
    [ventas]
  );

  const abrirCobro = (v: VentaListado) => {
    setCobrandoId(v.id);
    setMonto(String(round2(Number(v.saldo_pendiente))));
    setMetodo('efectivo');
    setDetalleId(null);
  };

  const confirmarCobro = async (v: VentaListado) => {
    const valor = round2(Number(monto));
    const saldo = round2(Number(v.saldo_pendiente));

    if (!Number.isFinite(valor) || valor <= 0) {
      mostrarError('Atención', 'Ingresá un monto mayor a cero');
      return;
    }
    if (valor > saldo) {
      mostrarError('Atención', `El monto supera la deuda. Saldo: ${money(saldo)}`);
      return;
    }

    setEnviando(true);
    try {
      const r = await ventaService.registrarPago(v.id, valor, metodo);
      mostrarExito('Cobro registrado', r.mensaje);
      setCobrandoId(null);
      setMonto('');
      await cargar();
      onCobrado();
    } catch (error: unknown) {
      mostrarError('Error', error instanceof Error ? error.message : 'No se pudo registrar el cobro');
    } finally {
      setEnviando(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleBackdropClick}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="fiados-title" tabIndex={-1}
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden outline-none">

        {/* CABECERA */}
        <div className="bg-amber-600 text-white p-5 flex justify-between items-start gap-4">
          <div>
            <h2 id="fiados-title" className="text-lg font-bold">💳 Fiados pendientes</h2>
            <p className="text-xs text-amber-100 mt-0.5">
              {ventas.length} venta{ventas.length === 1 ? '' : 's'} con saldo · Total adeudado {money(totalAdeudado)}
            </p>
          </div>
          <button onClick={onClose} className="text-amber-100 hover:text-white text-2xl font-bold leading-none" aria-label="Cerrar">×</button>
        </div>

        {!cajaAbierta && (
          <div className="px-5 py-3 bg-red-50 border-b border-red-200 text-red-800 text-xs font-semibold">
            ⚠️ La caja está cerrada. Podés consultar los fiados, pero para cobrar tenés que abrir la caja.
          </div>
        )}

        {/* BUSCADOR */}
        <div className="px-5 py-3 border-b border-gray-200">
          <label htmlFor="fi-buscar" className="sr-only">Buscar deudor</label>
          <input id="fi-buscar" type="text" value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por apellido, nombre o número de venta…"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
        </div>

        {/* LISTA */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <p className="py-10 text-center text-gray-500 animate-pulse">Cargando fiados…</p>
          ) : filtradas.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <div className="text-4xl" aria-hidden="true">🎉</div>
              <p className="text-sm text-gray-500">
                {ventas.length === 0 ? 'No hay fiados pendientes. Todo cobrado.' : 'Ningún deudor coincide con la búsqueda.'}
              </p>
            </div>
          ) : filtradas.map(v => {
            const saldo = round2(Number(v.saldo_pendiente));
            const cobrando = cobrandoId === v.id;
            const viendoDetalle = detalleId === v.id;
            const montoNum = round2(Number(monto || 0));

            return (
              <div key={v.id} className={`border rounded-lg overflow-hidden transition-colors ${cobrando ? 'border-amber-400' : 'border-gray-200'}`}>
                <div className="p-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">
                      {v.comprador ?? 'Consumidor final'}
                      <span className="ml-2 text-[10px] font-mono text-gray-400">#{v.id}</span>
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {fechaCorta(v.fecha_venta)} · {v.items} ítem{v.items === 1 ? '' : 's'} · vendió {v.vendedor}
                    </p>
                    <div className="flex gap-3 mt-1.5 text-[11px]">
                      <span className="text-gray-500">Total <strong className="text-gray-800">{money(Number(v.total))}</strong></span>
                      <span className="text-gray-500">Pagó <strong className="text-green-700">{money(Number(v.monto_pagado))}</strong></span>
                      <span className="text-gray-500">Debe <strong className="text-amber-700">{money(saldo)}</strong></span>
                    </div>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    <button type="button"
                      onClick={() => { setDetalleId(viendoDetalle ? null : v.id); setCobrandoId(null); }}
                      className="text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded transition-colors">
                      {viendoDetalle ? 'Ocultar' : 'Detalle'}
                    </button>
                    <button type="button" onClick={() => abrirCobro(v)} disabled={!cajaAbierta || enviando}
                      className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 px-3 py-1.5 rounded transition-colors">
                      Cobrar
                    </button>
                  </div>
                </div>

                {/* DETALLE */}
                {viendoDetalle && (
                  <div className="border-t border-gray-200 bg-gray-50 p-3 space-y-3">
                    {cargandoDetalle ? (
                      <p className="text-xs text-gray-400">Cargando detalle…</p>
                    ) : !detalle ? (
                      <p className="text-xs text-gray-400">No se pudo cargar el detalle.</p>
                    ) : (
                      <>
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Productos</p>
                          <table className="w-full text-xs">
                            <tbody className="divide-y divide-gray-200">
                              {detalle.items.map(it => (
                                <tr key={it.id}>
                                  <td className="py-1 text-gray-700">{it.producto_nombre}</td>
                                  <td className="py-1 text-center text-gray-500 whitespace-nowrap">{it.cantidad} × {money(Number(it.precio_unitario))}</td>
                                  <td className="py-1 text-right font-semibold text-gray-800">{money(Number(it.subtotal))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Cobros ya registrados</p>
                          {detalle.pagos.length === 0 ? (
                            <p className="text-xs text-gray-400">Todavía no se cobró nada.</p>
                          ) : (
                            <ul className="space-y-0.5">
                              {detalle.pagos.map(pg => (
                                <li key={pg.id} className="text-xs text-gray-600 flex justify-between gap-2">
                                  <span>{fechaCorta(pg.fecha_pago)} · <span className="capitalize">{pg.metodo_pago.replace(/_/g, ' ')}</span> · {pg.cobrador}</span>
                                  <strong className="text-green-700">{money(Number(pg.monto))}</strong>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* COBRO */}
                {cobrando && (
                  <div className="border-t border-amber-300 bg-amber-50 p-3 space-y-3">
                    <div className="flex items-end gap-2 flex-wrap">
                      <div className="flex-1 min-w-[140px]">
                        <label htmlFor={`fi-monto-${v.id}`} className="block text-[10px] font-bold text-gray-700 mb-1">
                          Monto a cobrar
                        </label>
                        <input id={`fi-monto-${v.id}`} type="number" min="0.01" step="0.01" inputMode="decimal"
                          value={monto} onChange={e => setMonto(e.target.value)} autoFocus
                          className="w-full px-3 py-2 border border-amber-300 rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                      </div>
                      <div className="flex-1 min-w-[150px]">
                        <label htmlFor={`fi-metodo-${v.id}`} className="block text-[10px] font-bold text-gray-700 mb-1">
                          Medio de pago
                        </label>
                        <select id={`fi-metodo-${v.id}`} value={metodo} onChange={e => setMetodo(e.target.value as MetodoPago)}
                          className="w-full px-3 py-2 border border-amber-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                          {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </div>
                      <button type="button" onClick={() => setMonto(String(saldo))}
                        className="px-3 py-2 text-xs font-bold rounded-md border border-amber-400 text-amber-800 bg-white hover:bg-amber-100 transition-colors">
                        Todo ({money(saldo)})
                      </button>
                    </div>

                    {montoNum > 0 && montoNum < saldo && (
                      <p className="text-[11px] font-semibold text-amber-800">
                        Cobro parcial: quedarán {money(round2(saldo - montoNum))} pendientes.
                      </p>
                    )}

                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setCobrandoId(null)} disabled={enviando}
                        className="px-3 py-1.5 text-xs text-gray-600 hover:bg-amber-100 rounded-md disabled:opacity-50">
                        Cancelar
                      </button>
                      <button type="button" onClick={() => confirmarCobro(v)} disabled={enviando}
                        className="px-4 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-md shadow">
                        {enviando ? 'Registrando…' : `Confirmar ${money(montoNum)}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* PIE */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center gap-3">
          <button type="button" onClick={cargar} disabled={loading}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900 disabled:opacity-50">
            ↻ Actualizar lista
          </button>
          <button type="button" onClick={onClose}
            className="px-5 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}