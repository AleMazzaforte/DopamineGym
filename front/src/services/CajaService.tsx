import { api } from '../lib/api'; // Ajusta la ruta a tu cliente API

export type TipoMovimiento = 'INGRESO' | 'EGRESO';
export type CategoriaMovimiento = 'CUOTA_ALUMNO' | 'VENTA_PRODUCTO' | 'GASTO_OPERATIVO' | 'OTRO';
export type MetodoPago = 'efectivo' | 'transferencia' | 'DEBITO' | 'CREDITO';

export interface MovimientoCaja {
  id: number;
  fecha: string;
  concepto: string;
  monto: number;
  tipo: TipoMovimiento;
  categoria: CategoriaMovimiento;
  metodo_pago: MetodoPago;
  usuario_nombre?: string;
}

export interface EstadoCajaResponse {
  id?: number;
  abierta: boolean;
  monto_inicial: number;
  fecha_apertura?: string;
  usuario_apertura?: string;
}

export interface CerrarCajaDTO {
  monto_final?: number;
}

export const cajaService = {
  // Obtener estado actual de la caja
  getEstado: async (): Promise<EstadoCajaResponse> => {
    return api.get<EstadoCajaResponse>('/caja/estado');
  },

  // Obtener lista consolidada de ingresos y egresos
  getMovimientos: async (fecha: string): Promise<MovimientoCaja[]> => {
    return api.get<MovimientoCaja[]>('/caja/movimientos', { fecha });
  },

  // Abrir la caja del día
  abrirCaja: async (montoInicial: number): Promise<EstadoCajaResponse> => {
    return api.post<EstadoCajaResponse>('/caja/abrir', { monto_inicial: montoInicial });
  },

  // Cerrar sesión de caja por ID
  cerrarCaja: async (id: number, datos?: CerrarCajaDTO) => {
    const res = await api.put(`/caja/cerrar/${id}`, datos); // o .post según tu API
    return res.data;
  },

  // Registrar un egreso / gasto manual
  registrarEgreso: async (datos: {
    concepto: string;
    monto: number;
    metodo_pago: MetodoPago;
  }): Promise<MovimientoCaja> => {
    return api.post<MovimientoCaja>('/caja/egresos', datos);
  },
};

export default cajaService;