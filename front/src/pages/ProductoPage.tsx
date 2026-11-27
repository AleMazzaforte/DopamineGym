import { useEffect, useState, useMemo, useCallback } from 'react';
import productoService, {
  type Producto, type ProductoPayload, type MovimientoStock
} from '../services/ProductoService';
import { mostrarError, mostrarExito, mostrarConfirmacion } from '../lib/swal';
import { useAuth } from '../contexts/AuthContext';

const money = (v: number) => `$${Number(v || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

/* ============================================================
   Modal alta / edición
   ============================================================ */

const FORM_VACIO = {
  sku: '', codigo_barras: '', nombre: '', descripcion: '',
  precio_unitario: '', costo_unitario: '', stock: '0', stock_minimo: '0'
};

function ModalProducto({ open, producto, onClose, onGuardado }: {
  open: boolean;
  producto: Producto | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState(FORM_VACIO);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (producto) {
      setForm({
        sku: producto.sku ?? '',
        codigo_barras: producto.codigo_barras ?? '',
        nombre: producto.nombre,
        descripcion: producto.descripcion ?? '',
        precio_unitario: String(producto.precio_unitario),
        costo_unitario: String(producto.costo_unitario),
        stock: String(producto.stock),
        stock_minimo: String(producto.stock_minimo)
      });
    } else {
      setForm(FORM_VACIO);
    }
  }, [open, producto]);

  if (!open) return null;

  const set = (k: keyof typeof FORM_VACIO, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const precio = Number(form.precio_unitario);
    const costo = Number(form.costo_unitario || 0);
    const minimo = Number(form.stock_minimo || 0);
    const stock = Number(form.stock || 0);

    if (!form.nombre.trim()) return mostrarError('Atención', 'El nombre es obligatorio');
    if (!Number.isFinite(precio) || precio <= 0) return mostrarError('Atención', 'El precio debe ser mayor a cero');
    if (!Number.isFinite(costo) || costo < 0) return mostrarError('Atención', 'El costo debe ser cero o positivo');
    if (!Number.isInteger(minimo) || minimo < 0) return mostrarError('Atención', 'El stock mínimo debe ser un entero válido');
    if (!producto && (!Number.isInteger(stock) || stock < 0)) return mostrarError('Atención', 'El stock inicial debe ser un entero válido');

    const payload: ProductoPayload = {
      sku: form.sku.trim() || null,
      codigo_barras: form.codigo_barras.trim() || null,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      precio_unitario: precio,
      costo_unitario: costo,
      stock_minimo: minimo,
      ...(producto ? {} : { stock })
    };

    setEnviando(true);
    try {
      const r = producto
        ? await productoService.update(producto.id, payload)
        : await productoService.create(payload);
      mostrarExito('Listo', r.mensaje);
      onGuardado();
      onClose();
    } catch (error: unknown) {
      mostrarError('Error', error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setEnviando(false);
    }
  };

  const margen = (() => {
    const p = Number(form.precio_unitario), c = Number(form.costo_unitario || 0);
    if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(c)) return null;
    return { absoluto: p - c, pct: ((p - c) / p) * 100 };
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} role="dialog" aria-modal="true"
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-800">
            {producto ? `Editar ${producto.nombre}` : 'Nuevo producto'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl font-bold" aria-label="Cerrar">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="p-nombre" className="block text-xs font-bold text-gray-700 mb-1">Nombre *</label>
            <input id="p-nombre" type="text" maxLength={100} value={form.nombre}
              onChange={e => set('nombre', e.target.value)} required
              className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="p-sku" className="block text-xs font-bold text-gray-700 mb-1">SKU interno</label>
              <input id="p-sku" type="text" maxLength={15} value={form.sku}
                onChange={e => set('sku', e.target.value)} placeholder="AGUA500"
                className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="p-codigo" className="block text-xs font-bold text-gray-700 mb-1">Código de barras</label>
              <input id="p-codigo" type="text" maxLength={50} value={form.codigo_barras}
                onChange={e => set('codigo_barras', e.target.value)} placeholder="Escaneá o tipeá"
                className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="p-costo" className="block text-xs font-bold text-gray-700 mb-1">Costo ($)</label>
              <input id="p-costo" type="number" min="0" step="0.01" inputMode="decimal" value={form.costo_unitario}
                onChange={e => set('costo_unitario', e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="p-precio" className="block text-xs font-bold text-gray-700 mb-1">Precio de venta ($) *</label>
              <input id="p-precio" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.precio_unitario}
                onChange={e => set('precio_unitario', e.target.value)} required
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>

          {margen && (
            <p className={`text-xs font-semibold ${margen.absoluto >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              Margen: {money(margen.absoluto)} ({margen.pct.toFixed(1)}%)
              {margen.absoluto < 0 && ' — estás vendiendo bajo el costo'}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {!producto && (
              <div>
                <label htmlFor="p-stock" className="block text-xs font-bold text-gray-700 mb-1">Stock inicial</label>
                <input id="p-stock" type="number" min="0" step="1" value={form.stock}
                  onChange={e => set('stock', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            )}
            <div className={producto ? 'col-span-2' : ''}>
              <label htmlFor="p-minimo" className="block text-xs font-bold text-gray-700 mb-1">Stock mínimo (alerta)</label>
              <input id="p-minimo" type="number" min="0" step="1" value={form.stock_minimo}
                onChange={e => set('stock_minimo', e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>

          {producto && (
            <p className="text-[11px] text-gray-500 italic">
              El stock no se edita acá. Usá <strong>Ajustar stock</strong> para que quede auditado.
            </p>
          )}

          <div>
            <label htmlFor="p-desc" className="block text-xs font-bold text-gray-700 mb-1">Descripción</label>
            <textarea id="p-desc" rows={2} value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
          </div>
        </div>

        <div className="p-5 border-t bg-gray-50 flex justify-end gap-2 sticky bottom-0">
          <button type="button" onClick={onClose} disabled={enviando}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-md disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={enviando}
            className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md shadow">
            {enviando ? 'Guardando…' : producto ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   Modal ajuste de stock (ADMIN)
   ============================================================ */

function ModalAjusteStock({ producto, onClose, onGuardado }: {
  producto: Producto | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [stockNuevo, setStockNuevo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (producto) {
      setStockNuevo(String(producto.stock));
      setMotivo('');
    }
  }, [producto]);

  if (!producto) return null;

  const delta = Number(stockNuevo) - producto.stock;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const n = Number(stockNuevo);
    if (!Number.isInteger(n) || n < 0) return mostrarError('Atención', 'Ingresá un stock válido');
    if (!motivo.trim()) return mostrarError('Atención', 'Indicá el motivo del ajuste');
    if (delta === 0) return mostrarError('Atención', 'El stock contado es igual al actual');

    setEnviando(true);
    try {
      const r = await productoService.ajustarStock(producto.id, n, motivo.trim());
      mostrarExito('Stock ajustado', r.mensaje);
      onGuardado();
      onClose();
    } catch (error: unknown) {
      mostrarError('Error', error instanceof Error ? error.message : 'No se pudo ajustar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} role="dialog" aria-modal="true"
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-800 border-b pb-2">📦 Ajustar stock</h2>

        <div className="p-3 bg-gray-50 border rounded-lg text-xs text-gray-600 flex justify-between">
          <span>{producto.nombre}</span>
          <span>Stock actual: <strong className="text-gray-900">{producto.stock}</strong></span>
        </div>

        <div>
          <label htmlFor="aj-stock" className="block text-xs font-bold text-gray-700 mb-1">Stock real contado *</label>
          <input id="aj-stock" type="number" min="0" step="1" value={stockNuevo}
            onChange={e => setStockNuevo(e.target.value)} required
            className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
        </div>

        {stockNuevo !== '' && delta !== 0 && (
          <div className={`p-2.5 rounded-md text-xs font-bold flex justify-between ${
            delta > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            <span>{delta > 0 ? 'Sobrante' : 'Faltante'} de inventario:</span>
            <span>{delta > 0 ? '+' : ''}{delta}</span>
          </div>
        )}

        <div>
          <label htmlFor="aj-motivo" className="block text-xs font-bold text-gray-700 mb-1">Motivo *</label>
          <input id="aj-motivo" type="text" maxLength={255} value={motivo}
            onChange={e => setMotivo(e.target.value)} required
            placeholder="Ej: recuento mensual, roturas, vencimiento"
            className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onClose} disabled={enviando}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={enviando}
            className="px-4 py-2 text-sm font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-md shadow">
            {enviando ? 'Ajustando…' : 'Confirmar ajuste'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   Modal movimientos
   ============================================================ */

function ModalMovimientos({ producto, onClose }: { producto: Producto | null; onClose: () => void }) {
  const [movs, setMovs] = useState<MovimientoStock[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!producto) return;
    let vivo = true;
    setLoading(true);
    productoService.getMovimientos(producto.id)
      .then(d => { if (vivo) setMovs(d); })
      .catch(() => { if (vivo) setMovs([]); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [producto]);

  if (!producto) return null;

  const color = (t: string) =>
    t === 'ENTRADA' ? 'bg-green-100 text-green-800'
      : t === 'SALIDA' ? 'bg-blue-100 text-blue-800'
        : 'bg-amber-100 text-amber-800';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true"
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">📜 Movimientos · {producto.nombre}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl font-bold" aria-label="Cerrar">×</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-center text-gray-500 animate-pulse py-8">Cargando…</p>
          ) : movs.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">Sin movimientos registrados.</p>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 uppercase text-xs border-b">
                <tr>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3 text-right">Cant.</th>
                  <th className="py-2 pr-3 text-right">Queda</th>
                  <th className="py-2 pr-3">Motivo</th>
                  <th className="py-2">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movs.map(m => (
                  <tr key={m.id}>
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-600 text-xs">{m.fecha}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color(m.tipo)}`}>{m.tipo}</span>
                    </td>
                    <td className={`py-2 pr-3 text-right font-bold ${m.cantidad >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {m.cantidad > 0 ? '+' : ''}{m.cantidad}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-700">{m.stock_resultante}</td>
                    <td className="py-2 pr-3 text-gray-600 text-xs">{m.motivo}</td>
                    <td className="py-2 text-gray-500 text-xs">{m.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm font-medium">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Página
   ============================================================ */

export default function ProductoPage() {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'ADMIN';

  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  const [buscar, setBuscar] = useState('');
  const [buscarDeb, setBuscarDeb] = useState('');
  const [soloActivos, setSoloActivos] = useState(true);
  const [soloStockBajo, setSoloStockBajo] = useState(false);

  const [editando, setEditando] = useState<Producto | null>(null);
  const [modalProducto, setModalProducto] = useState(false);
  const [ajustando, setAjustando] = useState<Producto | null>(null);
  const [viendoMovs, setViendoMovs] = useState<Producto | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setBuscarDeb(buscar.trim()), 300);
    return () => clearTimeout(t);
  }, [buscar]);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const data = await productoService.getAll({
        buscar: buscarDeb || undefined,
        solo_activos: soloActivos,
        solo_stock_bajo: soloStockBajo
      });
      setProductos(data);
    } catch (error: unknown) {
      mostrarError('Error', error instanceof Error ? error.message : 'No se pudo cargar el catálogo');
    } finally {
      setLoading(false);
    }
  }, [buscarDeb, soloActivos, soloStockBajo]);

  useEffect(() => { cargar(); }, [cargar]);

  const resumen = useMemo(() => {
    const activos = productos.filter(p => Number(p.activo) === 1);
    const bajos = activos.filter(p => Number(p.stock_bajo) === 1);
    const sinStock = activos.filter(p => p.stock <= 0);
    const valorCosto = activos.reduce((a, p) => a + p.stock * Number(p.costo_unitario), 0);
    const valorVenta = activos.reduce((a, p) => a + p.stock * Number(p.precio_unitario), 0);
    return { total: productos.length, activos: activos.length, bajos: bajos.length, sinStock: sinStock.length, valorCosto, valorVenta };
  }, [productos]);

  const toggle = async (p: Producto) => {
    const activo = Number(p.activo) === 1;
    const ok = await mostrarConfirmacion(
      activo ? `¿Desactivar ${p.nombre}?` : `¿Reactivar ${p.nombre}?`,
      activo
        ? 'Dejará de aparecer en las ventas. El historial se conserva.'
        : 'Volverá a estar disponible para la venta.'
    );
    if (!ok) return;
    try {
      const r = await productoService.toggleEstado(p.id);
      mostrarExito('Listo', r.mensaje);
      await cargar();
    } catch (error: unknown) {
      mostrarError('Error', error instanceof Error ? error.message : 'No se pudo cambiar el estado');
    }
  };

  return (
    <div className="space-y-4">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Productos</h1>
          <p className="text-sm text-gray-500">Catálogo, precios y control de stock</p>
        </div>
        {esAdmin && (
          <button
            onClick={() => { setEditando(null); setModalProducto(true); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow text-sm"
          >
            + Nuevo producto
          </button>
        )}
      </div>

      {/* RESUMEN */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-xs text-gray-500 uppercase font-semibold">Productos activos</p>
          <p className="text-2xl font-extrabold text-gray-800">{resumen.activos}</p>
          <p className="text-xs text-gray-400">{resumen.total} en el listado</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-amber-500">
          <p className="text-xs text-gray-500 uppercase font-semibold">Stock bajo</p>
          <p className="text-2xl font-extrabold text-amber-700">{resumen.bajos}</p>
          <p className="text-xs text-gray-400">{resumen.sinStock} sin stock</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-gray-500">
          <p className="text-xs text-gray-500 uppercase font-semibold">Valor al costo</p>
          <p className="text-xl font-extrabold text-gray-700">{money(resumen.valorCosto)}</p>
          <p className="text-xs text-gray-400">Inventario inmovilizado</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-xs text-gray-500 uppercase font-semibold">Valor a la venta</p>
          <p className="text-xl font-extrabold text-green-700">{money(resumen.valorVenta)}</p>
          <p className="text-xs text-gray-400">Margen potencial {money(resumen.valorVenta - resumen.valorCosto)}</p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <label htmlFor="pr-buscar" className="block text-xs font-semibold text-gray-600 mb-1">
              Buscar por nombre, SKU o código de barras
            </label>
            <input id="pr-buscar" type="text" value={buscar}
              onChange={e => setBuscar(e.target.value)} placeholder="Ej: agua, AGUA500, 7790895..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div className="flex gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
              Solo activos
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={soloStockBajo} onChange={e => setSoloStockBajo(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500" />
              Solo stock bajo
            </label>
          </div>
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 animate-pulse">Cargando catálogo…</div>
        ) : productos.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {resumen.total === 0 ? 'Todavía no hay productos cargados.' : 'Ningún producto coincide con los filtros.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b text-gray-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3 text-right">Costo</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                  <th className="px-4 py-3 text-right">Margen</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {productos.map(p => {
                  const activo = Number(p.activo) === 1;
                  const bajo = Number(p.stock_bajo) === 1;
                  const margen = Number(p.precio_unitario) - Number(p.costo_unitario);
                  return (
                    <tr key={p.id} className={`hover:bg-gray-50 ${!activo ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.sku ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{p.nombre}</div>
                        {p.codigo_barras && <div className="text-[10px] text-gray-400 font-mono">{p.codigo_barras}</div>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{money(Number(p.costo_unitario))}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{money(Number(p.precio_unitario))}</td>
                      <td className={`px-4 py-3 text-right text-xs font-semibold ${margen >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {money(margen)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-extrabold ${p.stock <= 0 ? 'text-red-600' : bajo ? 'text-amber-600' : 'text-gray-800'}`}>
                          {p.stock}
                        </span>
                        <span className="block text-[10px] text-gray-400">mín {p.stock_minimo}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          activo ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                          {activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                        {esAdmin && (
                          <>
                            <button onClick={() => { setEditando(p); setModalProducto(true); }}
                              className="text-blue-600 hover:text-blue-800 text-xs font-semibold bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded">
                              Editar
                            </button>
                            <button onClick={() => setAjustando(p)}
                              className="text-amber-700 hover:text-amber-900 text-xs font-semibold bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded">
                              Stock
                            </button>
                            <button onClick={() => setViendoMovs(p)}
                              className="text-gray-600 hover:text-gray-900 text-xs font-semibold bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">
                              📜
                            </button>
                            <button onClick={() => toggle(p)}
                              className={`text-xs font-semibold px-2 py-1 rounded ${
                                activo ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}>
                              {activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </>
                        )}
                        {!esAdmin && <span className="text-xs text-gray-400">Solo lectura</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ModalProducto
        open={modalProducto}
        producto={editando}
        onClose={() => { setModalProducto(false); setEditando(null); }}
        onGuardado={cargar}
      />
      <ModalAjusteStock producto={ajustando} onClose={() => setAjustando(null)} onGuardado={cargar} />
      <ModalMovimientos producto={viendoMovs} onClose={() => setViendoMovs(null)} />
    </div>
  );
}