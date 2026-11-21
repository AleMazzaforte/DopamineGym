// services/PlanService.ts
import { api } from '../lib/api';

export type Plan = {
  id: number;
  nombre: string;
  descripcion: string | null;
  veces_por_semana: number | null;
  precio: number;
  activo: boolean;
  duracion_meses: number;
  created_at?: string;
  updated_at?: string;
};

export type CreatePlanDTO = Omit<Plan, 'id' | 'created_at' | 'updated_at'>;

export const planService = {
  getAll: async (): Promise<Plan[]> => {
    return (await api.get('/planes')) as Plan[];
  },

  getAllActivos: async (): Promise<Plan[]> => {
    return (await api.get('/planes?soloActivos=true')) as Plan[];
  },

  getById: async (id: number): Promise<Plan> => {
    return (await api.get(`/planes/${id}`)) as Plan;
  },

  create: async (data: CreatePlanDTO): Promise<{ id: number; message: string }> => {
    return (await api.post('/planes', data)) as { id: number; message: string };
  },

  update: async (id: number, data: CreatePlanDTO): Promise<{ message: string }> => {
    return (await api.put(`/planes/${id}`, data)) as { message: string };
  },

  toggleEstado: async (id: number): Promise<{ message: string }> => {
    return (await api.put(`/planes/toggle-estado${id}`, {})) as { message: string };
  },
};

export default planService;