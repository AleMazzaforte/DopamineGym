import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import productoService, { type Producto } from '../../../services/ProductoService';
import ventaService from '../../../services/VentaService';
import type { MetodoPago } from '../../../services/CajaService';
import type { PersonaConEstado } from '../../../services/PersonaService';
import BuscadorAlumno from '../../utils/BuscadorAlumnos';
import { mostrarError, mostrarExito } from '../../../lib/swal';
import { useModalA11y } from '../../../Hooks/useModalA11y';

interface Props {
  open: boolean;
  onClose: () => void;
  onVentaGuardada: () => void;
}

interface Linea {
  producto_id: number;
  nombre: string;
  sku: string | null;
  precio: number;
  cantidad: number;
  stock: number;
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

export default function ModalVenta({ open, onClose, onVentaGuardada }: Props) {
  const { dialogRef, handleBackdropClick } = useModalA11y({ open, onClose });
  const inputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [comprador, setComprador] = useState<PersonaConEstado | null>(null);
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [modo, setModo] = useState<'TOTAL' | 'PARCIAL' | 'FIADO'>('TOTAL');
  const [parcial, setParcial] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ(''); setResultados([]); setCarrito([]); setComprador(null);
    setMetodo('efectivo'); setModo('TOTAL'); setParcial('');
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  // Búsqueda parcial con debounce (no pega en cada tecla)
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setResultados([]); return; }
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        setBuscando(true);
        const r = await productoService.buscar(term, false);
        if (vivo) setResultados(r);
      } catch { if (vivo) setResultados([]); }
      finally { if (vivo) setBuscando(false); }
    }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [q, open]);

  const agregar = useCallback((p: Producto) => {
    if (p.stock <= 0) { mostrarError('Sin stock', `${p.nombre} no tiene unidades disponibles`); return; }
    setCarrito(prev => {
      const i = prev.findIndex(l => l.producto_id === p.id);
      if (i >= 0) {
        if (prev[i].cantidad >= p.stock) {
          mostrarError('Stock máximo', `Solo hay ${p.stock} unidades de ${p.nombre}`);
          return prev;
        }
        const copia = [...prev];
        copia[i] = { ...copia[i], cantidad: copia[i].cantidad + 1 };
        return copia;
      }
      return [...prev, {
        producto_id: p.id, nombre: p.nombre, sku: p.sku,
        precio: Number(p.precio_unitario), cantidad: 1, stock: p.stock
      }];
    });
    setQ(''); setResultados([]);
    inputRef.current?.focus();
  }, []);

  // Enter: intenta match exacto por SKU o código de barras (lector)
  const onKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    try {
      const exactos = await productoService.buscar(term, true);
      if (exactos.length === 1) { agregar(exactos[0]); return; }
      if (resultados.length === 1) { agregar(resultados[0]); return; }
      if (resultados.length === 0) mostrarError('Sin resultados', `No se encontró "${term}"`);
    } catch (error: unknown) {
      mostrarError('Error', error instanceof Error ? error.message : 'No se pudo buscar');
    }
  };

  const cambiarCantidad = (id: number, delta: number) => {
    setCarrito(prev => prev.flatMap(l => {
      if (l.producto_id !== id) return [l];
      const nueva = l.cantidad + delta;
      if (nueva <= 0) return [];
      if (nueva > l.stock) { mostrarError('Stock máximo', `Solo hay ${l.stock} unidades`); return [l]; }
      return [{ ...l, cantidad: nueva }];
    }));
  };

  const quitar = (id: number) => setCarrito(prev => prev.filter(l => l.producto_id !== id));

  const total = useMemo(() => round2(carrito.reduce((a, l) => a + l.precio * l.cantidad, 0)), [carrito]);
  const cobrado = modo === 'TOTAL' ? total : modo === 'FIADO' ? 0 : round2(Number(parcial || 0));
  const saldo = round2(total - cobrado);
  const requiereComprador = saldo > 0;

  const submit = async () => {
    if (carrito.length === 0) return mostrarError('Atención', 'Agregá al menos un producto');
    if (modo === 'PARCIAL' && (!Number.isFinite(cobrado) || cobrado <= 0 || cobrado >= total)) {
      return mostrarError('Atención', 'El pago parcial debe ser mayor a 0 y menor al total');
    }
    if (requiereComprador && !comprador) {
      return mostrarError('Atención', 'Para dejar saldo pendiente tenés que seleccionar el alumno');
    }

    setEnviando(true);
    try {
      const r = await ventaService.create({
        items: carrito.map(l => ({ producto_id: l.producto_id, cantidad: l.cantidad })),
        metodo_pago: metodo,
        persona_id: comprador?.id ?? null,
        monto_pagado: cobrado
      });
      mostrarExito('Venta registrada',
        r.saldo_pendiente > 0
          ? `Total ${money(r.total)} · cobrado ${money(r.monto_pagado)} · queda ${money(r.saldo_pendiente)}`
          : `Total ${money(r.total)} cobrado`);
      onVentaGuardada();
      onClose();
    } catch (error: unknown) {
      mostrarError('Error', error instanceof Error ? error.message : 'No se pudo registrar la venta');
    } finally {
      setEnviando(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleBackdropClick}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="venta-title" tabIndex={-1}
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden outline-none">

        <div className="p-5 border-b flex justify-between items-center">
          <h2 id="venta-title" className="text-lg font-bold text-gray-800">🛒 Venta de insumos</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl font-bold" aria-label="Cerrar">×</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* BUSCADOR / SCANNER */}
          <div>
            <label htmlFor="v-q" className="block text-xs font-bold text-gray-700 mb-1">
              Escaneá el código o buscá por nombre / SKU
            </label>
            <input id="v-q" ref={inputRef} type="text" value={q}
              onChange={e => setQ(e.target.value)} onKeyDown={onKeyDown}
              placeholder="Escaneá y presioná Enter, o escribí 'agua'…"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />

            {q.trim().length >= 2 && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-gray-100">
                {buscando ? (
                  <p className="p-3 text-xs text-gray-400">Buscando…</p>
                ) : resultados.length === 0 ? (
                  <p className="p-3 text-xs text-gray-400">Sin coincidencias.</p>
                ) : resultados.map(p => (
                  <button key={p.id} type="button" onClick={() => agregar(p)} disabled={p.stock <= 0}
                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 disabled:opacity-50 disabled:hover:bg-transparent flex justify-between items-center gap-3">
                    <span className="text-sm">
                      <span className="font-semibold text-gray-800">{p.nombre}</span>
                      {p.sku && <span className="ml-2 text-[10px] font-mono text-gray-400">{p.sku}</span>}
                    </span>
                    <span className="text-xs whitespace-nowrap">
                      <span className="font-bold text-gray-900">{money(Number(p.precio_unitario))}</span>
                      <span className={`ml-2 ${p.stock <= 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {p.stock <= 0 ? 'sin stock' : `${p.stock} u.`}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CARRITO */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {carrito.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">El carrito está vacío.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-semibold">
                  <tr>
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-center">Cantidad</th>
                    <th className="px-3 py-2 text-right">Precio</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {carrito.map(l => (
                    <tr key={l.producto_id}>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-gray-800">{l.nombre}</div>
                        <div className="text-[10px] text-gray-400">Disponible: {l.stock}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => cambiarCantidad(l.producto_id, -1)}
                            className="w-7 h-7 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold">−</button>
                          <span className="w-8 text-center font-bold">{l.cantidad}</span>
                          <button type="button" onClick={() => cambiarCantidad(l.producto_id, 1)}
                            className="w-7 h-7 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold">+</button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">{money(l.precio)}</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900">{money(l.precio * l.cantidad)}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => quitar(l.producto_id)}
                          className="text-red-600 hover:text-red-800 text-xs font-semibold">Quitar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* COMPRADOR */}
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-bold text-gray-700 mb-2">
              Comprador {requiereComprador
                ? <span className="text-red-600">(obligatorio si deja saldo)</span>
                : <span className="text-gray-400 font-normal">(opcional)</span>}
            </p>
            {comprador ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-gray-800">
                  👤 {comprador.apellido}, {comprador.nombre} · DNI {comprador.dni}
                </span>
                <button type="button" onClick={() => setComprador(null)}
                  className="text-xs text-gray-500 hover:text-gray-800 font-semibold">Quitar</button>
              </div>
            ) : (
              <BuscadorAlumno onSeleccionar={(a) => setComprador(a as PersonaConEstado)}
                mostrarFiltroBajas={false} verBajas={false} onVerBajasChange={() => {}} />
            )}
          </div>

          {/* PAGO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="v-metodo" className="block text-xs font-bold text-gray-700 mb-1">Medio de pago</label>
              <select id="v-metodo" value={metodo} onChange={e => setMetodo(e.target.value as MetodoPago)}
                disabled={modo === 'FIADO'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100">
                {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <span className="block text-xs font-bold text-gray-700 mb-1">Cómo se cobra</span>
              <div className="flex gap-1">
                {(['TOTAL', 'PARCIAL', 'FIADO'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setModo(m)}
                    className={`flex-1 px-2 py-2 text-xs font-bold rounded-md border transition-colors ${
                      modo === m ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {m === 'TOTAL' ? 'Todo' : m === 'PARCIAL' ? 'Parcial' : 'Fiado'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {modo === 'PARCIAL' && (
            <div>
              <label htmlFor="v-parcial" className="block text-xs font-bold text-gray-700 mb-1">Monto que paga ahora</label>
              <input id="v-parcial" type="number" min="0.01" step="0.01" inputMode="decimal" value={parcial}
                onChange={e => setParcial(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          )}
        </div>

        {/* PIE */}
        <div className="p-5 border-t bg-gray-50 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Total</span><span className="font-bold text-gray-900">{money(total)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Cobra ahora</span><span className="font-bold text-green-700">{money(cobrado)}</span>
          </div>
          {saldo > 0 && (
            <div className="flex justify-between text-sm font-bold text-amber-700">
              <span>Queda debiendo</span><span>{money(saldo)}</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={enviando}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-md disabled:opacity-50">Cancelar</button>
            <button type="button" onClick={submit} disabled={enviando || carrito.length === 0}
              className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md shadow">
              {enviando ? 'Registrando…' : 'Confirmar venta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}