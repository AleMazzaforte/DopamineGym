import { api } from '../lib/api';
import type { MetodoPago } from './CajaService';

export interface VentaItemInput {
  producto_id: number;
  cantidad: number;
}

export interface VentaCreatePayload {
  items: VentaItemInput[];
  metodo_pago: MetodoPago;
  persona_id?: number | null;
  monto_pagado?: number;
}

export interface VentaCreateResponse {
  mensaje: string;
  venta_id: number;
  total: number;
  monto_pagado: number;
  saldo_pendiente: number;
}

export interface VentaListado {
  id: number;
  fecha_venta: string;
  total: number;
  monto_pagado: number;
  saldo_pendiente: number;
  metodo_pago: MetodoPago;
  persona_id: number | null;
  comprador: string | null;
  vendedor: string;
  items: number;
}

export interface VentaItemDetalle {
  id: number;
  producto_id: number;
  producto_nombre: string;
  sku: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface VentaPagoDetalle {
  id: number;
  monto: number;
  metodo_pago: MetodoPago;
  fecha_pago: string;
  cobrador: string;
}

export interface VentaDetalleResponse {
  venta: VentaListado & { vendedor_id: number; fecha_venta_fmt: string };
  items: VentaItemDetalle[];
  pagos: VentaPagoDetalle[];
}

export const ventaService = {
  getAll: async (soloConDeuda = false): Promise<VentaListado[]> => {
    const params: Record<string, string> = {};
    if (soloConDeuda) params.solo_con_deuda = '1';
    return api.get<VentaListado[]>('/ventas', params);
  },

  getById: async (id: number): Promise<VentaDetalleResponse> => {
    return api.get<VentaDetalleResponse>(`/ventas/${id}`);
  },

  create: async (payload: VentaCreatePayload): Promise<VentaCreateResponse> => {
    return api.post<VentaCreateResponse>('/ventas', payload);
  },

  registrarPago: async (id: number, monto: number, metodo_pago: MetodoPago) => {
    return api.post<{ mensaje: string; saldo_pendiente: number }>(`/ventas/${id}/pagos`, { monto, metodo_pago });
  },

  anular: async (id: number) => {
    return api.delete<{ mensaje: string }>(`/ventas/${id}`);
  }
};

export default ventaService;