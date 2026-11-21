// CobroService.ts

import { api } from '../lib/api';
import { type MetodoCobro } from './periodoService';

export type Cobro = {
  id: number;
  periodo_alumno_id: string;
  fecha_cobro: string;
  monto: number;
  metodo_cobro: MetodoCobro;
  descripcion: string | null;
  created_at: string;
};

export type CobroInsert = Omit<Cobro, 'id' | 'created_at'>;

export type CobroConAlumno = Cobro & {
  persona_id?: number;
  nombre?: string;
  apellido?: string;
  dni?: string;
  plan_nombre?: string;
  
  periodo_alumno?: {
    persona_id?: number;
    persona?: {
      id?: number;
      nombre: string;
      apellido: string;
      dni: string;
    };
  };
};

export const cobroService = {
  // GET /api/cobros
  getAll: async () => {
    return await api.get('/cobros') as CobroConAlumno[];
  },

  // GET /api/cobros/rango?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
  getByRangoFechas: async (fechaDesde: string, fechaHasta: string) => {
    return await api.get('/cobros/rango', { desde: fechaDesde, hasta: fechaHasta }) as CobroConAlumno[];
  },

  // GET /api/cobros/metodo/:metodo
  getByMetodoPago: async (metodo: MetodoCobro) => {
    return await api.get(`/cobros/metodo/${metodo}`) as CobroConAlumno[];
  },

  // GET /api/cobros/:id
  getById: async (id: number) => {
    return await api.get(`/cobros/${id}`) as CobroConAlumno;
  },

  // POST /api/cobros
  create: async (params: {
    personaId: number;
    planId: number;
    monto: number;
    metodo_cobro: MetodoCobro;
    fechaCobro: string;
    fechaInicio: string;
    fechaFin: string;
    descripcion?: string;
    precio_aplicado?: number; 
    precio_acordado?: number;
    es_pago_parcial?: boolean;
  }) => {
    return await api.post('/cobros', params) as Cobro;
  },

  // Obtener deudas pendientes de un alumno
getDeudasPendientes: async (personaId: number) => {
  const data = await api.get(`/cobros/deudas-pendientes/${personaId}`);
  return Array.isArray(data) ? data : [];
},

// Completar deuda de una cobertura específica
completarDeuda: async (coberturaId: number, data: {
  monto: number;
  metodo_cobro: string;
  descripcion?: string;
  fecha_cobro?: string;
}) => {
  const response = await api.post(`/cobros/completar-deuda/${coberturaId}`, data);
  return response.data;
},
  // PUT /api/cobros/:id
  update: async (id: number, updates: Partial<CobroInsert>) => {
    return await api.put(`/cobros/${id}`, updates) as Cobro;
  },

  // DELETE /api/cobros/:id
  delete: async (id: number) => {
    return await api.delete(`/cobros/${id}`);
  },

  // Obtener período activo con plan (para el modal de cobro)
  getPeriodoActivoWithPlan: async (personaId: number) => {
    return await api.get(`/periodos/activo/${personaId}`) as any;
  },
};

export default cobroService;