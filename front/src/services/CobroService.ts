// CobroService.ts
import { api } from '../lib/api';
import { type MetodoCobro } from './periodoService';

export type Cobro = {
  id: number;
  periodo_alumno_id: number;
  fecha_cobro: string;
  monto: number;
  metodo_cobro: MetodoCobro;
  descripcion: string | null;
  created_at: string;
};

// La fecha de cobro la fija el servidor: no se envía ni se edita.
export type CobroUpdate = {
  monto: number;
  metodo_cobro: MetodoCobro;
  descripcion?: string;
};

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
  getAll: async () => {
    return await api.get('/cobros') as CobroConAlumno[];
  },

  getByRangoFechas: async (fechaDesde: string, fechaHasta: string) => {
    return await api.get('/cobros/rango', { desde: fechaDesde, hasta: fechaHasta }) as CobroConAlumno[];
  },

  // ✅ FIX: la ruta es /cobros/metodo?metodo=..., no /cobros/metodo/:metodo
  getByMetodoPago: async (metodo: MetodoCobro) => {
    return await api.get('/cobros/metodo', { metodo }) as CobroConAlumno[];
  },

  getById: async (id: number) => {
    return await api.get(`/cobros/${id}`) as CobroConAlumno;
  },

  // ✅ FIX: sin fechaCobro, la pone el backend
  create: async (params: {
    personaId: number;
    planId: number;
    monto: number;
    metodo_cobro: MetodoCobro;
    fechaInicio: string;
    fechaFin: string;
    descripcion?: string;
    precio_acordado?: number;
    es_pago_parcial?: boolean;
  }) => {
    return await api.post('/cobros', params) as Cobro;
  },

  getDeudasPendientes: async (personaId: number) => {
    const data = await api.get(`/cobros/deudas-pendientes/${personaId}`);
    return Array.isArray(data) ? data : [];
  },

  // ✅ FIX: sin fecha_cobro y devuelve el objeto real (antes devolvía undefined)
  completarDeuda: async (coberturaId: number, data: {
    monto: number;
    metodo_cobro: MetodoCobro;
    descripcion?: string;
  }) => {
    return await api.post(`/cobros/completar-deuda/${coberturaId}`, data) as {
      message: string;
      nuevo_saldo_pendiente: number;
    };
  },

  // ✅ FIX: tipo explícito, ya no admite fecha_cobro
  update: async (id: number, updates: CobroUpdate) => {
    return await api.put(`/cobros/${id}`, updates) as Cobro;
  },

  delete: async (id: number) => {
    return await api.delete(`/cobros/${id}`);
  },

  getPeriodoActivoWithPlan: async (personaId: number) => {
    return await api.get(`/periodos/activo/${personaId}`) as any;
  },

  getModalData: async (personaId: number) => {
    const data = await api.get(`/cobros/modal-data/${personaId}`);
    return data;
  }
};

export default cobroService;