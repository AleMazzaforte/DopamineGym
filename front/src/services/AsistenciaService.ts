// src/services/AsistenciaService.ts
import { api } from '../lib/api';

export type TurnoPreferido = 'MANANA' | 'TARDE' | 'NOCHE' | 'VARIABLE';

export type Asistencia = {
  id: number;
  persona_id: number;
  fecha_hora: string;
  periodo_alumno_id?: number | null;
  periodo_inicio?: string | null;
  periodo_fin?: string | null;
};

export type AsistenciaHoy = {
  id: number;
  persona_id: number;
  fecha_hora: string;
  nombre: string;
  apellido: string;
  dni: string;
  turno_preferido?: TurnoPreferido | null;
  estado_actual?: string | null;
};

export type RegistrarAsistenciaResponse = {
  id: number;
  message: string;
  persona_id: number;
  estado_alumno: string;
  tiene_periodo_activo: boolean;
};

export const asistenciaService = {
  // GET /api/asistencias/persona/:personaId (Historial de un alumno)
  getByPersonaId: async (personaId: number): Promise<Asistencia[]> => {
    return (await api.get(`/asistencias/persona/${personaId}`)) as Asistencia[];
  },

  // GET /api/asistencias/hoy (Lista de presentes del día)
  getHoy: async (): Promise<AsistenciaHoy[]> => {
    return (await api.get('/asistencias/hoy')) as AsistenciaHoy[];
  },

  // POST /api/asistencias (Por ID)
  create: async (personaId: number): Promise<RegistrarAsistenciaResponse> => {
    return (await api.post('/asistencias', { persona_id: personaId })) as RegistrarAsistenciaResponse;
  },

  // POST /api/asistencias (Por DNI - para ingreso directo)
  createByDni: async (dni: string): Promise<RegistrarAsistenciaResponse> => {
    return (await api.post('/asistencias', { dni })) as RegistrarAsistenciaResponse;
  },

  // DELETE /api/asistencias/:id (Anular ingreso marcado por error)
  delete: async (id: number): Promise<{ message: string }> => {
    return (await api.delete(`/asistencias/${id}`)) as { message: string };
  },
};

export default asistenciaService;