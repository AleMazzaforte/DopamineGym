import { api } from '../lib/api';

export type Plan = {
  id: number;
  nombre: string;
  descripcion: string | null;
  veces_por_semana: number | null;
  precio: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export const planService = {
  getAllActivos: async () => {
    return await api.get('/planes') as Plan[];
  },
};

export default planService;