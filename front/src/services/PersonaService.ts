import { api } from '../lib/api';

export type Persona = {
  id: number;
  dni: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  telefono: string;
  email: string | null;
  rol_actual: 'ALUMNO' | 'PROFESOR' | 'ADMIN';
  contacto_emergencia?: string;
  telefono_familiar?: string;
  antecedentes_entrenamiento?: string;
  restricciones?: string;
  certificado_medico?: string;
  fecha_vencimiento_certificado?: string;
  created_at: string;
  updated_at: string;
};

export type PersonaConEstado = Persona & {
  estado: 'ACTIVO' | 'INACTIVO' | 'BAJA' | 'ACTIVO PROVISORIO';
  ultimo_cambio_estado?: string;
};

export type PersonaInsert = Omit<Persona, 'id' | 'created_at' | 'updated_at'>;

export type PersonaEstado = {
  id: number;
  persona_id: number;
  estado: 'ACTIVO' | 'INACTIVO' | 'BAJA' | 'ACTIVO PROVISORIO';
  fecha_cambio: string;
  motivo: string | null;
  periodo_alumno_id: number | null;
  created_at: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  motivo_baja?: string;
};

export type ActivarProvisorioData = {
  fecha_promesa_pago?: string | null;
  observaciones?: string | null;
};

export const personaService = {
  // Se le asigna un valor por defecto a term para hacerlo opcional
  getAll: async (term: string = '', rol?: 'ALUMNO' | 'PROFESOR' | 'ADMIN', soloBaja: boolean = false) => {
    const params: Record<string, string> = {};
    if (rol) params.rol = rol;
    if (term) params.term = term; 
    if (soloBaja) params.soloBaja = 'true';  
    return await api.get('/personas', params) as PersonaConEstado[];
  },

  getById: async (id: number) => {
    return await api.get(`/personas/${id}`) as PersonaConEstado;
  },

  create: async (persona: PersonaInsert) => {
    return await api.post('/personaCreate', persona) as PersonaConEstado;
  },

  update: async (id: number, updates: Partial<PersonaInsert>) => {
    return await api.put(`/personas/${id}`, updates) as PersonaConEstado;
  },

  getHistorialEstados: async (personaId: number) => {
    return await api.get(`/personas/${personaId}/historial`) as PersonaEstado[];
  },

  activarProvisorio: async (id: number, data: ActivarProvisorioData) => {
    return await api.post(`/personasProvisorio/${id}`, data);
  },
};

export default personaService;
/*
  search: async (term: string, rol?: 'ALUMNO' | 'PROFESOR' | 'ADMIN') => {
    const params: Record<string, string> = { term: String(term) };
    if (rol) params.rol = rol;
    return await api.get('/personas/search', params) as PersonaConEstado[];
  },
*/
 