import { api } from '../lib/api';

export type ResumenSaldo = {
  persona_id: number;
  totalCobrado: number;
  totalContratado: number;
  saldo: number;
  estadoSaldo: 'AL_DIA' | 'DEUDA' | 'A_FAVOR';
};

export const saldoService = {
  getSaldoByPersonaId: async (personaId: number): Promise<ResumenSaldo> => {
    return (await api.get(`/alumnos/${personaId}/saldo`)) as ResumenSaldo;
  },
};

export default saldoService;