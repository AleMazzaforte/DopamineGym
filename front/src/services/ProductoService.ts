import { api } from '../lib/api';

export interface Producto {
  id: number;
  sku: string | null;
  codigo_barras: string | null;
  nombre: string;
  descripcion: string | null;
  precio_unitario: number;
  costo_unitario: number;
  stock: number;
  stock_minimo: number;
  activo: number | boolean;
  stock_bajo: number | boolean;
}

export interface ProductoPayload {
  sku?: string | null;
  codigo_barras?: string | null;
  nombre: string;
  descripcion?: string | null;
  precio_unitario: number;
  costo_unitario: number;
  stock?: number;
  stock_minimo: number;
}

export interface MovimientoStock {
  id: number;
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  cantidad: number;
  stock_resultante: number;
  motivo: string;
  referencia_tipo: 'VENTA' | 'COMPRA' | 'MANUAL';
  referencia_id: number | null;
  fecha: string;
  usuario: string;
}

export interface FiltrosProducto {
  buscar?: string;
  solo_activos?: boolean;
  solo_stock_bajo?: boolean;
}

export const productoService = {
  getAll: async (filtros: FiltrosProducto = {}): Promise<Producto[]> => {
    const params: Record<string, string> = {};
    if (filtros.buscar) params.buscar = filtros.buscar;
    if (filtros.solo_activos) params.solo_activos = '1';
    if (filtros.solo_stock_bajo) params.solo_stock_bajo = '1';
    return api.get<Producto[]>('/productos', params);
  },

  getById: async (id: number): Promise<Producto> => {
    return api.get<Producto>(`/productos/${id}`);
  },

  // exacto=true para el lector de código de barras (Enter y listo)
  buscar: async (q: string, exacto = false): Promise<Producto[]> => {
    const params: Record<string, string> = { q };
    if (exacto) params.exacto = '1';
    return api.get<Producto[]>('/productos/buscar', params);
  },

  create: async (payload: ProductoPayload) => {
    return api.post<{ mensaje: string; id: number }>('/productos', payload);
  },

  update: async (id: number, payload: ProductoPayload) => {
    return api.put<{ mensaje: string }>(`/productos/${id}`, payload);
  },

  ajustarStock: async (id: number, stock_nuevo: number, motivo: string) => {
    return api.put<{ mensaje: string; delta: number; stock_resultante: number }>(
      `/productos/${id}/stock`, { stock_nuevo, motivo }
    );
  },

  toggleEstado: async (id: number) => {
    return api.put<{ mensaje: string; activo: number }>(`/productos/${id}/toggle-estado`);
  },

  getMovimientos: async (id: number): Promise<MovimientoStock[]> => {
    return api.get<MovimientoStock[]>(`/productos/${id}/movimientos`);
  }
};

export default productoService;