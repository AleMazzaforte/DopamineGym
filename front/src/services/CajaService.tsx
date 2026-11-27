import { api } from '../lib/api';

export type TipoMovimiento = 'INGRESO' | 'EGRESO' | 'RETIRO';
export type CategoriaMovimiento =
  | 'CUOTA_ALUMNO' | 'VENTA_PRODUCTO' | 'GASTO_OPERATIVO' | 'EXTRACCION' | 'OTRO';
export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjetas' | 'QR' | 'debito_automatico';

export interface MovimientoCaja {
  id: number;
  fecha: string;
  concepto: string;
  monto: number;
  tipo: TipoMovimiento;
  categoria: CategoriaMovimiento;
  metodo_pago: MetodoPago;
}

export interface EstadoCajaResponse {
  id?: number;
  abierta: boolean;
  monto_inicial: number;
  aporte_cambio: number;
  monto_retirado: number;
  fecha_apertura?: string;
  usuario_apertura?: string;
  remanente_anterior: number;
  es_admin: boolean;
  fiados_cantidad: number;
  fiados_total: number;
}

export interface SesionCaja {
  id: number;
  estado: 'ABIERTA' | 'CERRADA';
  monto_inicial: number;
  fecha_apertura: string;
  fecha_cierre: string | null;
  efectivo_calculado: number | null;
  efectivo_contado: number | null;
  diferencia: number | null;
  monto_retirado: number;
  efectivo_remanente: number | null;
}

export interface ArqueoCaja {
  ingresosEfectivo: number;
  egresosEfectivo: number;
  retirosEfectivo: number;
  ingresosDigital: number;
  egresosDigital: number;
  efectivoCalculado: number;
  totalDigital: number;
  totalConsolidado: number;
}

export interface ResumenCajaResponse {
  estado: EstadoCajaResponse;
  sesion: SesionCaja | null;
  movimientos: MovimientoCaja[];
  arqueo: ArqueoCaja;
}

export interface CierreCajaPayload {
  efectivo_contado: number;
  monto_retirado?: number;
  motivo_retiro?: string;
  observaciones_diferencia?: string;
  observaciones?: string;
}

export interface CierreCajaResponse {
  mensaje: string;
  efectivo_calculado: number;
  efectivo_contado: number;
  diferencia: number;
  monto_retirado: number;
  efectivo_remanente: number;
}

export const cajaService = {
  getEstadoCaja: async (): Promise<EstadoCajaResponse> => {
    return api.get<EstadoCajaResponse>('/caja/estado');
  },

  getResumenCaja: async (fecha: string): Promise<ResumenCajaResponse> => {
    return api.get<ResumenCajaResponse>('/caja/resumen', { fecha });
  },

  // El inicial lo calcula el back: remanente anterior + aporte
  abrirCaja: async (aporte_cambio: number, observaciones?: string) => {
    return api.post<{
      mensaje: string;
      sesion_id: number;
      remanente_anterior: number;
      aporte_cambio: number;
      monto_inicial: number;
    }>('/caja/abrir', { aporte_cambio, observaciones });
  },

  cerrarCaja: async (id: number, payload: CierreCajaPayload): Promise<CierreCajaResponse> => {
    return api.put<CierreCajaResponse>(`/caja/cerrar/${id}`, payload);
  },

  registrarEgreso: async (concepto: string, monto: number, metodo_pago: MetodoPago) => {
    return api.post<{ mensaje: string; id: number }>('/caja/egresos', { concepto, monto, metodo_pago });
  },

  // Retiro durante la jornada. Solo ADMIN (el back lo valida igual).
  registrarRetiro: async (monto: number, motivo: string) => {
    return api.post<{ mensaje: string; monto: number; efectivo_disponible_restante: number }>(
      '/caja/retiros', { monto, motivo }
    );
  }
};

export default cajaService;