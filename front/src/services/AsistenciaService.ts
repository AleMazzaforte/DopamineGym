// AsistenciaService.ts

import { api } from '../lib/api';

export type Asistencia = {
  id: number;
  persona_id: number;
  fecha_hora: string;
};

export const asistenciaService = {
  // GET /api/asistencias/persona/:personaId
  getByPersonaId: async (personaId: number) => {
    return await api.get(`/asistencias/persona/${personaId}`) as Asistencia[];
  },

  // POST /api/asistencias
  create: async (personaId: number) => {
    return await api.post('/asistencias', { persona_id: personaId }) as Asistencia;
  },
};

export default asistenciaService;