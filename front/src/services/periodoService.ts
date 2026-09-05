  import { api } from '../lib/api';

  export type MotivoBaja = 
    | 'vacaciones'
    | 'lesion'
    | 'cuestiones_laborales'
    | 'cambio_domicilio'
    | 'problemas_financieros'
    | 'disgusto_personal'
    | 'disgusto_instalaciones'
    | 'asistencia_intermitente'
    | 'otros';

  export type MetodoCobro = 'efectivo' | 'transferencia' | 'tarjetas' | 'QR' | 'debito_automatico';

  export type Periodo = {
    id: number;
    persona_id: number;
    fecha_inicio: string;
    fecha_fin: string | null;
    motivo_baja: MotivoBaja | null;
    observaciones: string | null;
    plan_id?: number;
    plan_nombre?: string;
    plan_precio?: number;
    created_at: string;
    updated_at: string;
  };

  export const periodoService = {
    getPeriodoActivo: async (personaId: number) => {
      return await api.get(`/periodos/activo/${personaId}`) as Periodo | null;
    },

    getUltimoPeriodo: async (personaId: number) => {
      return await api.get(`/periodos/ultimo/${personaId}`) as Periodo | null;
    },

    getByPersona: async (personaId: number) => {
      return await api.get(`/periodos/persona/${personaId}`) as Periodo[];
    },

    registrarBaja: async (periodoId: number, motivo_baja: MotivoBaja, observaciones?: string) => {
      const url = `/periodos/${periodoId}/baja`;
      console.log(url);
      
      return await api.put(url, {
        motivo_baja,
        observaciones: observaciones || null,
      }) as Periodo;
    },

    create: async (data: {
      persona_id: number;
      fecha_inicio: string;
      fecha_fin: string | null;
      motivo_baja?: MotivoBaja | null;
      observaciones?: string | null;
    }) => {
      
      return await api.post('/periodos', data) as Periodo;
    },

    update: async (periodoId: number, data: Partial<Periodo>) => {
      return await api.put(`/periodos/${periodoId}`, data) as Periodo;
    },
  };

  export default periodoService;