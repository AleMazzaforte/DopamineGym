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
  periodo_alumno?: {
    persona?: {
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
    MetodoCobro: MetodoCobro;
    fechaCobro: string;
    fechaInicio: string;
    fechaFin: string;
    descripcion?: string;
  }) => {
    return await api.post('/cobros', params) as Cobro;
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