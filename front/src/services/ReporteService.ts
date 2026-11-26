import { api } from '../lib/api';
import type { MetodoPago } from './CajaService';

export type PorMetodo = Record<MetodoPago, number>;

export interface ReporteMensual {
  periodo: string;
  cerrado: boolean;
  sesiones_sin_arqueo: number;
  cierre: { cerrado_at: string; cerrado_por: string } | null;
  es_admin: boolean;
  sesiones_cerradas: number;
  ingresos: {
    por_metodo: PorMetodo;
    total: number;
    cantidad_cobros: number;
    cantidad_ventas: number;
  };
  conciliacion: {
    facturado_efectivo: number;
    diferencias_netas: number;
    efectivo_conciliado: number;
  };
  egresos: {
    por_metodo: PorMetodo;
    total: number;
  };
  movimiento_efectivo: {
    extracciones: number;
    egresos_efectivo: number;
    aportes_cambio: number;
    remanente_fin_mes: number;
  };
}

export interface PanoramaAlumno {
  persona_id: number;
  dni: string;
  nombre: string;
  apellido: string;
  telefono: string;
  estado: string;
  plan_nombre: string | null;
  cobertura_fin: string | null;
  tiene_deuda: number | boolean;
  deuda_total: number;
  total_pagado: number;
  ultimo_pago_fecha: string | null;
  ultimo_pago_monto: number | null;
  deuda_vencida: number;
  cantidad_coberturas_vencidas: number | null;
  cantidad_compras: number;
  total_compras: number;
  coberturas_con_deuda: number | null;
  primera_deuda_vence: string | null;
}

export const reporteService = {

  getMensual: async (periodo: string): Promise<ReporteMensual> => {
    return api.get<ReporteMensual>('/reportes/mensual', { periodo });
  },

  contabilizar: async (periodo: string) => {
    return api.post<{ mensaje: string; reporte: ReporteMensual }>('/reportes/contabilizar', { periodo });
  },

  reabrir: async (periodo: string) => {
    return api.delete<{ mensaje: string }>(`/reportes/contabilizar/${periodo}`);
  },

  getPanoramaAlumnos: async (filtros: {
    buscar?: string;
    solo_con_deuda?: boolean;
    solo_provisorios?: boolean;
    solo_inactivos?: boolean;
  } = {}) => {
    const params: Record<string, string> = {};
    if (filtros.buscar) params.buscar = filtros.buscar;
    if (filtros.solo_con_deuda) params.solo_con_deuda = '1';
    if (filtros.solo_provisorios) params.solo_provisorios = '1';
    if (filtros.solo_inactivos) params.solo_inactivos = '1';
    return api.get<PanoramaAlumno[]>('/reportes/alumnos/panorama', params);
  }
};

  

export default reporteService;